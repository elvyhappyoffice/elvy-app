"use client";

import { useRouter } from "next/navigation";

export default function LanguageCenterPage() {
  const router = useRouter();

  function logoutLanguageCenter() {
    sessionStorage.removeItem("elvy_language_center_access");
    router.push("/sections/meet-elvy");
  }

  return (
    <main className="min-h-screen bg-[#f4efe8] p-6 text-[#2b1a12]">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-extrabold">Language Center</h1>
            <p className="mt-2 text-sm font-medium text-[#6b5a4c]">
              Manage curriculum, students, levels, lessons, and learning access.
            </p>
          </div>

          <button
            onClick={logoutLanguageCenter}
            className="rounded-xl bg-red-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-red-700 active:scale-[0.98]"
          >
            Logout
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">

          <section className="rounded-3xl bg-white p-6 shadow">
            <div className="mb-4 text-4xl">📚</div>

            <h2 className="text-2xl font-extrabold">
              Curriculum Dashboard
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#6b5a4c]">
              Manage levels, sublevels, units, and uploaded lessons for Elvy
              Language Center.
            </p>

            <button
              onClick={() => router.push("/founder/curriculum")}
              className="mt-4 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm active:scale-[0.98]"
            >
              Open Curriculum
            </button>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow">
            <div className="mb-4 text-4xl">👨‍🎓</div>

            <h2 className="text-2xl font-extrabold">
              Students Dashboard
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#6b5a4c]">
              Add students, generate usernames, passwords, student codes, and
              assign learning levels.
            </p>

            <button
              onClick={() => router.push("/founder/students")}
              className="mt-4 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-sm active:scale-[0.98]"
            >
              Open Students
            </button>
          </section>

        </div>
      </div>
    </main>
  );
}