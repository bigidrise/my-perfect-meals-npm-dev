/**
 * Parent's Corner — AI nutrition Q&A for parents
 *
 * Spec: docs/my-perfect-beginning-spec.md § 17
 *
 * Pattern: warm, reassuring pediatric dietitian persona.
 * - Today's Tip (stage-appropriate)
 * - Nine curated question cards
 * - Free-text "Ask Anything" input
 * - Boundary language on first open
 * - Suggested follow-up question chips after each assistant reply
 * - Conversation persisted per child profile (hydrated on mount, saved after each reply)
 * - "Start fresh" to clear the conversation
 */

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Send,
  Loader2,
  Baby,
  Carrot,
  UtensilsCrossed,
  Apple,
  Milk,
  Egg,
  Zap,
  Droplets,
  Pizza,
  Lightbulb,
  X,
  RotateCcw,
} from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
  suggestedFollowUps?: string[];
}

interface ChildContextProps {
  id?: string;
  nickname?: string;
  developmentalStage?: string;
  currentAgeMonths?: number;
  sex?: string;
  prematureBirth?: boolean;
  gestationalAgeAtBirthWeeks?: number;
  feedingAbility?: Record<string, any>;
  growth?: Record<string, any>;
  allergyProfile?: Record<string, any>;
  diagnosedConditions?: any[];
  eatingBehavior?: Record<string, any>;
  activity?: Record<string, any>;
  householdDiet?: Record<string, any>;
}

interface ParentsCornerProps {
  childContext?: ChildContextProps;
  onBack?: () => void;
}

// ─── Curated question cards ───────────────────────────────────────────────────

const QUESTION_CARDS = [
  {
    id: "baby_wont_eat",
    icon: Baby,
    emoji: "🍼",
    label: "My baby won't eat.",
    question: "My baby won't eat. What should I do?",
    color: "from-rose-500/20 to-rose-600/10 border-rose-500/30",
  },
  {
    id: "toddler_hates_vegetables",
    icon: Carrot,
    emoji: "🥦",
    label: "My toddler hates vegetables.",
    question: "My toddler hates vegetables. How do I get them to eat more?",
    color: "from-green-500/20 to-green-600/10 border-green-500/30",
  },
  {
    id: "lunch_packing",
    icon: UtensilsCrossed,
    emoji: "🥪",
    label: "What should I pack for lunch?",
    question: "What are some ideas for packing a healthy and appealing lunch?",
    color: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
  },
  {
    id: "healthy_snacks",
    icon: Apple,
    emoji: "🍓",
    label: "Healthy snacks after school.",
    question: "What are some healthy snack ideas for after school?",
    color: "from-red-500/20 to-red-600/10 border-red-500/30",
  },
  {
    id: "calcium",
    icon: Milk,
    emoji: "🥛",
    label: "Is my child getting enough calcium?",
    question: "Is my child getting enough calcium? How do I make sure?",
    color: "from-blue-400/20 to-blue-500/10 border-blue-400/30",
  },
  {
    id: "introducing_foods",
    icon: Egg,
    emoji: "🥚",
    label: "How do I introduce new foods?",
    question: "How do I introduce new foods without it becoming a battle?",
    color: "from-yellow-500/20 to-yellow-600/10 border-yellow-500/30",
  },
  {
    id: "young_athlete",
    icon: Zap,
    emoji: "⚽",
    label: "What should my young athlete eat?",
    question: "My child plays sports. What should they eat before and after practice?",
    color: "from-orange-500/20 to-orange-600/10 border-orange-500/30",
  },
  {
    id: "water_intake",
    icon: Droplets,
    emoji: "💧",
    label: "How much water does my child need?",
    question: "How much water should my child be drinking each day?",
    color: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30",
  },
  {
    id: "pizza",
    icon: Pizza,
    emoji: "🍕",
    label: "Can my child still have pizza?",
    question: "Can my child still have pizza and other fun foods, or should I be stricter?",
    color: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
  },
];

