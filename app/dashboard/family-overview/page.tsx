"use client";
import { useEffect, useState } from "react";
import { CheckCircle, Warning, Sparkle, CaretRight, UserPlus } from "@phosphor-icons/react";
import { Flame, Dumbbell, Footprints } from "lucide-react";
import {
  getFamilyMembers,
  getMemberSummary,
  type User,
  type Summary,
  type FamilyMember,
} from "@/lib/api";
import { scoreTier, computeScore, ScoreRing } from "../components/Score";
import Sidebar from "../components/Sidebar";
import FamilyMemberModal from "../components/FamilyMemberModal";
import AddFamilyModal from "../components/AddFamilyModal";

type MemberRow = { member: FamilyMember; summary: Summary | null };

export default function FamilyOverviewPage() {
  const [user, setUser] = useState<User | null>(null);
  const [memberRows, setMemberRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [showAddFamily, setShowAddFamily] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = localStorage.getItem("auth_user");
        const authUser: User | null = stored ? JSON.parse(stored) : null;
        if (!authUser) { window.location.href = "/login"; return; }
        setUser(authUser);
        const token = localStorage.getItem("auth_token") ?? "";

        const members = await getFamilyMembers(token).catch(() => [] as FamilyMember[]);
        const activeMembers = members.filter((m) => m.status === "active");
        const rows = await Promise.all(
          activeMembers.map(async (member) => ({
            member,
            summary: await getMemberSummary(member.id, token).catch(() => null),
          }))
        );
        setMemberRows(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="db-page">
        <Sidebar />
        <div className="db-main" style={{ alignItems: "center", justifyContent: "center", display: "flex" }}>
          <p style={{ color: "#9AA0AD", fontSize: 14 }}>Loading family overview…</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="db-page">
        <Sidebar />
        <div className="db-main" style={{ alignItems: "center", justifyContent: "center", display: "flex" }}>
          <p style={{ color: "#9AA0AD", fontSize: 14 }}>{error ?? "Something went wrong."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="db-page">
      <Sidebar />
      <div className="db-main">
        <div className="db-topbar">
          <div>
            <h1 className="db-greeting">Family Overview</h1>
            <p className="db-subtitle">Everyone you&apos;re tracking, in one place.</p>
          </div>
          {memberRows.length > 0 && (
            <div className="db-pill" style={{ cursor: "default" }}>
              <Sparkle size={15} weight="fill" color="#FF6B6B" />
              {memberRows.length} {memberRows.length === 1 ? "member" : "members"} tracked
            </div>
          )}
        </div>

        {memberRows.length === 0 ? (
          <div className="db-card db-card-pad" style={{ textAlign: "center", color: "#9AA0AD", fontSize: 13.5 }}>
            No active family members yet. Add one below to see them here.
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "stretch", gap: 16, flexWrap: "wrap" }}>
            {memberRows.map(({ member, summary: memberSummary }) => {
              const score = computeScore(memberSummary);
              const tier = scoreTier(score);
              const avatarLetter = (member.name ?? member.label).charAt(0).toUpperCase();
              return (
                <div
                  key={member.id}
                  className="fo-member-card"
                  style={{
                    flex: "0 0 300px", minWidth: 300,
                    background:
                      `linear-gradient(165deg, ${tier.bg} 0%, #fff 55%) padding-box, linear-gradient(135deg, ${tier.border}, ${tier.ring}) border-box`,
                    borderRadius: 24, border: "1.5px solid transparent",
                    boxShadow: "0 4px 16px rgba(26,20,20,.05)", padding: "22px 22px 20px",
                  }}
                >
                  <div style={{
                    position: "absolute", width: 130, height: 130, borderRadius: "50%",
                    top: -54, right: -42, background: tier.ring, opacity: 0.1,
                    filter: "blur(18px)", pointerEvents: "none",
                  }} />
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, position: "relative" }}>
                    <div style={{ display: "flex", gap: 11 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: "50%",
                        background: `linear-gradient(150deg, ${tier.ring}, ${tier.textColor})`,
                        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 800, fontSize: 16, flexShrink: 0,
                        boxShadow: `0 4px 10px ${tier.ring}55`,
                      }}>
                        {avatarLetter}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: "#1A2744" }}>{member.name ?? member.label}</p>
                        <p style={{ margin: 0, fontSize: 11.5, color: "#9AA0AD" }}>{member.label}</p>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, background: tier.bg, color: tier.textColor, fontSize: 10.5, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>
                          {score !== null && (
                            score >= 40
                              ? <CheckCircle size={13} weight="fill" color={tier.ring} />
                              : <Warning size={13} weight="fill" color={tier.ring} />
                          )}
                          {tier.label}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <ScoreRing score={score} tier={tier} size={68} />
                      <span style={{ marginTop: 4, fontSize: 10.5, fontWeight: 700, color: tier.textColor }}>Score</span>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginTop: 20, textAlign: "center" }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "center" }}><Flame size={20} color="#FF9F45" /></div>
                      <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 800, color: "#1A2744" }}>{memberSummary?.avg_calories != null ? memberSummary.avg_calories.toFixed(0) : "—"}</p>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: "#7C84A8" }}>Cal</p>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "center" }}><Dumbbell size={20} color="#4F9BF5" /></div>
                      <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 800, color: "#1A2744" }}>{memberSummary?.avg_protein_g != null ? `${memberSummary.avg_protein_g.toFixed(0)}g` : "—"}</p>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: "#7C84A8" }}>Protein</p>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "center" }}><Footprints size={20} color="#20A865" /></div>
                      <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 800, color: "#1A2744" }}>{memberSummary?.avg_steps != null ? Math.round(memberSummary.avg_steps).toLocaleString() : "—"}</p>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: "#7C84A8" }}>Steps</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedMember(member)}
                    style={{
                      width: "100%", marginTop: 18, padding: "10px 0", border: `1.5px solid ${tier.border}`, borderRadius: 14,
                      background: tier.bg, color: tier.textColor, fontSize: 13, fontWeight: 700,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                    }}
                  >
                    View Details <CaretRight size={13} weight="bold" />
                  </button>
                </div>
              );
            })}
            <button
              onClick={() => setShowAddFamily(true)}
              className="fo-add-card"
              style={{
                flex: "0 0 300px", minWidth: 300, alignSelf: "stretch",
                border: "2px dashed var(--he-coral)", borderRadius: 24,
                background: "linear-gradient(165deg, var(--he-coral-bg) 0%, #fff 75%)",
                boxShadow: "0 8px 22px rgba(232,92,92,.14)",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 10, padding: "22px 18px", cursor: "pointer", position: "relative", overflow: "hidden",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              <Sparkle size={13} weight="fill" color="var(--he-coral)" style={{ position: "absolute", top: 16, left: 22, opacity: 0.5 }} />
              <Sparkle size={9} weight="fill" color="var(--he-coral)" style={{ position: "absolute", bottom: 22, right: 26, opacity: 0.4 }} />
              <div className="fo-add-pulse-ring">
                <div style={{
                  width: 48, height: 48, borderRadius: "50%", background: "var(--he-coral)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 8px 20px rgba(232,92,92,.4)", position: "relative", zIndex: 1,
                }}>
                  <UserPlus size={22} weight="bold" color="#fff" />
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#1A2744" }}>Add a family member</p>
                <p style={{ margin: "3px 0 0", fontSize: 11, color: "#9AA0AD", fontWeight: 500 }}>Track their health too</p>
              </div>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5, marginTop: 2,
                background: "var(--he-coral)", color: "#fff", fontSize: 11, fontWeight: 700,
                padding: "5px 14px", borderRadius: 99,
              }}>
                Invite now <CaretRight size={11} weight="bold" />
              </span>
            </button>
          </div>
        )}
      </div>

      {selectedMember && (
        <FamilyMemberModal member={selectedMember} onClose={() => setSelectedMember(null)} />
      )}

      {showAddFamily && (
        <AddFamilyModal
          onClose={() => setShowAddFamily(false)}
          onAdded={(member) => setMemberRows((rows) => [...rows, { member, summary: null }])}
        />
      )}
    </div>
  );
}
