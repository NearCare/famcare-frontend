"use client";

import { useEffect, useState } from "react";
import { FEDroplet, FEFlame, FEMoon, FEShoe } from "./FluentEmoji";

type PageLoaderProps = {
  title?: string;
  subtitle?: string;
};

export default function PageLoader({
  title = "Loading your health dashboard...",
  subtitle = "We're preparing your latest FamCare updates.",
}: PageLoaderProps) {
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const id = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 92) return current;
        const step = current < 50 ? 4 : current < 75 ? 2 : 1;
        return Math.min(current + step, 92);
      });
    }, 180);
    return () => window.clearInterval(id);
  }, []);

  const orbitIcons = [
    { icon: <FEShoe size={24} />, bg: "#EAFBF0", style: { top: 4, left: 6 } },
    { icon: <FEDroplet size={24} />, bg: "#EAF4FF", style: { top: 4, right: 6 } },
    { icon: <FEFlame size={24} />, bg: "#FFF1E6", style: { bottom: 4, left: 6 } },
    { icon: <FEMoon size={24} />, bg: "#F0EEFF", style: { bottom: 4, right: 6 } },
  ];

  return (
    <div style={{ textAlign: "center", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ position: "relative", width: 220, height: 200, margin: "0 auto" }}>
        <svg width="220" height="200" style={{ position: "absolute", inset: 0 }} viewBox="0 0 220 200">
          <line x1="58" y1="38" x2="98" y2="88" stroke="#F0D9D9" strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" />
          <line x1="162" y1="38" x2="122" y2="88" stroke="#F0D9D9" strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" />
          <line x1="58" y1="162" x2="98" y2="112" stroke="#F0D9D9" strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" />
          <line x1="162" y1="162" x2="122" y2="112" stroke="#F0D9D9" strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" />
        </svg>

        {orbitIcons.map((item, index) => (
          <div key={index} style={{
            position: "absolute",
            ...item.style,
            width: 50,
            height: 50,
            borderRadius: "50%",
            background: item.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 14px rgba(0,0,0,.06)",
          }}>
            {item.icon}
          </div>
        ))}

        <span style={{ position: "absolute", top: 34, left: 4, fontSize: 13, color: "#FF9F45", animation: "dbSparkle 1.8s ease-in-out infinite" }}>*</span>
        <span style={{ position: "absolute", top: 34, right: 4, fontSize: 13, color: "#7C6FF7", animation: "dbSparkle 1.8s ease-in-out infinite .4s" }}>*</span>

        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: 84,
          height: 84,
          borderRadius: "50%",
          background: "linear-gradient(150deg, #FF8A7A, #E85C5C)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 10px 26px rgba(232,92,92,.35)",
          animation: "dbHeartBeat 1.4s ease-in-out infinite",
        }}>
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none">
            <path d="M12 21s-7.5-4.6-10-9.3C.5 8 2 4 6 4c2.2 0 3.7 1.2 4.6 2.5.3.4.9.4 1.2 0C12.7 5.2 14.2 4 16.4 4c4 0 5.5 4 4 7.7C19.5 16.4 12 21 12 21z" fill="white" opacity=".22" />
            <path d="M2 12h4l2-5 3 9 2-6 1.5 2H22" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </div>
      </div>

      <h2 style={{ marginTop: 24, fontSize: 21, fontWeight: 800, color: "#2C2F3A" }}>
        {title}
      </h2>
      <p style={{ marginTop: 6, fontSize: 13.5, color: "#9AA0AD" }}>
        {subtitle}
      </p>

      <div style={{ marginTop: 22, width: 280, maxWidth: "78vw", marginLeft: "auto", marginRight: "auto" }}>
        <div style={{ height: 8, borderRadius: 8, background: "#F0EEEF", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            borderRadius: 8,
            width: `${progress}%`,
            background: "linear-gradient(90deg, #FF6B6B, #FF9F45)",
            transition: "width .25s ease",
          }} />
        </div>
        <div style={{ marginTop: 8, fontSize: 13, fontWeight: 800, color: "#E85C5C" }}>{progress}%</div>
      </div>
    </div>
  );
}