const BOUNDARY_LANGUAGE =
  "I can share evidence-based nutrition guidance to support your family. For medical concerns, your child's pediatrician or a registered pediatric dietitian is always the right next step — I'll let you know when something sounds like it needs that conversation.";

const BOUNDARY_KEY = "parents_corner_boundary_seen";

// ─── Stage display label ──────────────────────────────────────────────────────

function stageBadgeLabel(stage?: string): string {
  const map: Record<string, string> = {
    early_infant: "Early Infant",
    beginning_foods: "Beginning Foods",
    young_toddler: "Young Toddler",
    toddler: "Toddler",
    preschool: "Preschool",
    early_school_age: "Early School Age",
    growing_child: "Growing Child",
  };
  return map[stage ?? ""] || "";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ParentsCorner({ childContext = {}, onBack }: ParentsCornerProps) {
  const [, setLocation] = useLocation();

  const childProfileId = childContext.id ?? null;
  const childName = childContext.nickname || "your child";
  const stage = childContext.developmentalStage || "toddler";
  const stageLabel = stageBadgeLabel(stage);

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [tip, setTip] = useState<string | null>(null);
  const [showBoundary, setShowBoundary] = useState(false);
  const [cardsVisible, setCardsVisible] = useState(true);
  const [showStartFreshConfirm, setShowStartFreshConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Load tip ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch(apiUrl(`/api/my-perfect-beginning/parents-corner/tip?stage=${stage}`), {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.tip) setTip(data.tip);
      })
      .catch(() => {});
  }, [stage]);

  // ── Boundary language on first open ──────────────────────────────────────
  useEffect(() => {
    const seen = localStorage.getItem(BOUNDARY_KEY);
    if (!seen) {
      setShowBoundary(true);
    }
  }, []);

  function dismissBoundary() {
    localStorage.setItem(BOUNDARY_KEY, "1");
    setShowBoundary(false);
  }

  // ── Hydrate saved conversation on mount ──────────────────────────────────
  useEffect(() => {
    if (!childProfileId) return;

    setHydrating(true);
    fetch(
      apiUrl(`/api/my-perfect-beginning/parents-corner/conversation?childProfileId=${encodeURIComponent(childProfileId)}`),
      { credentials: "include" }
    )
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages);
          setCardsVisible(false);
        }
      })
      .catch(() => {})
      .finally(() => setHydrating(false));
  }, [childProfileId]);

  // ── Persist conversation after each assistant reply ───────────────────────
  function persistConversation(updatedMessages: Message[]) {
    if (!childProfileId) return;
    fetch(apiUrl("/api/my-perfect-beginning/parents-corner/conversation"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ childProfileId, messages: updatedMessages }),
    }).catch(() => {});
  }

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────────────────
  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setCardsVisible(false);

    try {
      const response = await fetch(
        apiUrl("/api/my-perfect-beginning/parents-corner"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            message: trimmed,
            childContext,
            conversationHistory: updatedMessages.slice(0, -1),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const followUps: string[] = Array.isArray(data.suggestedFollowUps)
        ? data.suggestedFollowUps.filter((q: unknown) => typeof q === "string" && q.trim()).slice(0, 3)
        : [];
      const assistantMsg: Message = {
        role: "assistant",
        content: data.reply || "I'm sorry, I didn't get a response. Please try again.",
        suggestedFollowUps: followUps.length > 0 ? followUps : undefined,
      };
      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);
      persistConversation(finalMessages);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I'm having a little trouble right now. Please check your connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // ── Start fresh ───────────────────────────────────────────────────────────
  async function handleStartFresh() {
    setShowStartFreshConfirm(false);
    setMessages([]);
    setCardsVisible(true);

    if (!childProfileId) return;
    fetch(
      apiUrl(`/api/my-perfect-beginning/parents-corner/conversation?childProfileId=${encodeURIComponent(childProfileId)}`),
      { method: "DELETE", credentials: "include" }
    ).catch(() => {});
  }

  function handleCardTap(question: string) {
    sendMessage(question);
    inputRef.current?.focus();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function handleBack() {
    if (onBack) {
      onBack();
    } else {
      setLocation("/lifestyle");
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundImage: "linear-gradient(rgba(2,14,8,0.78), rgba(1,10,5,0.74)), url('/images/mpb-hero-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* ── Back button ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-2 max-w-2xl mx-auto w-full">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-emerald-400 text-sm"
          aria-label="Back to My Perfect Beginnings"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to My Perfect Beginnings</span>
        </button>
      </div>

      {/* ── Header toolbar (title + child context + reset) ─────────────────── */}
      <div className="px-4 pt-2 pb-3 border-b border-white/10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white leading-tight">
              Parent's Corner
            </h1>
            <p className="text-[12px] text-white mt-0.5 leading-tight">
              Helping {childName} build healthy habits
              {stageLabel ? (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  {stageLabel}
                </span>
              ) : null}
            </p>
          </div>
          {messages.length > 0 && childProfileId && (
            <button
              onClick={() => setShowStartFreshConfirm(true)}
              className="w-9 h-9 shrink-0 rounded-full bg-white/10 border border-white/15 flex items-center justify-center"
              aria-label="Start fresh"
              title="Start a new conversation"
            >
              <RotateCcw className="w-4 h-4 text-white" />
            </button>
          )}
        </div>
      </div>

      {/* ── Start fresh confirmation ────────────────────────────────────────── */}
      {showStartFreshConfirm && (
        <div className="mx-4 mt-3 rounded-2xl bg-white/10 border border-white/15 px-4 py-3 flex items-center gap-3">
          <p className="flex-1 text-[12.5px] text-white leading-snug">
            Clear this conversation and start fresh?
          </p>
          <button
            onClick={handleStartFresh}
            className="px-3 py-1.5 rounded-xl bg-rose-600/70 text-white text-[12px] font-medium"
          >
            Clear
          </button>
          <button
            onClick={() => setShowStartFreshConfirm(false)}
            className="text-white hover:text-white"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full">

        {/* ── Boundary language (first open) ──────────────────────────────── */}
        {showBoundary && (
          <div className="mx-4 mt-4 rounded-2xl bg-teal-900/40 border border-teal-500/30 px-4 py-3 flex gap-3">
            <div className="text-teal-400 text-lg shrink-0 mt-0.5">💚</div>
            <div className="flex-1">
              <p className="text-[12.5px] text-teal-100/90 leading-relaxed">
                {BOUNDARY_LANGUAGE}
              </p>
            </div>
            <button
              onClick={dismissBoundary}
              className="shrink-0 mt-0.5 text-white hover:text-white"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Today's Tip ─────────────────────────────────────────────────── */}
        {tip && (
          <div className="mx-4 mt-4 rounded-2xl bg-amber-900/30 border border-amber-500/25 px-4 py-3 flex gap-2.5">
            <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-semibold text-amber-400/80 uppercase tracking-wide mb-0.5">
                Today's Tip
              </p>
              <p className="text-[12.5px] text-amber-100/90 leading-relaxed">{tip}</p>
            </div>
          </div>
        )}

        {/* ── Loading prior conversation ───────────────────────────────────── */}
        {hydrating && (
          <div className="px-4 mt-5 flex items-center gap-2 text-white">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="text-[12px]">Loading your conversation…</span>
          </div>
        )}

        {/* ── Curated question cards ───────────────────────────────────────── */}
        {cardsVisible && !hydrating && (
          <div className="px-4 mt-5">
            <p className="text-[11px] text-white uppercase tracking-widest font-medium mb-3">
              Common questions
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {QUESTION_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.id}
                    onClick={() => handleCardTap(card.question)}
                    disabled={loading}
                    className={`
                      group relative flex flex-col items-start gap-1.5 rounded-2xl border
                      bg-gradient-to-br ${card.color}
                      px-3.5 py-3 text-left
                      active:scale-[0.97] transition-transform duration-150
                      disabled:opacity-50 disabled:pointer-events-none
                    `}
                  >
                    <span className="text-xl leading-none">{card.emoji}</span>
                    <span className="text-[12px] font-medium text-white leading-snug">
                      {card.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── "Show cards again" toggle when in conversation ──────────────── */}
        {!cardsVisible && messages.length > 0 && (
          <div className="px-4 mt-3">
            <button
              onClick={() => setCardsVisible(true)}
              className="text-[11.5px] text-white hover:text-white underline underline-offset-2"
            >
              Browse common questions
            </button>
          </div>
        )}

        {/* ── Conversation ─────────────────────────────────────────────────── */}
        {messages.length > 0 && (
          <div className="px-4 mt-4 pb-2 flex flex-col gap-3">
            {messages.map((msg, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-teal-600/30 border border-teal-500/30 flex items-center justify-center shrink-0 mt-0.5 mr-2">
                      <span className="text-sm">🧑‍🍼</span>
                    </div>
                  )}
                  <div
                    className={`
                      max-w-[82%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed
                      ${
                        msg.role === "user"
                          ? "bg-teal-600/60 text-white rounded-br-md"
                          : "bg-white/10 text-white rounded-bl-md border border-white/10"
                      }
                    `}
                  >
                    {msg.content}
                  </div>
                </div>

                {/* ── Suggested follow-up chips ────────────────────────────── */}
                {msg.role === "assistant" &&
                  msg.suggestedFollowUps &&
                  msg.suggestedFollowUps.length > 0 && (
                    <div className="pl-9 flex flex-col gap-1.5">
                      <p className="text-[10.5px] text-white uppercase tracking-widest font-medium">
                        Follow-up
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {msg.suggestedFollowUps.map((q, qi) => (
                          <button
                            key={qi}
                            onClick={() => handleCardTap(q)}
                            disabled={loading}
                            className="
                              text-left text-[12px] text-teal-300/90 leading-snug
                              px-3 py-1.5 rounded-full
                              bg-teal-900/40 border border-teal-500/30
                              hover:bg-teal-800/50 hover:border-teal-400/50
                              active:scale-[0.97] transition-all duration-150
                              disabled:opacity-40 disabled:pointer-events-none
                              max-w-[260px] text-left
                            "
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full bg-teal-600/30 border border-teal-500/30 flex items-center justify-center shrink-0 mt-0.5 mr-2">
                  <span className="text-sm">🧑‍🍼</span>
                </div>
                <div className="rounded-2xl rounded-bl-md bg-white/10 border border-white/10 px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-teal-400 animate-spin" />
                  <span className="text-[12px] text-white">Thinking…</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* ── Empty state prompt ───────────────────────────────────────────── */}
        {messages.length === 0 && !cardsVisible && !hydrating && (
          <div className="px-4 mt-6 text-center">
            <p className="text-[13px] text-white">
              Tap a card above or ask anything below.
            </p>
          </div>
        )}

        {/* Bottom padding for the fixed input */}
        <div className="h-28" />
        </div>{/* end max-w-2xl */}
      </div>

      {/* ── Ask Anything input (fixed bottom) ─────────────────────────────── */}
      <div
        className="border-t border-white/10 bg-[#0f1729]/90 backdrop-blur-md py-3"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-2xl mx-auto w-full px-4">
        <p className="text-[10.5px] text-white uppercase tracking-widest font-medium mb-2">
          Ask anything
        </p>
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your question here…"
            rows={1}
            disabled={loading}
            className="
              flex-1 resize-none rounded-2xl bg-white/10 border border-white/15
              px-4 py-2.5 text-[13px] text-white placeholder-white/30
              focus:outline-none focus:ring-1 focus:ring-teal-500/50
              disabled:opacity-50
              min-h-[42px] max-h-[120px] leading-relaxed
            "
            style={{ fieldSizing: "content" } as any}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="
              w-10 h-10 shrink-0 rounded-full bg-teal-600 flex items-center justify-center
              disabled:opacity-40 disabled:bg-white/10
              active:scale-95 transition-transform
            "
            aria-label="Send"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        </form>
        </div>{/* end max-w-2xl input wrapper */}
      </div>
    </div>
  );
}
