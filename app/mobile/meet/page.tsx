"use client";

import { useRouter } from "next/navigation";

export default function MobileMeetElvyPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#ececec] p-4">
      <div
        className="relative overflow-hidden rounded-[40px] bg-[#f8ead8] shadow-2xl"
        style={{ width: "390px", height: "844px" }}
      >
        <img
          src="/elvy-mobile.png"
          alt="Elvy Mobile"
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />

        <div className="relative z-10 flex h-full flex-col p-5">
          <div className="mb-3 flex items-center justify-between">
            <button
              onClick={() => router.push("/mobile")}
              className="rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-[#4a2d1f] shadow"
            >
              ← Back
            </button>

            <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-[#4a2d1f] shadow">
              Meet Elvy
            </span>
          </div>

          <div className="flex-1 overflow-y-auto rounded-[28px] bg-white/95 p-5 text-[#2b1a12] shadow-2xl backdrop-blur">
            <h1 className="text-2xl font-extrabold">Meet Elvy</h1>

            <section className="mt-5 space-y-3 text-sm leading-6">
              <h2 className="text-lg font-bold">Who We Are</h2>
              <p>Happy Office is the quiet home of Elvy. It is a place created to help people communicate with calm, clarity, and respect.</p>

              <h3 className="font-bold">How Our Team Designed Elvy:</h3>
              <p>Our team comes from different backgrounds but shares one clear purpose: to support people in expressing themselves.</p>
              <p>Elvy was designed to be simple, calm, and human.</p>

              <h3 className="font-bold">Designed to Respond to Your Needs:</h3>
              <p>Elvy adapts to each situation. It helps you find the right words in the right moment.</p>

              <h3 className="font-bold">Respect Comes First:</h3>
              <p>Every response is built with respect. Elvy does not judge — it supports.</p>

              <h3 className="font-bold">We Care for People in Need:</h3>
              <p>Behind Elvy is a team that cares. The goal is to help people feel heard and supported.</p>

              <h3 className="font-bold">Your Independence Matters:</h3>
              <p>Elvy does not replace your voice — it supports it. You remain in control of your thoughts and decisions.</p>

              <h2 className="pt-4 text-lg font-bold">Vision</h2>
              <p>Elvy is designed as a helper for people. Its purpose is to support individuals in moments where they need clarity, guidance, or a better understanding of their situation.</p>
              <p>In today’s world, people face complexity, pressure, and uncertainty. Elvy is created to bring calm, structure, and meaningful support in those moments.</p>

              <h3 className="font-bold">The Main Aim:</h3>
              <p>The main aim of Elvy is to help people move forward. It supports thinking, clarifies situations, and helps individuals approach what they are facing with more confidence and balance.</p>
              <p>Elvy does not act instead of people. It helps them understand, organize, and respond in a way that fits their needs.</p>

              <h3 className="font-bold">A Helper in Real Life:</h3>
              <p>Elvy is built around real situations. It responds to what people experience in their daily lives — moments of hesitation, decisions, emotional situations, or the need for guidance.</p>

              <h3 className="font-bold">A Clear Direction:</h3>
              <p>Elvy exists to help people move forward with clarity, confidence, and respect.</p>

              <h2 className="pt-4 text-lg font-bold">About Elvy</h2>
              <p>Elvy is a calm communication character created for a noisy world. In a time when messages are fast, crowded, and often confusing, Elvy brings back simplicity, kindness, and meaning.</p>

              <h3 className="font-bold">Why Elvy Is a Postman:</h3>
              <p>Elvy was chosen as a postman because a postman carries messages between people. A postman does not speak instead of others; he helps messages arrive safely, clearly, and respectfully.</p>

              <h3 className="font-bold">What Elvy Symbolizes:</h3>
              <p>Elvy symbolizes connection. He represents the quiet bridge between what people feel and what they need to say.</p>
              <p>Elvy also symbolizes trust. He is simple, friendly, and respectful.</p>

              <h3 className="font-bold">What Makes Elvy Different:</h3>
              <p>Elvy is not a general tool. It is built around guided communication situations.</p>

              <h3 className="font-bold">A Human Feeling:</h3>
              <p>Elvy is here to bring quiet order to communication — one message at a time.</p>

              <h2 className="pt-4 text-lg font-bold">Terms & Conditions</h2>
              <p>These terms explain how Elvy works and how it should be used. By using Elvy, you agree to these conditions.</p>

              <h3 className="font-bold">Use of Information:</h3>
              <p>Elvy uses only the information provided by the user. Every response is based on what the user shares.</p>

              <h3 className="font-bold">User Responsibility:</h3>
              <p>Elvy provides guidance and support, but it does not replace personal judgment, professional advice, or decision-making.</p>

              <h3 className="font-bold">Respectful Use:</h3>
              <p>Elvy must be used in a respectful and appropriate manner.</p>

              <h3 className="font-bold">Privacy and Boundaries:</h3>
              <p>Users are encouraged not to share sensitive personal information unless necessary.</p>

              <h2 className="pt-4 text-lg font-bold">Privacy & Responsible Use</h2>
              <p>Elvy is designed as a calm communication companion that helps you express your thoughts, reflect on your ideas, and receive simple guidance for everyday situations.</p>
              <p>Elvy is not an authority and does not make decisions for you. It offers suggestions and guidance, but the final choice always remains yours.</p>
              <p>Elvy is not a doctor, not a therapist, and not a healthcare professional. It does not provide medical advice, diagnosis, or treatment.</p>
              <p>Elvy has limitations. It may misunderstand certain situations or provide incomplete responses. You should always think critically and verify important information when necessary.</p>

              <h2 className="pt-4 text-lg font-bold">Contact</h2>
              <p>Elvy is supported by the Happy Office team. You can reach out whenever you need assistance, clarification, or support.</p>
              <p>Means of Contact:</p>
              <p>Telegram · WhatsApp · Email via Happy Office</p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}