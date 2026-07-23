"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ChartBar, CheckCircle, ForkKnife, PaperPlaneTilt, ShieldCheck, Sparkle, Trash, TrendUp,
} from "@phosphor-icons/react";
import Image from "next/image";
import Sidebar from "../components/Sidebar";
import PageLoader from "../components/PageLoader";
import {
  createChatConversation,
  clearChatMessages,
  getChatConversations,
  getChatMessages,
  getFamilyMembers,
  sendHealthAssistantMessage,
  type ChatBlock,
  type ChatMessage,
  type FamilyMember,
  type User,
} from "@/lib/api";
import { captureEvent, identifyUser } from "@/lib/analytics";

type StarterPrompt = {
  label: string;
  icon: typeof ChartBar;
};

const TYPING_STEPS = [
  "Checking recent food logs",
  "Reading calorie and protein targets",
  "Preparing a simple answer",
];

function shouldShowStructuredDetails(message: ChatMessage, previousMessage?: ChatMessage) {
  if (message.role !== "assistant") return false;
  const question = previousMessage?.role === "user" ? previousMessage.content.toLowerCase() : "";
  return [
    "show details",
    "show data",
    "show me data",
    "show logs",
    "show my logs",
    "show recent logs",
    "show recent food logs",
    "list",
    "logs",
    "recent logs",
    "recent food logs",
    "breakdown",
    "full breakdown",
    "details",
    "table",
    "raw data",
    "what did i log",
    "meals checked",
  ].some((phrase) => question.includes(phrase));
}

function metricValue(value: number | null, unit: string) {
  if (value == null) return "Not logged";
  const number = Number.isInteger(value) ? value.toLocaleString("en-IN") : value.toFixed(1);
  return `${number} ${unit}`;
}

function subjectNameForPrompt(subject?: { label: string; name: string | null }) {
  if (!subject) return "me";
  if (subject.label.toLowerCase() === "you") return "me";
  return subject.label || subject.name || "this member";
}

function buildStarterPrompts(
  subject: { id: number; label: string; name: string | null } | undefined,
  user: User | null,
  members: FamilyMember[],
): StarterPrompt[] {
  const name = subjectNameForPrompt(subject);
  const activeMembers = members.filter((member) => member.status === "active");
  const hasFamily = activeMembers.length > 0;
  const parentCount = activeMembers.filter((member) => {
    const text = `${member.label} ${member.type}`.toLowerCase();
    return ["mom", "mother", "dad", "father", "parent"].some((word) => text.includes(word));
  }).length;
  const isSelf = !subject || subject.id === user?.id;

  if (!isSelf) {
    return [
      { label: `How is ${name} doing this week?`, icon: ChartBar },
      { label: `What should ${name} improve this week?`, icon: Sparkle },
      { label: `What should ${name} add more in diet?`, icon: ForkKnife },
      { label: `Show ${name}'s recent food logs`, icon: ShieldCheck },
    ];
  }

  return [
    { label: "Summarize my week", icon: ChartBar },
    { label: "How can I improve?", icon: Sparkle },
    { label: "Suggest a meal plan", icon: ForkKnife },
    { label: hasFamily && parentCount >= 2 ? "Compare my parents protein wise" : "Show my recent food logs", icon: ShieldCheck },
  ];
}

function iconForPrompt(label: string): StarterPrompt["icon"] {
  const text = label.toLowerCase();
  if (text.includes("meal") || text.includes("diet") || text.includes("food")) return ForkKnife;
  if (text.includes("log") || text.includes("show") || text.includes("checked")) return ShieldCheck;
  if (text.includes("improve") || text.includes("add")) return Sparkle;
  return ChartBar;
}

function StreamingText({
  text,
  active,
  onDone,
  onProgress,
}: {
  text: string;
  active: boolean;
  onDone?: () => void;
  onProgress?: () => void;
}) {
  const [visible, setVisible] = useState(active ? "" : text);

  useEffect(() => {
    if (!active) {
      setVisible(text);
      return undefined;
    }

    let index = 0;
    setVisible("");
    const timer = window.setInterval(() => {
      index = Math.min(text.length, index + 4);
      setVisible(text.slice(0, index));
      onProgress?.();
      if (index >= text.length) {
        window.clearInterval(timer);
        onDone?.();
      }
    }, 18);

    return () => window.clearInterval(timer);
  }, [active, onDone, onProgress, text]);

  return (
    <>
      {visible}
      {active && visible.length < text.length && <span className="ha-stream-cursor" />}
    </>
  );
}

