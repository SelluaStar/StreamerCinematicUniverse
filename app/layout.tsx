import type { Metadata } from "next";
import { Sora, Syne } from "next/font/google";
import { AuthProvider } from "@/components/auth/auth-provider";
import { StreamLanguageProvider } from "@/components/features/preferences/stream-language-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const body = Sora({ subsets: ["latin"], variable: "--font-body" });
const display = Syne({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "SCU — Streamer Cinematic Universe",
  description: "Every stream. Every moment. One universe.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="night" suppressHydrationWarning>
      <body className={`${body.variable} ${display.variable}`}>
        <ThemeProvider>
          <AuthProvider>
            <StreamLanguageProvider>
              <a className="skip-link" href="#main-content">Skip to content</a>
              {children}
            </StreamLanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
