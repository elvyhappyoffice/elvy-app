"use client";

import { useEffect, useState } from "react";
import ElvyTorso, {
  type AnimationState,
  type EyeDirection,
  type EyebrowState,
  type EyelidState,
  type MouthState,
} from "@/components/elvy/studio/ElvyTorso";

const eyes: EyeDirection[] = ["neutral", "left", "right", "up", "down"];
const eyelids: EyelidState[] = ["open", "half", "closed"];
const eyebrows: EyebrowState[] = ["neutral", "raised", "lowered", "concerned"];
const mouths: MouthState[] = ["neutral", "smile", "closed-smile", "open", "wide-open", "a-e", "o", "u", "m-b-p", "laugh"];
const animations: AnimationState[] = ["neutral", "idle", "speaking", "listening"];
const speechMouths: MouthState[] = ["m-b-p", "a-e", "o", "open", "u", "closed-smile"];
function Buttons<T extends string>({ values, value, onChange }: { values: readonly T[]; value: T; onChange: (value: T) => void }) {
  return <div className="mt-3 flex flex-wrap gap-2">{values.map((item) => <button key={item} type="button" onClick={() => onChange(item)} className={`rounded-xl border px-3 py-2 text-xs font-black capitalize ${value === item ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600"}`}>{item.replaceAll("-", " ")}</button>)}</div>;
}

export default function ElvyStudioPage() {
  const [eyeDirection, setEyeDirection] = useState<EyeDirection>("neutral");
  const [eyelidState, setEyelidState] = useState<EyelidState>("open");
  const [eyebrowState, setEyebrowState] = useState<EyebrowState>("neutral");
  const [mouthState, setMouthState] = useState<MouthState>("smile");
  const [autoBlink, setAutoBlink] = useState(true);
  const [animationState, setAnimationState] = useState<AnimationState>("neutral");

  useEffect(() => {
    setEyeDirection("neutral");
    setAutoBlink(animationState !== "neutral");

    if (animationState === "idle") {
      setEyebrowState("neutral");
      setMouthState("smile");
    } else if (animationState === "listening") {
      setEyebrowState("raised");
      setMouthState("closed-smile");
    } else if (animationState === "neutral") {
      setEyebrowState("neutral");
      setMouthState("smile");
    }
  }, [animationState]);

  useEffect(() => {
    if (animationState !== "speaking") return;
    let frame = 0;
    setEyebrowState("raised");
    setMouthState(speechMouths[frame]);
    const interval = window.setInterval(() => {
      frame = (frame + 1) % speechMouths.length;
      setMouthState(speechMouths[frame]);
    }, 140);
    return () => window.clearInterval(interval);
  }, [animationState]);

  useEffect(() => {
    if (!autoBlink) return;
    const interval = window.setInterval(() => {
      setEyelidState("half");
      window.setTimeout(() => setEyelidState("closed"), 90);
      window.setTimeout(() => setEyelidState("half"), 180);
      window.setTimeout(() => setEyelidState("open"), 270);
    }, 4200);
    return () => window.clearInterval(interval);
  }, [autoBlink]);

  return (
    <main className="min-h-screen bg-[#eef4f2] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[28px] bg-gradient-to-r from-[#083f3a] to-[#117164] px-6 py-7 text-white shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-200">Founder Workspace</p>
          <h1 className="mt-2 text-3xl font-black">Elvy Animation Studio</h1>
          <p className="mt-2 text-sm text-emerald-50/90">Full-body asset assembly and anchor validation.</p>
        </header>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,.8fr)]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-700">Live Preview</p><h2 className="mt-1 text-xl font-black">Complete Elvy Body</h2></div>
            <div className="flex min-h-[720px] items-center justify-center overflow-hidden rounded-[24px] border border-emerald-100 bg-[radial-gradient(circle_at_top,#fff,#effaf6_50%,#dcefe8)] p-4">
              <ElvyTorso
                eyeDirection={eyeDirection}
                eyelidState={eyelidState}
                eyebrowState={eyebrowState}
                mouthState={mouthState}
                animationState={animationState}
              />
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-700">Build progress</p><h2 className="mt-1 text-lg font-black">Full Body · 6/6</h2><div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-full rounded-full bg-emerald-500" /></div></section>
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black">Eyes</h3><Buttons values={eyes} value={eyeDirection} onChange={setEyeDirection} /></section>
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h3 className="font-black">Eyelids</h3><button type="button" onClick={() => setAutoBlink((v) => !v)} className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800">Auto blink: {autoBlink ? "On" : "Off"}</button></div><Buttons values={eyelids} value={eyelidState} onChange={(v) => { setAutoBlink(false); setEyelidState(v); }} /></section>
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black">Eyebrows</h3><Buttons values={eyebrows} value={eyebrowState} onChange={setEyebrowState} /></section>
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black">Mouth</h3><Buttons values={mouths} value={mouthState} onChange={setMouthState} /></section>
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black">V1 animation states</h3><Buttons values={animations} value={animationState} onChange={setAnimationState} /></section>
            <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-bold uppercase tracking-[.18em] text-amber-700">V1 scope</p><p className="mt-2 text-sm font-bold leading-6 text-amber-950">Neutral, idle, speaking and listening. Face and shoulders only; elbows and wrists remain locked.</p></section>
          </aside>
        </section>
      </div>
    </main>
  );
}
