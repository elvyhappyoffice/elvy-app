"use client";

import { useRouter } from "next/navigation";

export default function HappyOfficePage() {
  const router = useRouter();

  return (
    <main className="relative h-screen w-full overflow-hidden bg-black">
      <img
        src="/inside.png"
        alt="Happy Office"
        className="absolute inset-0 h-full w-full"
        style={{ objectFit: "fill" }}
      />

      <div className="absolute inset-0 bg-black/5" />

      {/* DAILY SUPPORT */}
      <button
        onClick={() => router.push("/sections/daily-support")}
        className="absolute rounded-xl bg-white/10 transition hover:bg-white/20"
        style={{ left: "16%", top: "28%", width: "18%", height: "42%" }}
        title="Daily Support"
      />

      {/* TALK TO ELVY */}
      <button
        onClick={() => router.push("/sections/talk-to-elvy")}
        className="absolute rounded-xl bg-white/10 transition hover:bg-white/20"
        style={{ left: "40%", top: "36%", width: "22%", height: "42%" }}
        title="Talk to Elvy"
      />

      {/* MEET ELVY */}
      <button
        onClick={() => router.push("/sections/meet-elvy")}
        className="absolute rounded-xl bg-white/10 transition hover:bg-white/20"
        style={{ left: "78%", top: "20%", width: "18%", height: "45%" }}
        title="Meet Elvy"
      />

      <a
        href="/elvy-login"
        className="absolute bottom-4 right-4 text-xs text-white/40 hover:text-white/80"
      >
        Elvy Access
      </a>
    </main>
  );
}