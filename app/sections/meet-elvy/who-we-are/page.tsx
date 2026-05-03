"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function WhoWeArePage() {
  const [isAdmin, setIsAdmin] = useState(false);

  const DEFAULT_TEXT = `Happy Office is the quiet home of Elvy. It is a place created to help people communicate with calm, clarity, and respect.

How Our Team Designed Elvy:
Our team comes from different backgrounds but shares one clear purpose: to support people in expressing themselves.

Elvy was designed to be simple, calm, and human.

Designed to Respond to Your Needs:
Elvy adapts to each situation. It helps you find the right words in the right moment.

Respect Comes First:
Every response is built with respect. Elvy does not judge — it supports.

We Care for People in Need:
Behind Elvy is a team that cares. The goal is to help people feel heard and supported.

Your Independence Matters:
Elvy does not replace your voice — it supports it. You remain in control of your thoughts and decisions.`;

  const [text, setText] = useState(DEFAULT_TEXT);

  useEffect(() => {
    setIsAdmin(localStorage.getItem("adminRoom") === "meet-elvy");

    const saved = localStorage.getItem("who_text");
    if (saved) setText(saved);
  }, []);

  function saveText() {
    localStorage.setItem("who_text", text);
    alert("Who We Are updated");
  }

  function resetText() {
    localStorage.removeItem("who_text");
    setText(DEFAULT_TEXT);
  }

  function logout() {
    localStorage.removeItem("adminRoom");
    localStorage.removeItem("adminRole");
    window.location.reload();
  }

  return (
    <main
      className="relative min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('/images/who-we-are.png')" }}
    >
      {/* BACK */}
      <Link
        href="/sections/meet-elvy"
        className="absolute left-[2%] top-[4%] z-20 rounded-full bg-black px-6 py-3 text-white"
      >
        ← Back
      </Link>

      {/* PANEL */}
      <div className="absolute left-[22%] top-[22%] w-[55%] h-[55%] z-20 rounded-3xl bg-white/75 backdrop-blur shadow-xl p-10 overflow-hidden">
        
        <div className="h-full overflow-y-auto pr-4 space-y-6 text-[#4b2a12]">

          <h1 className="text-4xl font-bold text-[#7a3b1d]">
            Who We Are
          </h1>

          {/* ADMIN MODE */}
          {isAdmin ? (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full h-[300px] p-3 rounded text-black"
              />

              <div className="flex gap-2 mt-3 flex-wrap">
                <button
                  onClick={saveText}
                  className="bg-green-600 px-4 py-2 rounded text-white"
                >
                  Save / Modify
                </button>

                <button
                  onClick={resetText}
                  className="bg-yellow-600 px-4 py-2 rounded text-white"
                >
                  Reset
                </button>

                <button
                  onClick={logout}
                  className="bg-gray-600 px-4 py-2 rounded text-white"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            /* VISITOR MODE */
            <div className="text-lg whitespace-pre-line leading-relaxed">
              {text}
            </div>
          )}

        </div>
      </div>
    </main>
  );
}