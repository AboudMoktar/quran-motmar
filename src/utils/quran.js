export const SURAHS = [
  { number: 114, name: "الناس" }, { number: 113, name: "الفلق" }, { number: 112, name: "الإخلاص" },
  { number: 111, name: "المسد" }, { number: 110, name: "النصر" }, { number: 109, name: "الكافرون" },
  { number: 108, name: "الكوثر" }, { number: 107, name: "الماعون" }, { number: 106, name: "قريش" },
  { number: 105, name: "الفيل" }, { number: 104, name: "الهمزة" }, { number: 103, name: "العصر" },
  { number: 102, name: "التكاثر" }, { number: 101, name: "القارعة" }, { number: 100, name: "العاديات" },
  { number: 99, name: "الزلزلة" }, { number: 98, name: "البينة" }, { number: 97, name: "القدر" },
  { number: 96, name: "العلق" }, { number: 95, name: "التين" }, { number: 94, name: "الشرح" },
  { number: 93, name: "الضحى" }, { number: 92, name: "الليل" }, { number: 91, name: "الشمس" },
  { number: 90, name: "البلد" }, { number: 89, name: "الفجر" }, { number: 88, name: "الغاشية" },
  { number: 87, name: "الأعلى" }, { number: 86, name: "الطارق" }, { number: 85, name: "البروج" },
  { number: 84, name: "الانشقاق" }, { number: 83, name: "المطففين" }, { number: 82, name: "الانفطار" },
  { number: 81, name: "التكوير" }, { number: 80, name: "عبس" }, { number: 79, name: "النازعات" },
  { number: 78, name: "النبأ" }, { number: 77, name: "المرسلات" }, { number: 76, name: "الإنسان" },
  { number: 75, name: "القيامة" }, { number: 74, name: "المدثر" }, { number: 73, name: "المزمل" },
  { number: 72, name: "الجن" }, { number: 71, name: "نوح" }, { number: 70, name: "المعارج" },
  { number: 69, name: "الحاقة" }, { number: 68, name: "القلم" }, { number: 67, name: "الملك" },
  { number: 66, name: "التحريم" }, { number: 65, name: "الطلاق" }, { number: 64, name: "التغابن" },
  { number: 63, name: "المنافقون" }, { number: 62, name: "الجمعة" }, { number: 61, name: "الصف" },
  { number: 60, name: "الممتحنة" }, { number: 59, name: "الحشر" }, { number: 58, name: "المجادلة" },
  { number: 57, name: "الحديد" }, { number: 56, name: "الواقعة" }, { number: 55, name: "الرحمن" },
  { number: 54, name: "القمر" }, { number: 53, name: "النجم" }, { number: 52, name: "الطور" },
  { number: 51, name: "الذاريات" }, { number: 50, name: "ق" }, { number: 49, name: "الحجرات" },
  { number: 48, name: "الفتح" }, { number: 47, name: "محمد" }, { number: 46, name: "الأحقاف" },
  { number: 45, name: "الجاثية" }, { number: 44, name: "الدخان" }, { number: 43, name: "الزخرف" },
  { number: 42, name: "الشورى" }, { number: 41, name: "فصلت" }, { number: 40, name: "غافر" },
  { number: 39, name: "الزمر" }, { number: 38, name: "ص" }, { number: 37, name: "الصافات" },
  { number: 36, name: "يس" }, { number: 35, name: "فاطر" }, { number: 34, name: "سبأ" },
  { number: 33, name: "الأحزاب" }, { number: 32, name: "السجدة" }, { number: 31, name: "لقمان" },
  { number: 30, name: "الروم" }, { number: 29, name: "العنكبوت" }, { number: 28, name: "القصص" },
  { number: 27, name: "النمل" }, { number: 26, name: "الشعراء" }, { number: 25, name: "الفرقان" },
  { number: 24, name: "النور" }, { number: 23, name: "المؤمنون" }, { number: 22, name: "الحج" },
  { number: 21, name: "الأنبياء" }, { number: 20, name: "طه" }, { number: 19, name: "مريم" },
  { number: 18, name: "الكهف" }, { number: 17, name: "الإسراء" }, { number: 16, name: "النحل" },
  { number: 15, name: "الحجر" }, { number: 14, name: "إبراهيم" }, { number: 13, name: "الرعد" },
  { number: 12, name: "يوسف" }, { number: 11, name: "هود" }, { number: 10, name: "يونس" },
  { number: 9, name: "التوبة" }, { number: 8, name: "الأنفال" }, { number: 7, name: "الأعراف" },
  { number: 6, name: "الأنعام" }, { number: 5, name: "المائدة" }, { number: 4, name: "النساء" },
  { number: 3, name: "آل عمران" }, { number: 2, name: "البقرة" }, { number: 1, name: "الفاتحة" },
]

export const TAJWID_OPTIONS = ["ممتاز", "جيد", "يحتاج إلى تحسين"]
export const HIFZ_OPTIONS = ["ممتاز", "جيد", "يحتاج مراجعة", "لم يحفظ"]

export function surahName(num) {
  return SURAHS.find((s) => s.number === num)?.name || "-"
}

export function progressPercent(num) {
  if (!num) return 0
  return Math.round(((115 - num) / 114) * 100)
}
