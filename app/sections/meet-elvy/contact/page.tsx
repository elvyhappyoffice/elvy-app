"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function ContactPage() {
  const happyOfficeEmail = "elvy.happyoffice@gmail.com";

  const [isAdmin, setIsAdmin] = useState(false);

  const LANGUAGE_CENTER_USERNAME = "center";
  const LANGUAGE_CENTER_PASSWORD = "elvycenter";

  const [showLanguageLogin, setShowLanguageLogin] = useState(false);
  const [languageUsername, setLanguageUsername] = useState("");
  const [languagePassword, setLanguagePassword] = useState("");
  const [languageLoginMessage, setLanguageLoginMessage] = useState("");

  const DEFAULT_TEXT = `Elvy is supported by the Happy Office team. You can reach out whenever you need assistance, clarification, or support.

Communication is simple and direct. Elvy uses familiar platforms such as Telegram and WhatsApp to stay accessible and easy to use.

Means of Contact:
- Telegram
- WhatsApp
- Email (via Happy Office)

If you prefer, you can contact the Happy Office team directly by email.`;

  const [text, setText] = useState(DEFAULT_TEXT);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setIsAdmin(localStorage.getItem("adminRoom") === "meet-elvy");

    const saved = localStorage.getItem("contact_text");
    if (saved) setText(saved);
  }, []);

  function saveText() {
    localStorage.setItem("contact_text", text);
    alert("Contact content updated");
  }

  function resetText() {
    localStorage.removeItem("contact_text");
    setText(DEFAULT_TEXT);
  }

  function logout() {
    localStorage.removeItem("adminRoom");
    localStorage.removeItem("adminRole");
    window.location.reload();
  }

  function sendMessage() {
    const subject = encodeURIComponent(`Contact Message from ${name}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    );

    window.location.href = `mailto:${happyOfficeEmail}?subject=${subject}&body=${body}`;
  }


  function loginToLanguageCenter() {
    const cleanUsername = languageUsername.trim().toLowerCase();
    const cleanPassword = languagePassword.trim();

    if (
      cleanUsername === LANGUAGE_CENTER_USERNAME &&
      cleanPassword === LANGUAGE_CENTER_PASSWORD
    ) {
      sessionStorage.setItem("elvy_language_center_access", "granted");
      window.location.href = "/founder/language_center";
      return;
    }

    setLanguageLoginMessage("Incorrect username or password.");
  }

  return (
    <main
      className="relative min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('/images/contact.png')" }}
    >
      {/* BACK */}
      <Link
        href="/sections/meet-elvy"
        className="absolute left-[2%] top-[4%] z-20 rounded-full bg-black px-6 py-3 text-white"
      >
        ← Back
      </Link>

      {/* PANEL */}
      <div className="absolute left-[22%] top-[22%] z-20 h-[55%] w-[55%] overflow-hidden rounded-3xl bg-white/75 p-10 shadow-xl backdrop-blur">
        <div className="h-full space-y-6 overflow-y-auto pr-4 text-[#4b2a12]">

          <h1 className="text-4xl font-bold text-[#7a3b1d]">
            Contact
          </h1>

          {/* ADMIN MODE */}
          {isAdmin ? (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full h-[250px] p-3 rounded text-black"
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
            <>
              <div className="text-lg whitespace-pre-line leading-relaxed">
                {text}
              </div>

              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-4 rounded-xl bg-[#7a3b1d] px-6 py-3 font-bold text-white shadow hover:bg-[#5f2d15]"
                >
                  Contact Happy Office
                </button>
              )}

              {showForm && (
                <div className="mt-4 rounded-2xl bg-white/80 p-5 shadow">
                  <p className="mb-3 text-lg font-semibold text-[#7a3b1d]">
                    Send an Email
                  </p>

                  <input
                    value={happyOfficeEmail}
                    readOnly
                    className="mb-4 w-full rounded-xl border px-4 py-3"
                  />

                  <input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mb-4 w-full rounded-xl border px-4 py-3"
                  />

                  <input
                    type="email"
                    placeholder="Your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mb-4 w-full rounded-xl border px-4 py-3"
                  />

                  <textarea
                    placeholder="Write your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="mb-4 h-32 w-full rounded-xl border px-4 py-3"
                  />

                  <button
                    onClick={sendMessage}
                    className="rounded-xl bg-[#7a3b1d] px-6 py-3 font-bold text-white"
                  >
                    Send Message
                  </button>
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {/* ADMIN / LANGUAGE CENTER ACCESS */}
      <div className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-4 text-xs">
        <Link
          href="/admin"
          className="text-[#6b4c3b]/70 hover:text-[#7a3b1d]"
        >
          admin access
        </Link>

        <button
          type="button"
          onClick={() => {
            setShowLanguageLogin(true);
            setLanguageLoginMessage("");
          }}
          className="text-[#1f6b2b]/80 hover:text-[#1f6b2b]"
        >
          language center access
        </button>
      </div>

      {showLanguageLogin && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/35 backdrop-blur-sm">
          <div className="w-[360px] rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-extrabold text-[#1f6b2b]">
              Language Center Login
            </h2>

            <p className="mt-2 text-sm text-[#6b5a4c]">
              Enter the center username and password to open the Language Center dashboard.
            </p>

            <input
              type="text"
              value={languageUsername}
              onChange={(e) => setLanguageUsername(e.target.value)}
              placeholder="Username"
              className="mt-5 w-full rounded-xl border border-[#ead8c0] px-4 py-3 text-black outline-none"
            />

            <input
              type="password"
              value={languagePassword}
              onChange={(e) => setLanguagePassword(e.target.value)}
              placeholder="Password"
              onKeyDown={(e) => {
                if (e.key === "Enter") loginToLanguageCenter();
              }}
              className="mt-3 w-full rounded-xl border border-[#ead8c0] px-4 py-3 text-black outline-none"
            />

            {languageLoginMessage && (
              <p className="mt-3 text-sm font-bold text-red-600">
                {languageLoginMessage}
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={loginToLanguageCenter}
                className="flex-1 rounded-xl bg-[#1f6b2b] px-5 py-3 font-bold text-white shadow active:scale-[0.98]"
              >
                Login
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowLanguageLogin(false);
                  setLanguageUsername("");
                  setLanguagePassword("");
                  setLanguageLoginMessage("");
                }}
                className="flex-1 rounded-xl bg-[#f1e1cf] px-5 py-3 font-bold text-[#3b2418] shadow active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}