function AssistantBlock({ block }: { block: ChatBlock }) {
  const metrics = block.metrics ?? [];
  const items = block.items ?? [];
  if (metrics.length > 0) {
    return (
      <section className={`ha-block ha-block-${block.tone}`}>
        <div className="ha-block-title"><TrendUp size={15} weight="bold" />{block.title}</div>
        <div className="ha-metrics">
          {metrics.map((metric) => {
            const pct = metric.current != null && metric.target ? Math.min(100, Math.round(metric.current / metric.target * 100)) : null;
            return (
              <div className="ha-metric" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metricValue(metric.current, metric.unit)}</strong>
                {metric.target != null && <small>of {metricValue(metric.target, metric.unit)}</small>}
                {pct != null && <div className="ha-meter"><i style={{ width: `${pct}%` }} /></div>}
                {metric.delta != null && <em className={metric.delta >= 0 ? "up" : "down"}>{metric.delta >= 0 ? "+" : ""}{metric.delta} vs previous</em>}
              </div>
            );
          })}
        </div>
        {items.map((item) => <p className="ha-block-item" key={item}>{item}</p>)}
        {block.footnote && <p className="ha-footnote">{block.footnote}</p>}
      </section>
    );
  }
  return (
    <section className={`ha-block ha-block-${block.tone}`}>
      <div className="ha-block-title">
        {block.type === "recommendations" ? <ForkKnife size={15} weight="bold" /> : <ShieldCheck size={15} weight="bold" />}
        {block.title}
      </div>
      <div className="ha-list">
        {items.map((item) => <div key={item}><CheckCircle size={14} weight="fill" /><span>{item}</span></div>)}
      </div>
      {block.footnote && <p className="ha-footnote">{block.footnote}</p>}
    </section>
  );
}

