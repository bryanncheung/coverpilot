import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claro — AI Insurance Evidence Desk",
  description:
    "Understand your policy, compare statements, and prepare for your licensed adviser meeting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
