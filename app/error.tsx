"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="not-found" role="alert">
      <AlertTriangle />
      <h1>Signal interrupted</h1>
      <p>SCU couldn’t load this part of the universe. Your saved data is safe.</p>
      <button className="button primary" onClick={reset}>
        <RotateCcw size={17} /> Try again
      </button>
    </div>
  );
}
