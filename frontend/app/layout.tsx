import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LITMUS — Autonomous Research Agent",
  description: "Upload data, discover findings, survive the skeptic gauntlet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
