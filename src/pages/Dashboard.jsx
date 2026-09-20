// src/pages/Dashboard.jsx
// Remplace tout le contenu de ton fichier Dashboard actuel par celui-ci.
// Les données arrivent par props : branche-les sur ton code Firebase existant.

export default function Dashboard({
  // [{ id, name: "د د", level: "جزء عم", count: 2 }, ...]
  unpaidGroups = [],
  monthLabel = "سبتمبر",
  amount = 10,
  sectionsCount = 0,
  activeStudents = 0,
  onSendReminder = () => {},
}) {
  return (
    <div dir="rtl" className="px-4 py-5 space-y-5">
      {/* Titre */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        لوحة التحكم
      </h1>

      {/* Alerte abonnements impayés */}
      {unpaidGroups.length > 0 && (
        <section
          className="rounded-3xl border p-5
                     bg-red-50 border-red-200
                     dark:bg-red-950/40 dark:border-red-900"
        >
          <h2 className="text-lg font-bold text-red-700 dark:text-red-300">
            تنبيه: اشتراكات غير مدفوعة لشهر {monthLabel}
          </h2>
          <p className="mt-2 text-sm text-red-600 dark:text-red-300/80">
            يرجى التواصل مع أولياء الأمور التالية أسماؤهم لتذكيرهم بالاشتراك (
            {amount} د.ت)
          </p>

          <ul className="mt-4 space-y-3">
            {unpaidGroups.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between rounded-2xl px-4 py-4
                           bg-white dark:bg-slate-800"
              >
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">
                    {g.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {g.level}
                  </p>
                </div>
                <span className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">
                  {g.count}
                </span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={onSendReminder}
            className="mt-4 w-full rounded-full py-3 font-semibold text-white
                       bg-red-600 active:bg-red-700
                       dark:bg-red-700 dark:active:bg-red-800"
          >
            إرسال رسالة تذكير جماعية
          </button>
        </section>
      )}

      {/* Statistiques */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard value={activeStudents} label="الطلاب النشطون" />
        <StatCard value={sectionsCount} label="عدد الأقسام" />
      </div>
    </div>
  );
}

function StatCard({ value, label }) {
  return (
    <div
      className="rounded-3xl border-t-4 border-amber-500 py-6 text-center
                 bg-white dark:bg-slate-800"
    >
      <p className="text-4xl font-bold text-emerald-700 dark:text-emerald-400">
        {value}
      </p>
      <p className="mt-2 text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

/* ------------------------------------------------------------------
   Exemple d'utilisation (à adapter à ton code) :

   <Dashboard
     unpaidGroups={[
       { id: 1, name: "د د", level: "جزء عم", count: 2 },
       { id: 2, name: "ب ب", level: "حزب الأعلى", count: 2 },
     ]}
     sectionsCount={3}
     activeStudents={6}
     onSendReminder={handleReminder}
   />
------------------------------------------------------------------- */
