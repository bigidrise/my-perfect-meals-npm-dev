/**
 * CoachsCorner.tsx — Phase 4B: Conversational coaching interface
 *
 * Takes the place of the old situation-picker (CoachCornerHome).
 * Backed by the Universal Coaching Engine via POST /api/coach/message.
 *
 * Flow:
 *   1. Check /api/coach-corner/status → if intake not done, redirect to intake
 *   2. Load conversation history from DB on mount
 *   3. Open-ended freeform chat
 *   4. Gear → My Coaching Profile (view / edit individual answers / retake)
 *
 * Evidence rule: usage ≠ consumption. The engine must know what a user
 * actually did vs. what they explored. This UI never fabricates that distinction.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Settings, Send, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CoachCornerQuestion } from "@shared/coachCornerTypes";

// ─── Types ────────────────────────────────────────────────────────────────────

// The API returns items as objects; legacy DB rows may have strings.
// Both are handled in CoachBubble via the planItemText() helper.
interface PlanItem {
  text: string;
  horizon?: string;
  kind?: string;
  dueAt?: string;
  completionSignal?: string;
  featureTarget?: string;
}

interface CoachStructuredResponse {
  whatIFound: string;
  whatItCouldMean: string;
  todayPlan: {
    why: string;
    items: Array<PlanItem | string>;
    successMetric: string;
    nextCheckIn: string;
  } | null;
  learningOpportunity: string | null;
}

interface UIMessage {
  id: string;
  role: "user" | "coach";
  content?: string;
  structured?: CoachStructuredResponse;
  createdAt: string;
}

interface DbMessage {
  id: string;
  role: string;
  content: string;
  structured_payload: CoachStructuredResponse | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Safely extract display text from a plan item regardless of shape */
function planItemText(item: PlanItem | string): string {
  if (typeof item === "string") return item;
  return item?.text ?? "";
}

function mapDbMessage(msg: DbMessage): UIMessage {
  if (msg.role === "user") {
    return { id: msg.id, role: "user", content: msg.content, createdAt: msg.created_at };
  }
  // assistant / coach messages carry the structured payload
  return {
    id: msg.id,
    role: "coach",
    structured: msg.structured_payload ?? {
      whatIFound: msg.content,
      whatItCouldMean: "",
      todayPlan: null,
      learningOpportunity: null,
    },
    createdAt: msg.created_at,
  };
}

function getAnswerLabel(
  question: CoachCornerQuestion,
  value: string | string[] | number | null | undefined
): string {
  if (value === null || value === undefined) return "Not answered";
  if (Array.isArray(value)) {
    const labels = value.map(
      (v) => question.options.find((o) => o.value === v)?.label ?? v
    );
    return labels.join(" · ") || "Not answered";
  }
  const strVal = String(value);
  return question.options.find((o) => o.value === strVal)?.label ?? strVal;
}

// ─── UserBubble ───────────────────────────────────────────────────────────────

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] bg-orange-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

// ─── CoachBubble ──────────────────────────────────────────────────────────────
// Renders the structured response as flowing prose — no section labels ever shown.

