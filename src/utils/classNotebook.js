import { doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, where } from "firebase/firestore"
import { db } from "../firebase"
import { surahName } from "./quran"

// ---------------------------------------------------------------------------
// "كراس القسم" — نفس منطق "attendance" و "progress" بالضبط: وثيقة واحدة في
// Firestore لكل قسم + تاريخ (معرّفها "{classId}_{date}"), تحتوي على القائمة
// الكاملة للدروس (سورة + من آية + إلى آية) التي تمّت في تلك الحصة. أبدًا
// وثيقة واحدة لكل سورة — هذا كان يكرر الحصة في قاعدة البيانات في كل مرة
// تُضاف سورة ثانية، وهو ممنوع صراحة في المواصفات.
//
// teacherId / teacherName يُحفظان كـ"صورة لحظية" وقت التسجيل، وليس بالرجوع
// الحيّ إلى "classes.teacherId" — فإذا تغيّر الأستاذ المسؤول عن القسم
// لاحقًا، تبقى كل حصة قديمة معروضة باسم الأستاذ الذي قام بها فعليًا هو. هذا
// هو نفس مبدأ "classes.teacherName" المستعمل حاليًا بالنسبة لـ"users".
// ---------------------------------------------------------------------------

const COLLECTION = "classNotebook"

function sessionId(classId, date) {
  return `${classId}_${date}`
}

// معرّف محلي بسيط لكل درس داخل القائمة (لا علاقة له بـ Firestore، فقط
// يُستعمل في الواجهة لتمييز كل سطر "سورة / من / إلى" أثناء التعديل).
export function newLessonId() {
  return Math.random().toString(36).slice(2, 10)
}

// نص جاهز للعرض لدرس واحد، مثل: "سورة النبأ — من الآية 1 إلى الآية 10".
export function formatLesson(lesson) {
  if (!lesson || !lesson.surah) return ""
  return `سورة ${surahName(lesson.surah)} — من الآية ${lesson.fromAyah} إلى الآية ${lesson.toAyah}`
}

// يُرجع حصة واحدة (أو null إن لم تُسجَّل حصة بعد لهذا القسم في هذا التاريخ).
export async function getSession(classId, date) {
  const snap = await getDoc(doc(db, COLLECTION, sessionId(classId, date)))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// ينشئ الحصة أو يستبدلها بالكامل لقسم + تاريخ معيّنين. "lessons" يجب أن
// تكون القائمة الكاملة لهذه الحصة (لا سورة واحدة تُضاف)، فالواجهة تبني
// القائمة كاملة محليًا (بنفس الطريقة التي يبني بها Progress.jsx/Attendance.jsx
// كائن "records" الخاص بهما) وهذه الدالة تكتبها دفعة واحدة فقط — كتابة واحدة
// لكل حفظ، ولا تكرار للحصة أبدًا.
export async function saveSession({ classId, className, teacherId, teacherName, date, lessons, notes }) {
  const ref = doc(db, COLLECTION, sessionId(classId, date))
  const existing = await getDoc(ref)
  const createdAt = existing.exists() ? existing.data().createdAt : Date.now()

  await setDoc(ref, {
    classId,
    className: className || "",
    teacherId,
    teacherName: teacherName || "",
    date,
    lessons: lessons || [],
    notes: notes || "",
    createdAt,
    updatedAt: Date.now(),
  })

  return sessionId(classId, date)
}

// كل الحصص المسجّلة لقسم واحد، من الأحدث إلى الأقدم.
export async function getSessionsForClass(classId) {
  const snap = await getDocs(query(collection(db, COLLECTION), where("classId", "==", classId)))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

// كل الحصص التي سجّلها أستاذ واحد (في جميع أقسامه)، من الأحدث إلى الأقدم —
// البحث يتم عبر "teacherId" كما هو محفوظ في الحصة نفسها (الصورة اللحظية)،
// فيبقى سجل الأستاذ خاصًا به حتى بعد إعادة إسناد القسم لأستاذ آخر.
export async function getSessionsForTeacher(teacherId) {
  const snap = await getDocs(query(collection(db, COLLECTION), where("teacherId", "==", teacherId)))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

// جميع الحصص عبر كل الأقسام — تُستعمل في شاشات الإدارة ("تطور الأقسام" /
// "متابعة الأساتذة" / "المتابعة البيداغوجية") التي تحتاج تجميع كل الحصص دفعة
// واحدة.
export async function getAllSessions() {
  const snap = await getDocs(collection(db, COLLECTION))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
}

// يبني نص رسالة "المطلوب مراجعته" جاهزًا للأولياء انطلاقًا من دروس حصة واحدة
// (وليس مراجعة محفوظة كحقل في كراس القسم — هذه عملية منفصلة تمامًا، كما هو
// منصوص عليه صراحة في المواصفات: "«المراجعة» ليست حقلًا في كراس القسم").
// النص قابل للتعديل من طرف المستخدم قبل الإرسال في الواجهة.
export function buildReviewMessage(session) {
  const lessons = session?.lessons || []
  const lines = [
    "السلام عليكم ورحمة الله وبركاته،",
    "",
    "نعلمكم أن المطلوب مراجعته:",
    // بدون رموز تعبيرية (emoji) ولا إرسال جماعي: كلاهما يجعل الهاتف يحوّل
    // الرسالة من SMS إلى MMS.
    ...lessons.map((l) => `سورة ${surahName(l.surah)}: من الآية ${l.fromAyah} إلى الآية ${l.toAyah}`),
    "",
    "بارك الله فيكم وجزاكم خيرًا.",
    "الجمعية القرآنية بمعتمر",
  ]
  return lines.join("\n")
}

// يحذف حصة كاملة (وليس سورة واحدة بداخلها — لحذف سورة فقط، تحذفها الواجهة من
// مصفوفة "lessons" وتستدعي saveSession من جديد لحفظ الباقي). حذف نهائي
// ومباشر، بدون نسخة في "المحذوفات" (هذا المجمّع خارج قائمة Trash.jsx
// المحدودة أصلاً بـ"students/classes/users"، تمامًا كحال "attendance" و
// "progress" حاليًا). يجب أن تطلب الواجهة تأكيدًا من المستخدم قبل استدعاء
// هذه الدالة.
export async function deleteSession(classId, date) {
  await deleteDoc(doc(db, COLLECTION, sessionId(classId, date)))
}
