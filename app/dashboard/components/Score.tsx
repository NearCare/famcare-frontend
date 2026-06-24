import type { Summary } from "@/lib/api";

export type ScoreTier = {
  label: string;
  textColor: string;
  bg: string;
  ring: string;
  ringBg: string;
  border: string;
};

export function scoreTier(score: number | null): ScoreTier {
  if (score === null) return { label: "No data yet", textColor: "#9AA0AD", bg: "#F5F3F8", ring: "#D8D4DC", ringBg: "#F5F3F8", border: "#E8E4EA" };
  if (score >= 70) return { label: "All good", textColor: "#20A865", bg: "#EAFBF0", ring: "#20A865", ringBg: "#EAFBF0", border: "#BFE8D2" };
  if (score >= 40) return { label: "Needs attention", textColor: "#C9700F", bg: "#FFF4E8", ring: "#FF9F45", ringBg: "#FFF4E8", border: "#FFD9A0" };
  return { label: "Action required", textColor: "#E85C5C", bg: "#FFF1F0", ring: "#FF6B6B", ringBg: "#FFF1F0", border: "#FFCBC4" };
}

export function computeScore(summary: Summary | null): number | null {
  if (!summary || !summary.last_logged) return null;
  const stepsPct = Math.min(((summary.avg_steps ?? 0) / 10000) * 100, 100);
  const proteinPct = Math.min(((summary.avg_protein_g ?? 0) / 50) * 100, 100);
  const caloriesPct = Math.min(((summary.avg_calories ?? 0) / 2000) * 100, 100);
  return Math.round(stepsPct * 0.4 + proteinPct * 0.3 + caloriesPct * 0.3);
}

export function scoreFromAverages(avgSteps: number, avgProtein: number, avgCalories: number): number {
  const stepsPct = Math.min((avgSteps / 10000) * 100, 100);
  const proteinPct = Math.min((avgProtein / 50) * 100, 100);
  const caloriesPct = Math.min((avgCalories / 2000) * 100, 100);
  return Math.round(stepsPct * 0.4) + Math.round(proteinPct * 0.3) + Math.round(caloriesPct * 0.3);
}

export function ScoreRing({ score, tier, size = 46 }: { score: number | null; tier: ScoreTier; size?: number }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  const pct = score ?? 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tier.ringBg} strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tier.ring} strokeWidth={4}
        strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 - 1} textAnchor="middle" fontSize={size * 0.24} fontWeight={800} fill="#1A2744" fontFamily="'Plus Jakarta Sans', sans-serif">
        {score ?? "—"}
      </text>
      <text x={size / 2} y={size / 2 + size * 0.17} textAnchor="middle" fontSize={size * 0.13} fill="#9AA0AD" fontFamily="'Plus Jakarta Sans', sans-serif">
        /100
      </text>
    </svg>
  );
}