export default function HealthAssistantPage() {
  const [user, setUser] = useState<User | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<number | null>(null);
  const [typingStep, setTypingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const people = useMemo(() => user ? [
    { id: user.id, name: user.name ?? "You", label: "You" },
    ...members.filter((member) => member.status === "active").map((member) => ({
      id: member.id, name: member.name ?? member.label, label: member.label,
    })),
  ] : [], [members, user]);
  const subject = people.find((person) => person.id === subjectId);
  const starters = useMemo(() => {
    const fallback = buildStarterPrompts(subject, user, members);
    const latestSuggestions = [...messages].reverse()
      .find((message) => message.role === "assistant" && (message.suggestions ?? []).length > 0)
      ?.suggestions ?? [];
    if (latestSuggestions.length === 0) return fallback;

    const seen = new Set<string>();
    return [
      ...latestSuggestions.map((label) => ({ label, icon: iconForPrompt(label) })),
      ...fallback,
    ].filter((prompt) => {
      const key = prompt.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 4);
  }, [members, messages, subject, user]);

  useEffect(() => {
    const stored = localStorage.getItem("auth_user");
    const authUser = stored ? JSON.parse(stored) as User : null;
    if (!authUser) { window.location.href = "/login"; return; }
    setUser(authUser);
    setSubjectId(authUser.id);
    identifyUser(authUser);
    captureEvent("health_assistant_opened");
    getFamilyMembers(localStorage.getItem("auth_token") ?? "")
      .then((rows) => setMembers(rows.filter((row) => row.status === "active")))
      .catch(() => setMembers([]));
  }, []);

  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;
    async function openConversation() {
      setLoading(true); setError(null);
      const token = localStorage.getItem("auth_token") ?? "";
      try {
        const existing = (await getChatConversations(token)).find((item) => item.subject_user_id === subjectId);
        const conversation = existing ?? await createChatConversation(token, subjectId!);
        const history = await getChatMessages(token, conversation.id);
        if (!cancelled) { setConversationId(conversation.id); setMessages(history); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not open the assistant.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    openConversation();
    return () => { cancelled = true; };
  }, [subjectId]);

  function scrollToLatest(behavior: ScrollBehavior = "smooth") {
    window.requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior, block: "end" });
    });
  }

  useEffect(() => { scrollToLatest(); }, [messages, sending]);

  useEffect(() => {
    if (!sending) {
      setTypingStep(0);
      return undefined;
    }
    const timer = window.setInterval(() => {
      setTypingStep((current) => (current + 1) % TYPING_STEPS.length);
    }, 900);
    return () => window.clearInterval(timer);
  }, [sending]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || sending || !conversationId || !subjectId) return;
    const optimistic: ChatMessage = {
      id: -Date.now(), conversation_id: conversationId, role: "user", content: clean,
      blocks: [], suggestions: [], created_at: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    setInput(""); setSending(true); setError(null);
    captureEvent("chat_message_sent", { subject_type: subjectId === user?.id ? "self" : "family" });
    try {
      const reply = await sendHealthAssistantMessage(
        localStorage.getItem("auth_token") ?? "", conversationId, subjectId, clean,
      );
      setMessages((current) => [...current, reply.message]);
      setStreamingMessageId(reply.message.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The assistant could not respond.");
    } finally { setSending(false); }
  }

  function submit(event: FormEvent) { event.preventDefault(); send(input); }

  async function clearChat() {
    if (!conversationId || sending || clearing || messages.length === 0) return;
    setConfirmClear(false);
    setClearing(true); setError(null);
    try {
      await clearChatMessages(localStorage.getItem("auth_token") ?? "", conversationId);
      setMessages([]);
      captureEvent("health_assistant_chat_cleared");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clear chat history.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="db-page">
      <Sidebar />
      <main className="db-main ha-page">
        <section className="ha-shell">
          <div className="ha-chat">
            <div className="ha-chat-actions">
              <button
                type="button"
                onClick={() => setConfirmClear((current) => !current)}
                disabled={messages.length === 0 || sending || clearing}
                aria-label="Clear chat"
              >
                <Trash size={14} />
                <span>{clearing ? "Clearing..." : "Clear chat"}</span>
              </button>
              {confirmClear && (
                <div className="ha-clear-popover">
                  <strong>Clear chat?</strong>
                  <small>This only removes this conversation history.</small>
                  <div>
                    <button type="button" onClick={() => setConfirmClear(false)}>Cancel</button>
                    <button type="button" onClick={clearChat}>Clear</button>
                  </div>
                </div>
              )}
            </div>
            {loading ? (
              <PageLoader title="Opening your health desk..." subtitle="Checking your permitted health data." />
            ) : (
              <div className="ha-thread">
                {messages.length === 0 && (
                  <article className="ha-message assistant">
                    <div className="ha-message-mark"><Image src="/mascot.png" alt="" width={30} height={30} /></div>
                    <div>
                      <div className="ha-message-name">AI Coach</div>
                      <div className="ha-message-body">
                        <p>Hi {subject?.name ?? "there"}! I can help you understand your health trends and make smarter choices. What would you like to know?</p>
                      </div>
                    </div>
                  </article>
                )}
                {messages.map((message, index) => {
                  const showDetails = shouldShowStructuredDetails(message, messages[index - 1]);
                  return (
                    <article className={`ha-message ${message.role}`} key={message.id}>
                      {message.role === "assistant" && <div className="ha-message-mark"><Image src="/mascot.png" alt="" width={30} height={30} /></div>}
                      <div>
                        {message.role === "assistant" && <div className="ha-message-name">AI Coach</div>}
                        <div className="ha-message-body">
                          <p>
                            <StreamingText
                              text={message.content}
                              active={message.role === "assistant" && message.id === streamingMessageId}
                              onDone={() => setStreamingMessageId((current) => (current === message.id ? null : current))}
                              onProgress={() => scrollToLatest("auto")}
                            />
                          </p>
                          {showDetails && (message.blocks ?? [])
                            .filter((block) => block.type !== "ai_takeaway")
                            .map((block, blockIndex) => <AssistantBlock block={block} key={`${message.id}-${blockIndex}`} />)}
                        </div>
                      </div>
                      {message.role === "user" && <div className="ha-user-avatar">{user?.name?.charAt(0).toUpperCase() ?? "Y"}</div>}
                    </article>
                  );
                })}
                {sending && (
                  <div className="ha-thinking">
                    <div className="ha-thinking-orbit"><span /><span /><span /></div>
                    <p>{TYPING_STEPS[typingStep]}...</p>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            )}
            {error && <div className="ha-error">{error}<button onClick={() => setError(null)}>Dismiss</button></div>}
            <div className="ha-starters">
              {starters.map((starter) => {
                const StarterIcon = starter.icon;
                return (
                  <button key={starter.label} onClick={() => { captureEvent("suggested_prompt_clicked", { prompt: starter.label }); send(starter.label); }} type="button" disabled={sending}>
                    <StarterIcon size={18} weight="fill" />
                    {starter.label}
                  </button>
                );
              })}
            </div>
            <form className="ha-composer" onSubmit={submit}>
              <textarea
                value={input} onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(event); } }}
                placeholder="Ask about your calories, protein, meals, or family nutrition..." maxLength={1000} rows={1}
              />
              <button type="submit" disabled={!input.trim() || sending} aria-label="Send message"><PaperPlaneTilt size={20} weight="fill" /></button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
