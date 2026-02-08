import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Calendar, Trash2, Copy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { proStore } from "@/lib/proData";
import { getAuthHeaders } from "@/lib/auth";

interface BoardItem {
  id: string;
  boardId: string;
  dayIndex: number;
  slot: string;
  mealId: string;
  title: string;
  servings: string;
  macros: { kcal?: number; protein?: number; carbs?: number; fat?: number };
  ingredients: Array<{ name: string; qty: string }>;
  createdAt: string;
}

interface Board {
  id: string;
  userId: string;
  program: string;
  title: string;
  startDate: string;
  days: number;
  lastUpdatedByUserId: string | null;
  lastUpdatedByRole: string | null;
  updatedAt: string;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SLOTS = ["breakfast", "lunch", "dinner", "snacks"] as const;
const SLOT_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

export default function ProBoardViewer() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/pro/clients/:clientId/board/:program");
  const clientId = params?.clientId as string;
  const program = params?.program as string;

  const client = proStore.getClient(clientId);
  const clientName = client?.name || "Client";

  const [board, setBoard] = useState<Board | null>(null);
  const [items, setItems] = useState<BoardItem[]>([]);
  const [accessRole, setAccessRole] = useState<string>("client");
  const [permissions, setPermissions] = useState({ canViewMacros: true, canAddMeals: true, canEditPlan: true });
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(0);

  const fetchBoard = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`/api/pro/board/clients/${clientId}/boards/${program}/current`, {
        headers: { ...headers },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch board");
      }
      const data = await res.json();
      setBoard(data.board);
      setItems(data.items);
      setAccessRole(data.accessRole);
      setPermissions(data.permissions);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [clientId, program, toast]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const deleteItem = async (itemId: string) => {
    if (!board) return;
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`/api/pro/board/clients/${clientId}/boards/${board.id}/items/${itemId}`, {
        method: "DELETE",
        headers: { ...headers },
      });
      if (!res.ok) throw new Error("Failed to delete");
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      toast({ title: "Removed", description: "Meal removed from board." });
    } catch {
      toast({ title: "Error", description: "Could not remove item.", variant: "destructive" });
    }
  };

  const repeatDay = async () => {
    if (!board) return;
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`/api/pro/board/clients/${clientId}/boards/${board.id}/repeat-day`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ sourceDayIndex: selectedDay }),
      });
      if (!res.ok) throw new Error("Failed to repeat day");
      await fetchBoard();
      toast({ title: "Day Repeated", description: `${DAY_LABELS[selectedDay]}'s meals copied to all days.` });
    } catch {
      toast({ title: "Error", description: "Could not repeat day.", variant: "destructive" });
    }
  };

  const dayItems = items.filter((i) => i.dayIndex === selectedDay);

  const roleBadge = accessRole === "trainer" ? "Coach View" : accessRole === "physician" ? "Physician View" : "Client View";

  const programLabel = (() => {
    switch (program) {
      case "smart": return "General Nutrition";
      case "athlete": return "Performance";
      case "diabetic": return "Diabetic";
      case "glp1": return "GLP-1";
      case "medical": return "Anti-Inflammatory";
      default: return program;
    }
  })();

  const backPath = accessRole === "physician"
    ? `/pro/clients/${clientId}/clinician`
    : `/pro/clients/${clientId}/trainer`;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen text-white bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2">
          <button
            onClick={() => setLocation(backPath)}
            className="flex items-center gap-1 text-white p-2 rounded-lg flex-shrink-0 active:scale-[0.98] transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">
              {clientName}'s Meal Board
            </h1>
            <p className="text-xs text-white/60">{programLabel}</p>
          </div>
          <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            {roleBadge}
          </span>
        </div>

        <div className="px-4 pb-2">
          <div className="bg-amber-900/40 border border-amber-500/30 rounded-xl px-3 py-2">
            <p className="text-xs text-amber-200">
              Editing <span className="font-semibold">{clientName}</span>'s meal plan. Changes save directly to their board.
            </p>
          </div>
        </div>

        <div className="flex gap-1 px-4 pb-3 overflow-x-auto">
          {Array.from({ length: board?.days || 7 }, (_, i) => (
            <button
              key={i}
              onClick={() => setSelectedDay(i)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-[0.98] flex-shrink-0 ${
                selectedDay === i
                  ? "bg-white text-black"
                  : "bg-white/10 text-white/70 border border-white/20"
              }`}
            >
              {DAY_LABELS[i] || `Day ${i + 1}`}
            </button>
          ))}
        </div>
      </div>

      <div
        className="max-w-3xl mx-auto px-4 space-y-4 pb-16"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12rem)" }}
      >
        {board?.lastUpdatedByRole && board.lastUpdatedByRole !== "client" && (
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Calendar className="h-3 w-3" />
            <span>
              Last updated by {board.lastUpdatedByRole === "trainer" ? "coach" : "physician"}{" "}
              {board.updatedAt ? new Date(board.updatedAt).toLocaleDateString() : ""}
            </span>
          </div>
        )}

        {SLOTS.map((slot) => {
          const slotItems = dayItems.filter((i) => i.slot === slot);
          return (
            <div key={slot}>
              <h3 className="text-sm font-semibold text-white/80 mb-2 uppercase tracking-wide">
                {SLOT_LABELS[slot]}
              </h3>
              {slotItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/20 p-4 text-center text-white/40 text-sm">
                  No {SLOT_LABELS[slot].toLowerCase()} planned
                </div>
              ) : (
                <div className="space-y-2">
                  {slotItems.map((item) => (
                    <Card key={item.id} className="bg-white/5 border border-white/15">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{item.title}</p>
                            <div className="flex gap-3 mt-1 text-[11px] text-white/50">
                              {item.macros?.kcal != null && <span>{item.macros.kcal} kcal</span>}
                              {item.macros?.protein != null && <span>{item.macros.protein}g P</span>}
                              {item.macros?.carbs != null && <span>{item.macros.carbs}g C</span>}
                              {item.macros?.fat != null && <span>{item.macros.fat}g F</span>}
                            </div>
                          </div>
                          {permissions.canEditPlan && (
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="p-1.5 rounded-lg text-red-400/70 transition-all active:scale-[0.98]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {permissions.canEditPlan && dayItems.length > 0 && (
          <Button
            onClick={repeatDay}
            className="w-full bg-white/10 border border-white/20 text-white active:scale-[0.98]"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy {DAY_LABELS[selectedDay]} to All Days
          </Button>
        )}

        {!permissions.canEditPlan && accessRole !== "client" && (
          <div className="rounded-xl bg-yellow-900/20 border border-yellow-500/30 p-4 text-center">
            <p className="text-sm text-yellow-200/80">
              You have view-only access to this board. Contact the client to request edit permissions.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
