import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Boggoms Bay Golf Club — Tee times",
  description: "Book fourball tee times at Boggoms Bay Golf Club",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-ZA">
      <body className={`${display.variable} ${sans.variable} min-h-screen antialiased`}>
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-emerald-950/50">
          Contact details are used only for club administration. This notice is
          informational and does not claim POPIA legal compliance.
        </footer>
      </body>
    </html>
  );
}
