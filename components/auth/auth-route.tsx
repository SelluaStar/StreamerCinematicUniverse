"use client";

import { Suspense } from "react";
import { LoginPage, LogoutPage, OnboardingPage, SignupPage } from "@/components/auth/auth-pages";

function AuthFallback() {
  return (
    <div className="auth-page">
      <main className="auth-form">
        <div>
          <p>Loading…</p>
        </div>
      </main>
    </div>
  );
}

export function AuthRoute({ kind }: { kind: "login" | "signup" | "onboarding" | "logout" }) {
  return (
    <Suspense fallback={<AuthFallback />}>
      {kind === "login" && <LoginPage />}
      {kind === "signup" && <SignupPage />}
      {kind === "onboarding" && <OnboardingPage />}
      {kind === "logout" && <LogoutPage />}
    </Suspense>
  );
}
