"use client";

import Link from "next/link";

export default function PrivacyPolicy() {
  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "#FFFAF9", minHeight: "100vh" }}>

      {/* Nav */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 56px", height: 64, borderBottom: "1px solid #F5EEEE",
        background: "#fff",
      }}>
        <Link href="/" style={{ fontSize: 18, fontWeight: 800, color: "#1A2744", textDecoration: "none" }}>
          Near<span style={{ color: "#E85C5C" }}>Care</span>
        </Link>
        <Link href="/login" style={{
          padding: "9px 20px", background: "#E85C5C", color: "#fff",
          borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none",
        }}>Get Started</Link>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px 80px" }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: "#1A2744", marginBottom: 8 }}>Privacy Policy</h1>
        <p style={{ fontSize: 13, color: "#6B7A9A", marginBottom: 40 }}>
          Last updated: June 15, 2026 &nbsp;·&nbsp; Effective date: June 15, 2026
        </p>

        {[
          {
            title: "1. Who We Are",
            body: `NearCare is a family health tracking platform that allows you to log health data (steps, meals, vitals) by sending casual messages on WhatsApp — in Hindi or English. We are operated by the NearCare team.`,
          },
          {
            title: "2. What Data We Collect",
            body: `We collect the following information when you use NearCare:

• Phone number — used to identify your account and send you OTPs and health summaries via WhatsApp.
• Name — optionally provided via your WhatsApp profile.
• Health data — steps, protein, calories, and other metrics you share via WhatsApp messages or voice notes.
• Message content — the raw text or transcription of your WhatsApp messages, stored alongside your health log.
• Session tokens — used to keep you logged in on the dashboard.

We do not collect payment information, location data, or any data beyond what you explicitly send us.`,
          },
          {
            title: "3. How We Use Your Data",
            body: `Your data is used solely to:

• Parse and store your daily health logs.
• Display your health history and summaries on the NearCare dashboard.
• Allow family members you invite to view your health data (only with your explicit consent via the invite flow).
• Send you WhatsApp replies confirming your logged data.

We do not use your data for advertising, profiling, or any purpose beyond the health tracking service you signed up for.`,
          },
          {
            title: "4. AI Processing",
            body: `Your WhatsApp messages and voice notes are sent to Google Gemini Flash (an AI model by Google) for parsing. This is necessary to extract health metrics from natural language. Google's data processing is governed by Google's privacy policy. We do not store raw audio beyond what is needed to process a single voice note.`,
          },
          {
            title: "5. Data Sharing",
            body: `We share your data only with:

• Twilio — to deliver WhatsApp messages to and from your phone number.
• Google (Gemini API) — to parse health messages and voice notes.
• Supabase — our database provider, where your health data is stored on encrypted servers.

We do not sell, rent, or trade your personal data to any third party.`,
          },
          {
            title: "6. Family Member Access",
            body: `If you invite a family member to view your health data, they will be able to see your logs and summaries on their dashboard. You initiate this relationship — the family member must confirm by replying YES on WhatsApp before access is granted. You can contact us to revoke access at any time.`,
          },
          {
            title: "7. Data Retention",
            body: `We retain your health logs and account data for as long as your account is active. If you wish to delete your data, message us on WhatsApp and we will delete all your data within 7 business days.`,
          },
          {
            title: "8. Your Rights (DPDP Act 2023)",
            body: `Under India's Digital Personal Data Protection Act 2023, you have the right to:

• Access the personal data we hold about you.
• Correct inaccurate or incomplete data.
• Erase your data (right to be forgotten).
• Withdraw consent at any time — this will result in your account being deactivated.
• Nominate a person to exercise your rights on your behalf.

To exercise any of these rights, contact us via WhatsApp.`,
          },
          {
            title: "9. Data Security",
            body: `All data is stored in Supabase's encrypted PostgreSQL database hosted on AWS. Communication between your device and our servers uses HTTPS/TLS. Session tokens are randomly generated and expire after 30 days. We apply rate limiting on all endpoints to prevent abuse.`,
          },
          {
            title: "10. Children's Privacy",
            body: `NearCare is not directed at children under 18. We do not knowingly collect personal data from children. If you believe a child has provided us with their data, please contact us and we will delete it promptly.`,
          },
          {
            title: "11. Changes to This Policy",
            body: `We may update this privacy policy from time to time. When we do, we will update the "Last updated" date at the top of this page. Continued use of NearCare after changes constitutes acceptance of the updated policy.`,
          },
          {
            title: "12. Contact Us",
            body: `For any privacy-related questions or requests, reach us via WhatsApp.`,
          },
        ].map((section) => (
          <div key={section.title} style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1A2744", marginBottom: 12 }}>
              {section.title}
            </h2>
            <div style={{ fontSize: 14.5, color: "#4A5568", lineHeight: 1.85, whiteSpace: "pre-line" }}>
              {section.body}
            </div>
          </div>
        ))}

        <div style={{
          marginTop: 48, padding: "20px 24px", background: "#FFF5F3",
          borderRadius: 12, border: "1px solid #FFE4DE",
        }}>
          <p style={{ fontSize: 13.5, color: "#6B7A9A", margin: 0 }}>
            This policy is compliant with India&apos;s <strong style={{ color: "#1A2744" }}>Digital Personal Data Protection Act, 2023</strong>.
            If you have concerns about how your data is handled, you may also lodge a complaint with the
            Data Protection Board of India once operational.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        borderTop: "1px solid #F5EEEE", background: "#fff",
        padding: "20px 56px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 13, color: "#6B7A9A" }}>© 2026 NearCare. All rights reserved.</span>
        <Link href="/" style={{ fontSize: 13, color: "#E85C5C", textDecoration: "none", fontWeight: 600 }}>
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
