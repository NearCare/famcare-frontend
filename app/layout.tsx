import type { Metadata } from "next";
import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FamCare — Family Health, Simplified",
  description: "Track appointments, steps and daily wellness habits. The WhatsApp-first health companion for Indian families.",
  viewport: "width=device-width, initial-scale=1",
  openGraph: {
    title: "FamCare — Family Health, Simplified",
    description: "Mom sends a WhatsApp message. You see a health dashboard. No app needed.",
    url: "https://famcarehealth.com",
    siteName: "FamCare",
    images: [{ url: "/family-sunset.png", width: 1200, height: 630, alt: "FamCare — Family Health" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FamCare — Family Health, Simplified",
    description: "Mom sends a WhatsApp message. You see a health dashboard. No app needed.",
    images: ["/family-sunset.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jakartaSans.variable}`}>
      <body style={{ fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
