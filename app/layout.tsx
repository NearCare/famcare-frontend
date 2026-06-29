import type { Metadata, Viewport } from "next";
import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const siteUrl = "https://famcarehealth.com";
const siteTitle = "FamCare - WhatsApp Medicine Reminders for Parents";
const siteDescription =
  "FamCare helps families track parents' medicines with WhatsApp reminders, dose confirmations, missed-dose alerts, and daily adherence summaries.";

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
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s | FamCare",
  },
  description: siteDescription,
  keywords: [
    "WhatsApp medicine reminders",
    "medicine reminder app for parents",
    "parent medicine tracker India",
    "family medicine tracker",
    "medicine adherence app",
    "elderly parent care app",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "/",
    siteName: "FamCare",
    images: [{ url: "/family-sunset.png", width: 1200, height: 630, alt: "FamCare WhatsApp medicine reminders for parents" }],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/family-sunset.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
