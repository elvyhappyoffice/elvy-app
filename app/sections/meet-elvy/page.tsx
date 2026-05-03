"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const buttons = [
  { title: "Who We Are", href: "/sections/meet-elvy/who-we-are" },
  { title: "About Elvy", href: "/sections/meet-elvy/about-elvy" },
  { title: "Vision", href: "/sections/meet-elvy/vision" },
  { title: "Terms & Conditions", href: "/sections/meet-elvy/terms" },
  { title: "Contact", href: "/sections/meet-elvy/contact" },
  { title: "Privacy", href: "/sections/meet-elvy/privacy" },
];

export default function MeetElvyPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [roomClosed, setRoomClosed] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);
  const [role, setRole] = useState<string | null>(null);

useEffect(() => {
  setRole(localStorage.getItem("adminRole"));
}, []);

  useEffect(() => {
    const adminRoom = localStorage.getItem("adminRoom");
    const closed = localStorage.getItem("meet_elvy_closed");

    setIsAdmin(adminRoom === "meet-elvy");
    setRoomClosed(closed === "true");
  }, []);

  function toggleRoom() {
    const newState = !roomClosed;
    setRoomClosed(newState);
    localStorage.setItem("meet_elvy_closed", String(newState));
  }

  function logout() {
    localStorage.removeItem("adminRole");
    localStorage.removeItem("adminRoom");
    localStorage.removeItem("adminUsername");
    window.location.reload();
  }

  if (roomClosed && !isAdmin) {
    return (
      <main className="relative h-screen w-screen overflow-hidden bg-black text-white">
        <img
          src="/images/meet-elvy.png"
          alt="Meet Elvy Background"
          className="absolute inset-0 h-full w-full object-fill opacity-40"
        />

        <Link
          href="/happy-office"
          className="absolute left-[2%] top-[4%] z-20 rounded-full bg-black px-6 py-3 text-white shadow-lg"
        >
          ← Back to Office
        </Link>

        <div className="absolute left-1/2 top-1/2 z-20 w-[80%] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-black/75 p-8 text-center shadow-lg">
          <h1 className="mb-4 text-3xl font-bold">Meet Elvy Room</h1>
          <p className="text-lg">
            This room is currently closed for updates. Please come back later.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <img
        src="/images/meet-elvy.png"
        alt="Meet Elvy Background"
        className="absolute inset-0 h-full w-full object-fill"
      />

{role === "founder" ? (
  <button
    onClick={() => {
      window.location.href = "/founder/dashboard";
    }}
    className="absolute left-[2%] top-[4%] z-30 rounded-full bg-black px-6 py-3 text-white"
  >
    ← Back to Dashboard
  </button>
) : (
  <Link
    href="/happy-office"
    className="absolute left-[2%] top-[4%] z-30 rounded-full bg-black px-6 py-3 text-white"
  >
    ← Back to Happy Office
  </Link>
)}

      <div className="absolute left-[20%] top-[32%] z-20 w-[50%]">
        <div className="grid grid-cols-2 gap-5">
          {buttons.map((btn) => (
            <Link
              key={btn.href}
              href={btn.href}
              className="rounded-2xl bg-white/80 px-6 py-4 text-center text-2xl font-bold text-[#7a3b1d] shadow-md backdrop-blur hover:bg-white"
            >
              {btn.title}
            </Link>
          ))}
        </div>
      </div>

      {isAdmin && (
        <div className="absolute bottom-[4%] left-[3%] z-30 w-[360px] rounded-2xl bg-black/75 p-4 text-white shadow-xl backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Meet Elvy Admin Dashboard</h2>

            <button
              onClick={() => setShowDashboard(!showDashboard)}
              className="rounded bg-white px-3 py-1 text-sm font-bold text-black"
            >
              {showDashboard ? "Hide" : "Show"}
            </button>
          </div>

          {showDashboard && (
            <>
              <p className="mb-3 text-sm">
                Room Status:{" "}
                <span
                  className={
                    roomClosed
                      ? "font-bold text-red-400"
                      : "font-bold text-green-400"
                  }
                >
                  {roomClosed ? "Closed" : "Open"}
                </span>
              </p>

              <div className="grid grid-cols-1 gap-2">
                <Link
                  href="/sections/meet-elvy/who-we-are"
                  className="rounded bg-white/90 px-3 py-2 text-center font-bold text-black hover:bg-white"
                >
                  Edit Who We Are
                </Link>

                <Link
                  href="/sections/meet-elvy/about-elvy"
                  className="rounded bg-white/90 px-3 py-2 text-center font-bold text-black hover:bg-white"
                >
                  Edit About Elvy
                </Link>

                <Link
                  href="/sections/meet-elvy/vision"
                  className="rounded bg-white/90 px-3 py-2 text-center font-bold text-black hover:bg-white"
                >
                  Edit Vision
                </Link>

                <Link
                  href="/sections/meet-elvy/terms"
                  className="rounded bg-white/90 px-3 py-2 text-center font-bold text-black hover:bg-white"
                >
                  Edit Terms & Conditions
                </Link>

                <Link
                  href="/sections/meet-elvy/contact"
                  className="rounded bg-white/90 px-3 py-2 text-center font-bold text-black hover:bg-white"
                >
                  Edit Contact
                </Link>

                <Link
                  href="/sections/meet-elvy/privacy"
                  className="rounded bg-white/90 px-3 py-2 text-center font-bold text-black hover:bg-white"
                >
                  Edit Privacy
                </Link>

                <button
                  onClick={toggleRoom}
                  className={`rounded px-3 py-2 font-bold text-white ${
                    roomClosed ? "bg-green-700" : "bg-red-700"
                  }`}
                >
                  {roomClosed ? "Open Room" : "Close Room"}
                </button>

                <button
                  onClick={logout}
                  className="rounded bg-gray-700 px-3 py-2 font-bold text-white hover:bg-gray-600"
                >
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </main>
  );
}