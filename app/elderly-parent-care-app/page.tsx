import type { Metadata } from "next";
import SeoLandingPage from "../seo-pages/SeoLandingPage";
import { elderlyParentCareApp } from "../seo-pages/elderlyParentCareApp";

const canonical = "https://famcarehealth.com/elderly-parent-care-app";

export const metadata: Metadata = {
  title: "Elderly Parent Care App",
  description:
    "An elderly parent care app for Indian families with WhatsApp-first medicine reminders, family health logs, and caregiver visibility.",
  alternates: { canonical },
  openGraph: {
    title: "Elderly Parent Care App | FamCare",
    description:
      "FamCare helps children coordinate parent care with medicine reminders, WhatsApp updates, and family dashboards.",
    url: canonical,
    images: [{ url: "/family_walking.webp", width: 1200, height: 630, alt: "Elderly parent care app for Indian families" }],
  },
};

export default function ElderlyParentCareAppPage() {
  return <SeoLandingPage content={elderlyParentCareApp} canonical={canonical} />;
}
