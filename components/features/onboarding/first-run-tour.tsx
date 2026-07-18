"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const TOUR_KEY = "scu-tour-seen";

const STEPS = [
  { title: "Discover live", body: "Browse top live channels, filter by language, and open any creator.", href: "/discover", cta: "Open Discover" },
  { title: "Build a Multistream", body: "Add up to six streams, rearrange panes, and save watchspaces to your account.", href: "/multistream", cta: "Open Multistream" },
  { title: "Stay notified", body: "Turn on go-live alerts, event reminders, browser push, and optional email in Settings.", href: "/settings#notifications", cta: "Open Settings" },
];

export function FirstRunTour() {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(TOUR_KEY)) return;
    queueMicrotask(() => setStep(0));
  }, []);

  if (step === null || step < 0 || step >= STEPS.length) return null;
  const current = STEPS[step];

  const dismiss = () => {
    localStorage.setItem(TOUR_KEY, "1");
    setStep(null);
  };

  return (
    <div className="tour-card" role="dialog" aria-label="Welcome tour">
      <button type="button" className="icon-button subtle" aria-label="Dismiss tour" onClick={dismiss}><X size={16} /></button>
      <span className="eyebrow purple">Welcome · {step + 1}/{STEPS.length}</span>
      <b>{current.title}</b>
      <p>{current.body}</p>
      <div className="tour-actions">
        <Link href={current.href} className="button primary" onClick={() => {
          if (step >= STEPS.length - 1) dismiss();
          else setStep(step + 1);
        }}>{current.cta}</Link>
        {step < STEPS.length - 1 ? (
          <button type="button" className="button glass" onClick={() => setStep(step + 1)}>Next</button>
        ) : (
          <button type="button" className="button glass" onClick={dismiss}>Done</button>
        )}
      </div>
    </div>
  );
}
