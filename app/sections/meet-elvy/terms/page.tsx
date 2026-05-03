"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function TermsPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  const DEFAULT_TEXT = `These terms explain how Elvy works and how it should be used.
By using Elvy, you agree to these conditions.

Use of Information:
Elvy uses only the information provided by the user. Every response is based on what the user shares.
The user is fully responsible for the accuracy, truth, and content of the information they provide.

User Responsibility:
Elvy provides guidance and support, but it does not replace personal judgment, professional advice, or decision-making.
The user remains responsible for all actions, decisions, and outcomes based on the use of Elvy.

Nature of Elvy:
Elvy is not a software that needs to be installed. It is a communication and support system accessible through available contact channels.

Communication Channels:
Elvy operates through messaging platforms such as Telegram and WhatsApp.
The availability of these platforms depends on their own services.

Respectful Use:
Elvy must be used in a respectful and appropriate manner.

Privacy and Boundaries:
Users are encouraged not to share sensitive personal information unless necessary.

Service Evolution:
Elvy may evolve and improve over time.

Final Note:
Elvy is designed to help, guide, and support.`;

  const [text, setText] = useState(DEFAULT_TEXT);

  useEffect(() => {
    setIsAdmin(localStorage.getItem("adminRoom") === "meet-elvy");

    const saved = localStorage.getItem("terms_text");
    if (saved) setText(saved);
  }, []);

  function saveText() {
    localStorage.setItem("terms_text", text);
    alert("Terms updated");
  }

  function resetText() {
    localStorage.removeItem("terms_text");
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
      style={{ backgroundImage: "url('/images/terms.png')" }}
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
            Terms & Conditions
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