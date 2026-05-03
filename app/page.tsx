"use client";

import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  return (
    <main className="relative h-screen w-full overflow-hidden bg-black">
<img
  src="/office.jpg"
  alt="Front page"
  className="absolute inset-0 h-full w-full"
  style={{ objectFit: "fill" }}
/>

      <div className="absolute inset-0 bg-black/15" />

      <button
        onClick={() => router.push("/happy-office")}
        className="absolute rounded-full border border-white/40 bg-white/10 backdrop-blur-sm transition hover:scale-105 hover:bg-white/20"
        style={{
          left: "42%",
          top: "35%",
          width: "70px",
          height: "70px",
        }}
        aria-label="Enter Happy Office"
        title="Enter Happy Office"
      />

<div
  className="absolute rounded-full bg-white/85 px-4 py-2 text-sm font-medium text-stone-800 shadow"
  style={{
    left: "45%",
    top: "58%",
    transform: "translateX(-50%)",
  }}
>
  WELCOME TO HAPPY OFFICE
</div>
    </main>
  );
}