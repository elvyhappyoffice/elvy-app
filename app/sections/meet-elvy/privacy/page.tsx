"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const DEFAULT_TEXT = `Dear reader,

Elvy is designed as a calm communication companion that helps you express your thoughts, reflect on your ideas, and receive simple guidance for everyday situations. It is built to support you in a human, respectful, and meaningful way. However, it is important to clearly understand the role of Elvy before using it.

Elvy is not an authority and does not make decisions for you. It offers suggestions and guidance, but the final choice always remains yours. You are responsible for how you use the information provided. Elvy should be used as a supportive tool, not as a source of absolute truth.

Elvy is not a doctor, not a therapist, and not a healthcare professional. It does not provide medical advice, diagnosis, or treatment. Any health-related information shared by Elvy is general and should not be considered professional guidance. If you experience any health issues, symptoms, or concerns, you must consult a qualified healthcare professional. Your health and safety should always be handled by real experts.

Elvy respects your privacy and is designed to provide a safe and trustworthy experience. Any information you choose to share is used only to improve communication and make responses more relevant. Elvy does not aim to misuse, exploit, or manipulate your data. The goal is to create a respectful space where users feel comfortable and secure.

It is also important to understand that Elvy, like any system, has limitations. It may misunderstand certain situations or provide incomplete responses. For this reason, you should always think critically and verify important information when necessary. Elvy is a guide for communication, not a replacement for professional judgment or real-world expertise.

By using Elvy, you agree to use it responsibly and respectfully. It should not be used for harmful, misleading, or abusive purposes. Elvy is built to encourage positive communication and thoughtful interaction.

In the end, Elvy is here to help you find the right words, reflect on your thoughts, and navigate daily situations with more clarity. Use it as a companion, not as an authority, and always rely on qualified professionals when it truly matters.`;

export default function PrivacyPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [text, setText] = useState(DEFAULT_TEXT);

  useEffect(() => {
    const adminRoom = localStorage.getItem("adminRoom");
    setIsAdmin(adminRoom === "meet-elvy");

    const saved = localStorage.getItem("privacy_text");
    if (saved) setText(saved);
  }, []);

  function saveText() {
    localStorage.setItem("privacy_text", text);
    alert("Privacy updated");
  }

  function resetText() {
    setText(DEFAULT_TEXT);
    localStorage.removeItem("privacy_text");
  }

  function logout() {
    localStorage.removeItem("adminRoom");
    localStorage.removeItem("adminRole");
    window.location.reload();
  }

  return (
    <main
      className="min-h-screen w-full bg-cover bg-center flex items-center justify-center"
      style={{ backgroundImage: "url('/images/inside.JPEG')" }}
    >
      <div className="bg-black/60 p-6 rounded-2xl max-w-3xl w-[90%] text-white overflow-y-auto max-h-[85vh]">

        <h1 className="text-3xl font-bold mb-4 text-center">
          Privacy & Responsible Use
        </h1>

        {/* ADMIN MODE */}
        {isAdmin ? (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-[300px] text-black p-3 rounded mb-4"
            />

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={saveText}
                className="bg-green-600 px-4 py-2 rounded"
              >
                Save / Modify
              </button>

              <button
                onClick={resetText}
                className="bg-yellow-600 px-4 py-2 rounded"
              >
                Reset
              </button>

              <button
                onClick={logout}
                className="bg-gray-600 px-4 py-2 rounded"
              >
                Logout
              </button>
            </div>
          </>
        ) : (
          /* VISITOR MODE */
          <div className="space-y-4 text-sm leading-relaxed whitespace-pre-line">
            {text}
          </div>
        )}

        {/* BACK */}
        <div className="mt-6 text-center">
          <Link
            href="/sections/meet-elvy"
            className="inline-block bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-200"
          >
            Back
          </Link>
        </div>
      </div>
    </main>
  );
}