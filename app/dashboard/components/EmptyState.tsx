"use client";

import { FAMCARE_WHATSAPP_LINK } from "@/lib/whatsapp";

/** Shown on the dashboard when a user has zero health logs. */
export default function EmptyState({ userName }: { userName?: string }) {
  const greeting = userName ? `Hey ${userName}!` : "Hey there!";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "calc(100vh - 88px)",
      padding: "48px 24px",
      textAlign: "center",
    }}>

      {/* Illustration */}
      <div style={{
        width: 148,
        height: 148,
        borderRadius: "50%",
        background: "linear-gradient(145deg, #FFF5F3, #FFE4DE)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 28,
        boxShadow: "0 8px 32px rgba(232,92,92,.12)",
      }}>
        <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
          {/* Body silhouette */}
          <circle cx="36" cy="22" r="11" stroke="#E85C5C" strokeWidth="2.5" strokeLinecap="round" />
          {/* Step lines — suggest walking */}
          <path d="M14 58c0-9 9.6-14 22-14s22 5 22 14" stroke="#E85C5C" strokeWidth="2.5" strokeLinecap="round" />
          {/* Empty chart bars */}
          <rect x="10" y="36" width="6" height="14" rx="2" fill="#FFD5CC" />
          <rect x="19" y="42" width="6" height="8" rx="2" fill="#FFD5CC" />
          <rect x="28" y="38" width="6" height="12" rx="2" fill="#FFD5CC" />
          {/* Dotted line for "no data" */}
          <line x1="38" y1="44" x2="62" y2="44" stroke="#E85C5C" strokeWidth="1.5" strokeDasharray="3 3" strokeLinecap="round" />
          {/* Question mark dot */}
          <circle cx="64" cy="44" r="3" fill="#E85C5C" opacity="0.4" />
        </svg>
      </div>

      {/* Headline */}
      <h2 style={{ fontSize: 24, fontWeight: 700, color: "#1A2744", letterSpacing: "-.3px", marginBottom: 10 }}>
        {greeting} Nothing logged yet.
      </h2>
      <p style={{ fontSize: 14.5, color: "#6B7A9A", lineHeight: 1.75, maxWidth: 380, marginBottom: 36 }}>
        Your dashboard shows up once you start sending health updates over WhatsApp.
        It takes just one message to get going — steps, meals, whatever you tracked today.
      </p>

      {/* WhatsApp CTA */}
      <a
        href={FAMCARE_WHATSAPP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "13px 26px",
          background: "#25D366",
          color: "#fff",
          borderRadius: 10,
          fontSize: 14.5,
          fontWeight: 700,
          textDecoration: "none",
          boxShadow: "0 4px 18px rgba(37,211,102,.30)",
          marginBottom: 40,
        }}
      >
        {/* WhatsApp icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
        Send your first health update
      </a>

      {/* How-to steps */}
      <div style={{
        background: "#FAFAFA",
        border: "1px solid #F0E8E8",
        borderRadius: 14,
        padding: "22px 28px",
        maxWidth: 420,
        textAlign: "left",
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#B0BFCC", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 14 }}>
          How it works
        </p>
        {[
          { step: "1", text: "Save the WhatsApp number in your contacts" },
          { step: "2", text: 'Send a message like "8000 steps, 2 rotis, dal"' },
          { step: "3", text: "Your dashboard fills in automatically — come back here!" },
        ].map((item) => (
          <div key={item.step} style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "#FFEDEC", color: "#E85C5C",
              fontSize: 11, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, marginTop: 1,
            }}>
              {item.step}
            </div>
            <span style={{ fontSize: 13.5, color: "#6B7A9A", lineHeight: 1.55 }}>{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
