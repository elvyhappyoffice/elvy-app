"use client";

import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-black">
      <img
        src="/office.jpg"
        alt="Front page"
        className="absolute inset-0 h-full w-full"
        style={{
          objectFit: "cover",
          objectPosition: "center",
        }}
      />

      <div className="absolute inset-0 bg-black/15" />

      <button
        onClick={() => router.push("/happy-office")}
        className="absolute rounded-full border border-white/40 bg-white/10 backdrop-blur-sm transition hover:scale-105 hover:bg-white/20"
        style={{
          left: "clamp(40%, 42vw, 43%)",
          top: "clamp(31%, 35vh, 36%)",
          width: "clamp(54px, 11vw, 70px)",
          height: "clamp(54px, 11vw, 70px)",
        }}
        aria-label="Enter Happy Office"
        title="Enter Happy Office"
      />

      <div
        className="absolute rounded-full bg-white/85 px-4 py-2 text-center text-xs font-medium text-stone-800 shadow sm:text-sm"
        style={{
          left: "50%",
          top: "clamp(55%, 58vh, 60%)",
          transform: "translateX(-50%)",
          width: "max-content",
          maxWidth: "88vw",
        }}
      >
        WELCOME TO HAPPY OFFICE
      </div>
    </main>
  );
}
