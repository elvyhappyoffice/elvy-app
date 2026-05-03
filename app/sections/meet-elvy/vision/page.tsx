"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function VisionPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  const DEFAULT_TEXT = `Elvy is designed as a helper for people. Its purpose is to support individuals in moments where they need clarity, guidance, or a better understanding of their situation.

In today’s world, people face complexity, pressure, and uncertainty. Elvy is created to bring calm, structure, and meaningful support in those moments.

The Main Aim:
The main aim of Elvy is to help people move forward. It supports thinking, clarifies situations, and helps individuals approach what they are facing with more confidence and balance.

Elvy does not act instead of people. It helps them understand, organize, and respond in a way that fits their needs.

A Helper in Real Life:
Elvy is built around real situations. It responds to what people experience in their daily lives — moments of hesitation, decisions, emotional situations, or the need for guidance.

It provides structured help that is calm, respectful, and adapted to each context.

What the Team Expects:
The team expects Elvy to become a trusted presence. A system that people can rely on when they need support, clarity, or direction.

Every response is expected to remain simple, human, and respectful.

Respect and Independence:
Elvy is built on respect for the individual. It supports without controlling. It guides without deciding.

The person always remains in control.

Growth and Expansion:
Elvy is designed to grow across different areas of life — personal, educational, and professional.

A Clear Direction:
Elvy exists to help people move forward with clarity, confidence, and respect.`;

  const [text, setText] = useState(DEFAULT_TEXT);

  useEffect(() => {
    setIsAdmin(localStorage.getItem("adminRoom") === "meet-elvy");

    const saved = localStorage.getItem("vision_text");
    if (saved) setText(saved);
  }, []);

  function saveText() {
    localStorage.setItem("vision_text", text);
    alert("Vision updated");
  }

  function resetText() {
    localStorage.removeItem("vision_text");
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
      style={{ backgroundImage: "url('/images/vision.png')" }}
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
            Vision
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