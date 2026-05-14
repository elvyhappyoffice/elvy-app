"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MobileTalkPage() {
  const router = useRouter();

  const [accepted, setAccepted] = useState(false);

  return (
    <main className="min-h-screen bg-[#f7eadb] px-4 py-5 text-[#3b2418]">
      <div className="mx-auto flex max-w-sm flex-col">
        {/* HEADER */}
        <button
          onClick={() => router.push("/mobile")}
          className="mb-4 w-fit rounded-full bg-white/80 px-4 py-2 text-sm shadow"
        >
          ← Back
        </button>

        <div className="rounded-[35px] bg-white/70 p-5 shadow-xl backdrop-blur">
          <h1 className="text-3xl font-bold">Talk to Elvy</h1>

          <p className="mt-3 text-sm leading-6 text-[#6b5a4c]">
            Calm communication support from Happy Office.
          </p>

          {!accepted ? (
            <>
              {/* TERMS */}
              <div className="mt-6 rounded-3xl bg-[#f3e3d0] p-4 text-sm leading-6 text-[#5c4b3f]">
                <p>
                  By continuing, you agree to use Elvy respectfully and
                  understand that Elvy provides communication guidance only.
                </p>

                <p className="mt-3">
                  Elvy does not replace professional medical, legal, or emergency
                  services.
                </p>

                <p className="mt-3">
                  Happy Office keeps communication simple and private.
                </p>
              </div>

              <button
                onClick={() => setAccepted(true)}
                className="mt-6 w-full rounded-3xl bg-[#4a2d1f] px-5 py-4 text-lg font-semibold text-white shadow-lg"
              >
                I Agree and Continue
              </button>
            </>
          ) : (
            <>
              {/* CHAT BOX */}
              <div className="mt-6 flex h-[420px] flex-col rounded-3xl bg-[#fffaf4] p-4 shadow-inner">
                {/* ELVY MESSAGE */}
                <div className="max-w-[85%] rounded-3xl rounded-bl-md bg-[#e9d7c2] px-4 py-3 text-sm leading-6 shadow">
                  Welcome to Happy Office.  
                  I’m Elvy.  
                  I’m here to help you communicate calmly and clearly.
                </div>

                <div className="mt-auto flex items-center gap-2 pt-4">
                  <input
                    type="text"
                    placeholder="Write your message..."
                    className="flex-1 rounded-2xl border border-[#e2d2bf] bg-white px-4 py-3 text-sm outline-none"
                  />

                  <button className="rounded-2xl bg-[#4a2d1f] px-5 py-3 text-white shadow">
                    Send
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}