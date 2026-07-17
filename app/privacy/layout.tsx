import type { Metadata } from "next";

const canonical = "https://famcarehealth.com/privacy";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how FamCare collects, uses, stores, and protects account and family health-tracking data.",
  alternates: { canonical },
  openGraph: {
    title: "Privacy Policy | FamCare",
    description: "Learn how FamCare handles account and family health-tracking data.",
    url: canonical,
  },
};

export default function PrivacyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
