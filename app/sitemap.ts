import type { MetadataRoute } from "next";

const siteUrl = "https://famcarehealth.com";

const lastModified = {
  home: new Date("2026-07-18"),
  privacy: new Date("2026-07-18"),
  medicineRemindersForParents: new Date("2026-07-18"),
  whatsappMedicineReminders: new Date("2026-07-18"),
  elderlyParentCareApp: new Date("2026-07-18"),
};

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      lastModified: lastModified.home,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified: lastModified.privacy,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${siteUrl}/medicine-reminders-for-parents`,
      lastModified: lastModified.medicineRemindersForParents,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/whatsapp-medicine-reminders`,
      lastModified: lastModified.whatsappMedicineReminders,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${siteUrl}/elderly-parent-care-app`,
      lastModified: lastModified.elderlyParentCareApp,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];
}