function CoachBubble({ structured }: { structured: CoachStructuredResponse }) {
  const topParagraphs: string[] = [];
  if (structured.whatIFound) topParagraphs.push(structured.whatIFound);
  if (structured.whatItCouldMean) topParagraphs.push(structured.whatItCouldMean);

  const planWhy = structured.todayPlan?.why ?? null;
  const planItems = structured.todayPlan?.items ?? null;
  const learningOpp = structured.learningOpportunity ?? null;

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%]">
        <p className="text-[11px] font-semibold text-orange-400 mb-1.5 uppercase tracking-wider ml-1">
          Coach
        </p>
        <div className="bg-zinc-900 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3.5 text-sm text-white/90 leading-relaxed space-y-3">
          {topParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}

          {planWhy && (
            <div className="space-y-2">
              <p>{planWhy}</p>
              {planItems && planItems.length > 0 && (
                <ul className="space-y-1.5 mt-1">
                  {planItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-orange-400 mt-0.5 shrink-0 select-none">•</span>
                      <span>{planItemText(item)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {learningOpp && (
            <p className="text-white/60 italic text-[13px] border-t border-white/5 pt-3">
              {learningOpp}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ThinkingBubble ───────────────────────────────────────────────────────────

function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[90%]">
        <p className="text-[11px] font-semibold text-orange-400 mb-1.5 uppercase tracking-wider ml-1">
          Coach
        </p>
        <div className="bg-zinc-900 border border-white/10 rounded-2xl rounded-tl-sm px-5 py-4">
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-2 h-2 rounded-full bg-orange-400/50 animate-bounce"
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ProfileSheet ─────────────────────────────────────────────────────────────

function ProfileSheet({
  open,
  onClose,
  profile,
  questions,
  onFieldSave,
  onRetake,
  isSaving,
}: {
  open: boolean;
  onClose: () => void;
  profile: Record<string, unknown> | null;
  questions: CoachCornerQuestion[];
  onFieldSave: (questionId: string, value: string | string[]) => void;
  onRetake: () => void;
  isSaving: boolean;
}) {
  const [editingField, setEditingField] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setEditingField(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-zinc-950 border border-white/10 text-white max-w-lg w-full max-h-[82dvh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-white/10 shrink-0">
          <DialogTitle className="text-white text-left text-base">
            My Coaching Profile
          </DialogTitle>
          <p className="text-xs text-white/50 text-left">
            These answers shape how Chef's Corner communicates with you — not what the
            data says.
          </p>
        </DialogHeader>

        {/* Scrollable question list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-5 pt-4 pb-2 space-y-1.5">
            {questions.length === 0 && (
              <div className="py-8 text-center text-white/30 text-sm">Loading profile…</div>
            )}

            {questions.map((q) => {
              const rawValue = profile?.[q.target] as
                | string
                | string[]
                | number
                | null
                | undefined;
              const answerLabel = getAnswerLabel(q, rawValue);
              const isEditing = editingField === q.id;
              const selectedValues = Array.isArray(rawValue)
                ? rawValue.map(String)
                : rawValue != null
                ? [String(rawValue)]
                : [];

              return (
                <div key={q.id} className="rounded-xl overflow-hidden border border-white/5">
                  {/* Question row */}
                  <button
                    className={`w-full flex items-start justify-between gap-3 px-4 py-3 text-left transition-colors ${
                      isEditing ? "bg-zinc-800" : "bg-zinc-900 hover:bg-zinc-800/70"
                    }`}
                    onClick={() => setEditingField(isEditing ? null : q.id)}
                    disabled={isSaving}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-white/85 font-medium leading-snug">
                        {q.prompt}
                      </p>
                      <p className="text-[12px] text-orange-400/70 mt-0.5 line-clamp-1">
                        {answerLabel}
                      </p>
                    </div>
                    <span className="text-white/20 text-[10px] mt-1 shrink-0 select-none">
                      {isEditing ? "▲" : "▼"}
                    </span>
                  </button>

                  {/* Inline options */}
                  {isEditing && (
                    <div className="bg-zinc-800/60 px-3 pt-1.5 pb-2 space-y-1 border-t border-white/5">
                      {q.options.map((opt) => {
                        const selected = selectedValues.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            disabled={isSaving}
                            onClick={() => {
                              if (q.multiSelect) {
                                const max = q.maxSelect ?? q.options.length;
                                let next: string[];
                                if (selected) {
                                  next = selectedValues.filter((v) => v !== opt.value);
                                } else {
                                  next = [...selectedValues, opt.value].slice(-max);
                                }
                                onFieldSave(q.id, next);
                              } else {
                                onFieldSave(q.id, opt.value);
                                setEditingField(null);
                              }
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-[13px] transition-colors border ${
                              selected
                                ? "bg-orange-600/15 text-orange-300 border-orange-500/25"
                                : "text-white/65 hover:bg-white/5 border-transparent"
                            }`}
                          >
                            <span>{opt.label}</span>
                            {selected && (
                              <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                      {q.multiSelect && (
                        <button
                          className="w-full text-center text-[12px] text-white/35 py-1.5 hover:text-white/55 transition-colors"
                          onClick={() => setEditingField(null)}
                        >
                          Done selecting
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Retake button */}
          <div className="px-5 py-4">
            <button
              onClick={onRetake}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 text-white/40 text-sm hover:text-white/60 hover:border-white/20 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Retake full assessment
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoachsCorner() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [localProfile, setLocalProfile] = useState<Record<string, unknown> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesInitialized = useRef(false);

  // ── 1. Status gate ─────────────────────────────────────────────────────────
  const statusQuery = useQuery<{
    completed: boolean;
    profile: Record<string, unknown> | null;
  }>({
    queryKey: ["/api/coach-corner/status"],
  });

  const profileCompleted = statusQuery.data?.completed ?? false;

  useEffect(() => {
    if (!statusQuery.isLoading && statusQuery.data && !statusQuery.data.completed) {
      setLocation("/coach-corner/intake");
    }
  }, [statusQuery.isLoading, statusQuery.data, setLocation]);

  useEffect(() => {
    if (statusQuery.data?.profile && localProfile === null) {
      setLocalProfile(statusQuery.data.profile);
    }
  }, [statusQuery.data]);

  // ── 2. Load conversation history ──────────────────────────────────────────
  const conversationQuery = useQuery<{
    conversation: { id: string; status: string } | null;
  }>({
    queryKey: ["/api/coach/conversation"],
    enabled: profileCompleted,
  });

  const convId = conversationQuery.data?.conversation?.id ?? null;

  const messagesQuery = useQuery<{ messages: DbMessage[] }>({
    queryKey: ["/api/coach/conversation", convId, "messages"],
    enabled: !!convId,
    queryFn: () => apiRequest(`/api/coach/conversation/${convId}/messages`),
  });

  useEffect(() => {
    if (messagesQuery.data?.messages && !messagesInitialized.current) {
      messagesInitialized.current = true;
      setConversationId(convId);
      setMessages(messagesQuery.data.messages.map(mapDbMessage));
      // Phase 5: after messages load, check if a follow-up is due (inline delivery)
      checkAndDeliverFollowup();
    }
  }, [messagesQuery.data]);

  // ── Phase 5: Inline follow-up delivery ───────────────────────────────────
  // When the user opens Coach's Corner, if a follow-up is due but the cron
  // hasn't fired yet, we deliver it immediately and append it to the conversation.
  const checkAndDeliverFollowup = useCallback(async () => {
    try {
      const dueResult = await apiRequest("/api/coach/followup/due");
      if (!dueResult?.followup?.id) return;

      const followupId = dueResult.followup.id;
      const deliverResult = await apiRequest(`/api/coach/followup/${followupId}/deliver`, {
        method: "POST",
      });

      // alreadyDelivered = cron beat us to it; reload messages to pick it up
      if (deliverResult?.alreadyDelivered) {
        await messagesQuery.refetch();
        return;
      }

      // Freshly delivered — reload messages to include the new coach message
      if (deliverResult?.success) {
        await messagesQuery.refetch();
      }
    } catch {
      // Non-fatal — follow-up will arrive on next cron tick
    }
  }, [messagesQuery]);

  // ── 3. Questions for profile sheet ────────────────────────────────────────
  const questionsQuery = useQuery<{ questions: CoachCornerQuestion[] }>({
    queryKey: ["/api/coach-corner/questions"],
    enabled: showProfile,
  });

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: ({ text, cid }: { text: string; cid: string | null }) =>
      apiRequest("/api/coach/message", {
        method: "POST",
        body: JSON.stringify({
          message: text,
          specialization: "corner",
          ...(cid ? { conversationId: cid } : {}),
        }),
      }),
    onSuccess: (data: {
      conversationId: string;
      messageId: string;
      response: CoachStructuredResponse;
    }) => {
      setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          id: data.messageId,
          role: "coach",
          structured: data.response,
          createdAt: new Date().toISOString(),
        },
      ]);
      setIsLoading(false);
    },
    onError: () => {
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "coach",
          structured: {
            whatIFound:
              "I ran into a problem processing your message. This is usually temporary.",
            whatItCouldMean: "Try again in a moment.",
            todayPlan: null,
            learningOpportunity: null,
          },
          createdAt: new Date().toISOString(),
        },
      ]);
    },
  });

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    setInputText("");
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      },
    ]);
    setIsLoading(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    sendMutation.mutate({ text, cid: conversationId });
  }, [inputText, isLoading, conversationId, sendMutation]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  // ── Profile field patch ────────────────────────────────────────────────────
  const patchMutation = useMutation({
    mutationFn: (answers: Record<string, string | string[]>) =>
      apiRequest("/api/coach-corner/profile", {
        method: "PATCH",
        body: JSON.stringify({ answers }),
      }),
    onSuccess: (data: { profile: Record<string, unknown> }) => {
      setLocalProfile(data.profile);
      queryClient.invalidateQueries({ queryKey: ["/api/coach-corner/status"] });
    },
  });

  const handleFieldSave = (questionId: string, value: string | string[]) => {
    // Optimistic: find the question's target field and update local state immediately
    const question = questionsQuery.data?.questions.find((q) => q.id === questionId);
    if (question && localProfile) {
      setLocalProfile({ ...localProfile, [question.target]: value });
    }
    patchMutation.mutate({ [questionId]: value });
  };

  // ── Loading / gate ─────────────────────────────────────────────────────────
  if (statusQuery.isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-orange-400/40 animate-bounce"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!profileCompleted) return null;

  // ─── Render ───────────────────────────────────────────────────────────────
  const hasMessages = messages.length > 0;

  return (
    <div
      className="text-white flex flex-col h-full"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        backgroundImage:
          "linear-gradient(rgba(0,0,0,0.30), rgba(0,0,0,0.25)), url('/images/chefs-corner-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center 30%",
      }}
    >
      {/* Centered column — constrains everything to a readable width on desktop.
          On mobile it fills full width; on desktop it sits inside the main content
          area (right of sidebar, left of copilot) and never touches fixed borders. */}
      <div className="flex-1 flex flex-col w-full max-w-2xl mx-auto min-h-0">

        {/* Header — title shown in DesktopHeader; only Edit profile needed here */}
        <div className="shrink-0 bg-black/50 backdrop-blur-md flex items-center justify-end px-4 h-14">
          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-white/8 border border-white/15 text-white/70 text-xs hover:text-white hover:bg-white/12 transition-colors"
            aria-label="Edit coaching profile"
          >
            <Settings className="w-3.5 h-3.5" />
            Edit profile
          </button>
        </div>

        {/* Scrollable messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5">
          {!hasMessages && !conversationQuery.isLoading && !messagesQuery.isLoading ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center min-h-[58vh] text-center select-none">
              <img
                src="/assets/ChefBlackApron.png"
                alt="Coach"
                className="w-44 h-auto mb-3"
              />
              <h2 className="text-2xl font-bold text-white mb-2">
                What's on your mind?
              </h2>
              <p className="text-sm text-white max-w-[240px] leading-relaxed drop-shadow-md">
                Your data, your patterns — let's figure it out together.
              </p>
            </div>
          ) : (
            <div className="space-y-5 py-1">
              {messages.map((msg) =>
                msg.role === "user" ? (
                  <UserBubble key={msg.id} content={msg.content!} />
                ) : (
                  <CoachBubble key={msg.id} structured={msg.structured!} />
                )
              )}
              {isLoading && <ThinkingBubble />}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar — sits at the bottom of the centered column */}
        <div
          className="shrink-0 bg-black/50 backdrop-blur-md px-4 pt-3"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))" }}
        >
          <div className="flex items-end gap-2.5">
            <Textarea
              ref={textareaRef}
              value={inputText}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask Coach anything…"
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none bg-zinc-900 border border-white/25 text-white placeholder:text-white/45 text-sm rounded-xl py-3 px-4 focus:outline-none focus:ring-1 focus:ring-orange-500/60 focus:border-orange-500/50 disabled:opacity-50 transition-colors"
              style={{ lineHeight: "1.5", minHeight: "44px", maxHeight: "120px" }}
            />
            <Button
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading}
              size="icon"
              className="w-11 h-11 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:bg-zinc-700 shrink-0 transition-colors"
              aria-label="Send message"
            >
              <Send className="w-4 h-4 text-white" />
            </Button>
          </div>
        </div>

      </div>

      {/* Behavioral Profile sheet — portal, renders outside the flow */}
      <ProfileSheet
        open={showProfile}
        onClose={() => setShowProfile(false)}
        profile={localProfile}
        questions={questionsQuery.data?.questions ?? []}
        onFieldSave={handleFieldSave}
        onRetake={() => {
          setShowProfile(false);
          setLocation("/coach-corner/intake");
        }}
        isSaving={patchMutation.isPending}
      />
    </div>
  );
}
