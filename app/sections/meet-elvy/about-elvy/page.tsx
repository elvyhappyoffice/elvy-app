"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AboutElvyPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  const DEFAULT_TEXT = `Elvy is a calm communication character created for a noisy world. In a time when messages are fast, crowded, and often confusing, Elvy brings back simplicity, kindness, and meaning.

Why Elvy Is a Postman:
Elvy was chosen as a postman because a postman carries messages between people. A postman does not speak instead of others; he helps messages arrive safely, clearly, and respectfully.

This image gives Elvy a universal meaning. Across cultures, people understand the value of a message, a letter, a greeting, an apology, or a simple sign of care.

What Elvy Symbolizes:
Elvy symbolizes connection. He represents the quiet bridge between what people feel and what they need to say.

Elvy also symbolizes trust. He is simple, friendly, and respectful.

A Character for a Messy World:
Elvy was created to offer another way: slower, clearer, softer, and more human.

He helps people organize their thoughts and express themselves with care.

What Makes Elvy Different:
Elvy is not a general tool. It is built around guided communication situations.

A Respectful Communication Vision:
Elvy supports without controlling. It guides without deciding.

A Human Feeling:
Elvy is here to bring quiet order to communication — one message at a time.`;

  const [text, setText] = useState(DEFAULT_TEXT);

  useEffect(() => {
    setIsAdmin(localStorage.getItem("adminRoom") === "meet-elvy");

    const saved = localStorage.getItem("about_text");
    if (saved) setText(saved);
  }, []);

  function saveText() {
    localStorage.setItem("about_text", text);
    alert("About Elvy updated");
  }

  function resetText() {
    localStorage.removeItem("about_text");
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
      style={{ backgroundImage: "url('/images/about-elvy.png')" }}
    >
      {/* BACK */}
      <Link
        href="/sections/meet-elvy"
        className="absolute left-[2%] top-[4%] z-20 rounded-full bg-black px-6 py-3 text-white"
      >
        ← Back
      </Link>

      {/* PANEL */}
      <div className="absolute left-[22%] top-[22%] w-[52%] h-[55%] z-20 rounded-3xl bg-white/75 backdrop-blur shadow-xl p-10 overflow-hidden">
        
        <div className="h-full overflow-y-auto pr-4 space-y-6 text-[#4b2a12]">

          <h1 className="text-4xl font-bold text-[#7a3b1d]">
            About Elvy
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