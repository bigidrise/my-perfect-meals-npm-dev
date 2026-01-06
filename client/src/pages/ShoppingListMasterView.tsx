import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Edit2,
  Home,
  ShoppingCart,
  Mic,
  ListPlus,
} from "lucide-react";
import { useLocation } from "wouter";
import TrashButton from "@/components/ui/TrashButton";
import {
  useShoppingListStore,
  ShoppingListItem,
} from "@/stores/shoppingListStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MACRO_SOURCES, getMacroSourceBySlug } from "@/lib/macroSourcesConfig";
import AddOtherItems from "@/components/AddOtherItems";
import { readOtherItems } from "@/stores/otherItemsStore";
import { buildWalmartSearchUrl } from "@/lib/walmartLinkBuilder";

export default function ShoppingListMasterView() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Extract "from" query parameter once on mount
  const [fromSlug, setFromSlug] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("from") || "";
  });

  // Subscribe to Zustand store
  const items = useShoppingListStore((s) => s.items);
  const addItem = useShoppingListStore((s) => s.addItem);
  const toggleItem = useShoppingListStore((s) => s.toggleItem);
  const removeItem = useShoppingListStore((s) => s.removeItem);
  const clearChecked = useShoppingListStore((s) => s.clearChecked);
  const clearAll = useShoppingListStore((s) => s.clearAll);
  const updateItem = useShoppingListStore((s) => s.updateItem);
  const replaceItems = useShoppingListStore((s) => s.replaceItems);

  const [editingId, setEditingId] = useState<string | null>(null);
  
  const SHOPPING_OPTS_KEY = "shoppingList.opts.v1";
  
  const [opts, setOpts] = useState(() => {
    const defaults = {
      groupByAisle: false,
      excludePantryStaples: false,
      scopeByWeek: false,
      rounding: "friendly" as "friendly" | "none",
    };
    try {
      const saved = localStorage.getItem(SHOPPING_OPTS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaults, ...parsed };
      }
    } catch {}
    return defaults;
  });
  
  const [purchasedOpen, setPurchasedOpen] = useState(true);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [barcodeText, setBarcodeText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any | null>(null);

  type ShoppingOpts = typeof opts;
  
  const toggleOpt = useCallback(<K extends keyof ShoppingOpts>(key: K) => {
    setOpts((prev: ShoppingOpts) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(SHOPPING_OPTS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);
  
  const setOptValue = useCallback(<K extends keyof ShoppingOpts>(key: K, value: ShoppingOpts[K]) => {
    setOpts((prev: ShoppingOpts) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(SHOPPING_OPTS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Wrapper for toggleItem with walkthrough event
  const handleToggleItem = useCallback(
    (id: string) => {
      // Check current state before toggling
      const item = items.find((i) => i.id === id);
      const wasUnchecked = item && !item.isChecked;

      toggleItem(id);

      // Only dispatch event if item was unchecked and is now being checked
      if (wasUnchecked) {
        setTimeout(() => {
          const event = new CustomEvent("walkthrough:event", {
            detail: { testId: "shopping-item-checked", event: "done" },
          });
          window.dispatchEvent(event);
        }, 500);
      }
    },
    [items, toggleItem],
  );

  const counts = useMemo(
    () => ({
      total: items.length,
      checked: items.filter((i) => i.isChecked).length,
    }),
    [items],
  );

  const onInlineEdit = useCallback(
    (id: string, field: "quantity" | "unit" | "name" | "notes") => {
      return (e: React.ChangeEvent<HTMLInputElement>) => {
        const v =
          field === "quantity" ? Number(e.target.value) : e.target.value;
        updateItem(
          id,
          field === "quantity"
            ? { quantity: Number.isFinite(v as number) ? (v as number) : 1 }
            : { [field]: v },
        );
      };
    },
    [updateItem],
  );

  const onClearChecked = useCallback(() => {
    if (!confirm("Clear all checked items?")) return;
    clearChecked();

    // Dispatch "done" event after clearing checked items (500ms debounce)
    setTimeout(() => {
      const event = new CustomEvent("walkthrough:event", {
        detail: { testId: "shopping-list-cleared", event: "done" },
      });
      window.dispatchEvent(event);
    }, 500);
  }, [clearChecked]);

  const onClearAll = useCallback(() => {
    if (!confirm("Clear entire shopping list?")) return;
    clearAll();

    // Dispatch "done" event after clearing all items (500ms debounce)
    setTimeout(() => {
      const event = new CustomEvent("walkthrough:event", {
        detail: { testId: "shopping-list-cleared", event: "done" },
      });
      window.dispatchEvent(event);
    }, 500);
  }, [clearAll]);

  const onCopyToClipboard = useCallback(async () => {
    const mealItems = items
      .filter((i) => !i.isChecked)
      .map(
        (i) =>
          `• ${i.name}${i.quantity ? ` — ${i.quantity}${i.unit ? " " + i.unit : ""}` : ""}`,
      );

    const otherItems = readOtherItems()
      .items.filter((i) => !i.checked)
      .map(
        (i) =>
          `• ${i.brand ? i.brand + " " : ""}${i.name} — ${i.qty} ${i.unit} (${i.category})`,
      );

    const sections = [];
    if (mealItems.length > 0) {
      sections.push("Meal Ingredients:\n" + mealItems.join("\n"));
    }
    if (otherItems.length > 0) {
      sections.push("Other Items:\n" + otherItems.join("\n"));
    }

    const text = sections.join("\n\n");
    const totalCount = mealItems.length + otherItems.length;

    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: `${totalCount} items copied`,
      });
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      toast({
        title: "Copied to clipboard",
        description: `${totalCount} items copied`,
      });
    }
  }, [items, toast]);

  const uncheckedItems = useMemo(() => {
    let filtered = items.filter((i) => !i.isChecked);
    if (opts.excludePantryStaples) {
      filtered = filtered.filter((i) => !i.isPantryStaple);
    }
    return filtered;
  }, [items, opts.excludePantryStaples]);

  const checkedItems = useMemo(() => {
    let filtered = items.filter((i) => i.isChecked);
    if (opts.excludePantryStaples) {
      filtered = filtered.filter((i) => !i.isPantryStaple);
    }
    return filtered;
  }, [items, opts.excludePantryStaples]);

  const handleShopAtWalmart = useCallback(() => {
    const activeItems = items.filter((i) => !i.isChecked);

    if (activeItems.length === 0) {
      toast({
        title: "No items to send",
        description:
          "Add items to your shopping list before sending to Walmart.",
      });
      return;
    }

    const url = buildWalmartSearchUrl(activeItems);

    // fail-safe: if something goes wrong, just land them on walmart.com
    if (!url || typeof url !== "string") {
      window.open("https://www.walmart.com/", "_blank", "noopener,noreferrer");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }, [items, toast]);

  const parseItemsFromText = useCallback((raw: string): string[] => {
    return raw
      .split(/[\n,;]+/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }, []);

  const addManyItems = useCallback(
    (raw: string) => {
      const names = parseItemsFromText(raw);
      if (!names.length) {
        toast({
          title: "No items found",
          description: "Type or say at least one item name.",
        });
        return;
      }
      names.forEach((name) => {
        addItem({
          name,
          quantity: 1,
          unit: "",
        });
      });
      toast({
        title: "Items added",
        description: `${names.length} items added to your shopping list.`,
      });

      // Dispatch "interacted" event
      setTimeout(() => {
        const interactedEvent = new CustomEvent("walkthrough:event", {
          detail: { testId: "shopping-list-interacted", event: "interacted" },
        });
        window.dispatchEvent(interactedEvent);
      }, 300);

      // Dispatch "completed" event
      setTimeout(() => {
        const completedEvent = new CustomEvent("walkthrough:event", {
          detail: { testId: "shopping-list-completed", event: "completed" },
        });
        window.dispatchEvent(completedEvent);
      }, 500);
    },
    [addItem, parseItemsFromText, toast],
  );

  const startListening = useCallback(() => {
    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        toast({
          title: "Voice not supported",
          description:
            "Your browser does not support voice input. You can type items instead.",
        });
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript as string;
        setVoiceText((prev) => (prev ? `${prev}, ${transcript}` : transcript));
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      toast({
        title: "Voice error",
        description: "Unable to start voice recognition.",
      });
      setIsListening(false);
    }
  }, [toast]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  }, []);

  const groupedUnchecked = useMemo(() => {
    if (!opts.groupByAisle) return { All: uncheckedItems };
    const map: Record<string, ShoppingListItem[]> = {};
    for (const it of uncheckedItems) {
      const k = it.category || "Other";
      (map[k] ||= []).push(it);
    }
    return map;
  }, [uncheckedItems, opts.groupByAisle]);

  const groupedChecked = useMemo(() => {
    if (!opts.groupByAisle) return { All: checkedItems };
    const map: Record<string, ShoppingListItem[]> = {};
    for (const it of checkedItems) {
      const k = it.category || "Other";
      (map[k] ||= []).push(it);
    }
    return map;
  }, [checkedItems, opts.groupByAisle]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      {/* Universal Safe-Area Header */}
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-8 py-3 flex items-center gap-3">
          {/* Back Button */}

          {/* Title */}
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            Master Shopping List
          </h1>
        </div>
      </div>

      <div
        className="container mx-auto p-4 max-w-4xl space-y-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        {/* Stats */}
        <div
          data-testid="shopping-summary-card"
          className="rounded-2xl bg-white/5 border border-white/20 p-4 backdrop-blur"
        >
          <div className="text-white/70 text-sm">
            {counts.total} items • {counts.checked} checked
          </div>

          {/* Add Item Actions */}
          <div
            data-testid="shopping-add-buttons"
            className="mt-4 flex flex-wrap gap-2"
          >
            <Button
              data-wt="msl-barcode-button"
              onClick={() => setBarcodeModalOpen(true)}
              className="bg-black/60 border border-white/20 text-white hover:bg-black/70 text-sm"
              size="sm"
              data-testid="button-barcode-manual"
            >
              Enter Barcode
            </Button>
            <Button
              data-wt="msl-voice-add-button"
              onClick={() => setVoiceModalOpen(true)}
              className="bg-black/60 border border-white/20 text-white hover:bg-black/70 text-sm"
              size="sm"
              data-testid="button-voice-add"
            >
              <Mic className="h-4 w-4 mr-2" />
              Voice Add
            </Button>
            <Button
              data-wt="msl-bulk-add-button"
              onClick={() => setBulkModalOpen(true)}
              className="bg-black/60 border border-white/20 text-white hover:bg-black/70 text-sm"
              size="sm"
              data-testid="button-bulk-add"
            >
              <ListPlus className="h-4 w-4 mr-2" />
              Bulk Add
            </Button>
          </div>

          {/* Options */}
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center gap-3">
            <Button
              onClick={() => toggleOpt("groupByAisle")}
              aria-pressed={opts.groupByAisle}
              className={`text-sm px-3 py-1.5 h-auto transition-all ${
                opts.groupByAisle
                  ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white border-orange-400/50"
                  : "bg-black/60 border border-white/20 text-white hover:bg-black/70"
              }`}
              data-testid="option-group-by-aisle"
            >
              Group by aisle
            </Button>
            <Button
              onClick={() => toggleOpt("excludePantryStaples")}
              aria-pressed={opts.excludePantryStaples}
              className={`text-sm px-3 py-1.5 h-auto transition-all ${
                opts.excludePantryStaples
                  ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white border-orange-400/50"
                  : "bg-black/60 border border-white/20 text-white hover:bg-black/70"
              }`}
              data-testid="option-exclude-pantry"
            >
              Exclude pantry staples
            </Button>
            <select
              value={opts.rounding}
              onChange={(e) =>
                setOptValue("rounding", e.target.value as "none" | "friendly")
              }
              className="bg-white/10 border border-white/20 text-white/90 text-sm rounded-md px-2 py-1"
              title="Rounding"
              data-testid="select-rounding"
            >
              <option value="friendly">Rounding: Friendly</option>
              <option value="none">Rounding: None</option>
            </select>
          </div>
        </div>
        {/* Add Other Items Section */}
        <AddOtherItems />
        {/* Walmart Card - Single Integration */}
        <div className="rounded-2xl border border-white/20 bg-black/60 text-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Walmart Grocery</div>
              <div className="text-xs inline-flex items-center gap-2 mt-1">
                <span className="rounded-full px-2 py-0.5 bg-yellow-500/20 border border-yellow-300/40 text-yellow-200 text-[11px]">
                  Live — Search on Walmart
                </span>
                <span className="text-white/60 text-[11px]">
                  Full cart & delivery integration pending Walmart approval
                </span>
              </div>
              <div className="text-xs text-white/70 mt-2 max-w-md">
                Tap the button below to open your shopping list as a search on
                Walmart.com. You can choose your preferred brands, add to cart,
                and complete pickup or delivery inside Walmart.
              </div>
            </div>

            <Button
              data-testid="shopping-send-to-store"
              onClick={handleShopAtWalmart}
              className="rounded-xl px-4 py-2 border border-white/40 bg-blue-600/30 hover:bg-blue-600/40 text-white text-sm whitespace-nowrap"
            >
              Shop this list on Walmart
            </Button>
          </div>
        </div>
        {/* Actions */}
        {(counts.checked > 0 || counts.total > 0) && (
          <div
            data-testid="shopping-clear-buttons"
            className="flex flex-wrap gap-2"
          >
            {counts.checked > 0 && (
              <Button
                onClick={onClearChecked}
                className="bg-orange-600/20 border border-orange-400/30 text-orange-200 hover:bg-orange-600/30"
                size="sm"
                data-testid="button-clear-purchased"
              >
                Clear Purchased
              </Button>
            )}
            {counts.total > 0 && (
              <Button
                onClick={onClearAll}
                variant="destructive"
                size="sm"
                data-testid="shopping-clear-button"
              >
                Clear All
              </Button>
            )}
          </div>
        )}
        {/* Shopping List - Unchecked Items */}
        {uncheckedItems.length === 0 && checkedItems.length === 0 ? (
          <div className="rounded-2xl bg-white/5 border border-white/20 p-12 text-center backdrop-blur">
            <ShoppingCart className="h-16 w-16 text-white/30 mx-auto mb-4" />
            <p className="text-white/60 text-lg">Your shopping list is empty</p>
            <p className="text-white/40 text-sm mt-2">
              Paste items or quick add to get started
            </p>
          </div>
        ) : (
          <div data-testid="shopping-list" className="space-y-4">
            {Object.entries(groupedUnchecked).map(([cat, arr]) => (
              <div
                key={cat}
                className="rounded-2xl bg-white/5 border border-white/20 p-4 backdrop-blur"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-white font-semibold">{cat}</h3>
                    <span className="text-white/50 text-xs">
                      {arr.length} items
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-9 px-3 text-sm bg-white/10 border border-white/25 text-white active:scale-[.98]"
                      onClick={() => {
                        const updated = items.map((i) =>
                          cat === "All" || i.category === cat
                            ? { ...i, isChecked: true }
                            : i,
                        );
                        replaceItems(updated);
                      }}
                      data-testid={`button-check-all-${cat}`}
                    >
                      Check all
                    </Button>
                    <Button
                      size="sm"
                      className="h-9 px-3 text-sm bg-white/10 border border-white/25 text-white active:scale-[.98]"
                      onClick={() => {
                        const updated = items.map((i) =>
                          cat === "All" || i.category === cat
                            ? { ...i, isChecked: false }
                            : i,
                        );
                        replaceItems(updated);
                      }}
                      data-testid={`button-uncheck-all-${cat}`}
                    >
                      Uncheck
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  {arr.map((item, idx) => (
                    <div
                      data-testid={
                        idx === 0 && cat === Object.keys(groupedUnchecked)[0]
                          ? "shopping-first-item"
                          : undefined
                      }
                      data-wt="msl-item-card"
                      key={item.id}
                      className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                        item.isChecked ? "bg-white/5 opacity-50" : "bg-white/10"
                      }`}
                    >
                      <Button
                        data-wt="msl-item-checkoff"
                        onClick={() => handleToggleItem(item.id)}
                        aria-pressed={item.isChecked || false}
                        size="sm"
                        className={`h-8 w-8 p-0 flex-shrink-0 transition-all ${
                          item.isChecked
                            ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white border-orange-400/50"
                            : "bg-black/60 border border-white/20 text-white hover:bg-black/70"
                        }`}
                        data-testid={`checkbox-bought-${item.id}`}
                      >
                        {item.isChecked && <Check className="h-4 w-4" />}
                      </Button>

                      {editingId === item.id ? (
                        <>
                          <Input
                            defaultValue={item.name}
                            onBlur={(e) => {
                              updateItem(item.id, { name: e.target.value });
                              setEditingId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateItem(item.id, {
                                  name: (e.target as HTMLInputElement).value,
                                });
                                setEditingId(null);
                              }
                            }}
                            className="flex-1 bg-black/30 border-white/30 text-white h-8"
                            autoFocus
                          />
                          <Input
                            defaultValue={item.quantity ?? ""}
                            onBlur={onInlineEdit(item.id, "quantity")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const val = Number(
                                  (e.target as HTMLInputElement).value,
                                );
                                updateItem(item.id, {
                                  quantity: Number.isFinite(val) ? val : 1,
                                });
                              }
                            }}
                            className="w-16 bg-black/30 border-white/30 text-white h-8"
                            placeholder="Qty"
                            data-testid={`input-qty-${item.id}`}
                          />
                          <Input
                            defaultValue={item.unit ?? ""}
                            onBlur={onInlineEdit(item.id, "unit")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateItem(item.id, {
                                  unit: (e.target as HTMLInputElement).value,
                                });
                              }
                            }}
                            className="w-20 bg-black/30 border-white/30 text-white h-8"
                            placeholder="Unit"
                            data-testid={`input-unit-${item.id}`}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                            className="text-white hover:bg-white/10"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <div
                            className={`flex-1 text-white ${item.isChecked ? "line-through" : ""}`}
                          >
                            {item.name}
                          </div>
                          <div className="text-white/70 text-sm shrink-0">
                            {item.quantity} {item.unit}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(item.id)}
                            className="text-white hover:bg-white/10"
                            data-testid={`button-edit-${item.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <TrashButton
                            data-wt="msl-item-trash"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                            confirm
                            confirmMessage="Delete this shopping list item?"
                            ariaLabel="Delete item"
                            title="Delete item"
                            data-testid={`button-delete-${item.id}`}
                          />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Purchased Today Section */}
            {checkedItems.length > 0 && (
              <div className="rounded-2xl bg-white/5 border border-white/20 overflow-hidden backdrop-blur mt-6">
                <button
                  onClick={() => setPurchasedOpen(!purchasedOpen)}
                  className="w-full p-4 flex items-center justify-between text-white hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-emerald-400" />
                    <span className="font-semibold">
                      Purchased Today ({checkedItems.length})
                    </span>
                  </div>
                  {purchasedOpen ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>
                {purchasedOpen && (
                  <div className="p-4 pt-0 space-y-4">
                    {Object.entries(groupedChecked).map(([cat, arr]) => (
                      <div key={cat}>
                        <h4 className="text-white/70 text-sm font-semibold mb-2">
                          {cat}
                        </h4>
                        <div className="space-y-2">
                          {arr.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-3 p-2 rounded-lg bg-white/5 opacity-60"
                            >
                              <Button
                                onClick={() => handleToggleItem(item.id)}
                                aria-pressed={item.isChecked || false}
                                size="sm"
                                className="h-8 w-8 p-0 flex-shrink-0 bg-gradient-to-r from-orange-500 to-orange-600 text-white border-orange-400/50"
                                data-testid={`checkbox-purchased-${item.id}`}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <div className="flex-1 text-white line-through">
                                {item.name}
                              </div>
                              <div className="text-white/70 text-sm shrink-0">
                                {item.quantity} {item.unit}
                              </div>
                              <TrashButton
                                size="sm"
                                onClick={() => removeItem(item.id)}
                                confirm
                                confirmMessage="Delete this purchased item?"
                                ariaLabel="Delete item"
                                title="Delete item"
                                data-testid={`button-delete-purchased-${item.id}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {/* Voice Add Modal */}
        {voiceModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="w-full max-w-md rounded-2xl bg-black/90 border border-white/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-white text-lg font-semibold">
                  Voice Add Items
                </h2>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                  onClick={() => {
                    stopListening();
                    setVoiceModalOpen(false);
                  }}
                >
                  ✕
                </Button>
              </div>
              <p className="text-xs text-white/70">
                Speak your items naturally, like:{" "}
                <span className="italic">
                  "milk, eggs, chicken breast, spinach"
                </span>
                . You can also edit the text below before adding.
              </p>
              <textarea
                value={voiceText}
                onChange={(e) => setVoiceText(e.target.value)}
                rows={4}
                className="w-full rounded-xl bg-black/60 border border-white/25 text-white text-sm p-2 focus:outline-none focus:ring-1 focus:ring-white/50"
                placeholder="milk, eggs, chicken breast, spinach..."
              />
              <div className="flex items-center justify-between">
                <div className="text-xs text-white/60">
                  {isListening
                    ? "Listening..."
                    : "Tap Start to capture your voice."}
                </div>
                <div className="flex gap-2">
                  {!isListening ? (
                    <Button
                      size="sm"
                      className="bg-emerald-600/30 border border-emerald-400/40 text-emerald-100 hover:bg-emerald-600/40"
                      onClick={startListening}
                      data-testid="button-voice-start"
                    >
                      <Mic className="h-4 w-4 mr-1" />
                      Start
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-red-600/30 border border-red-400/40 text-red-100 hover:bg-red-600/40"
                      onClick={stopListening}
                      data-testid="button-voice-stop"
                    >
                      Stop
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="bg-blue-600/30 border border-blue-400/40 text-blue-100 hover:bg-blue-600/40"
                    onClick={() => {
                      addManyItems(voiceText);
                      setVoiceText("");
                      stopListening();
                      setVoiceModalOpen(false);
                    }}
                    disabled={!voiceText.trim()}
                    data-testid="button-voice-add-items"
                  >
                    Add Items
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Barcode Manual Entry Modal */}
        {barcodeModalOpen && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-black/90 border border-white/20 rounded-2xl p-6 w-full max-w-sm space-y-4">
              <h3 className="text-white text-xl font-semibold">
                Enter Barcode
              </h3>
              <Input
                value={barcodeText}
                onChange={(e) => setBarcodeText(e.target.value)}
                placeholder="Type barcode number..."
                className="bg-black/40 border-white/30 text-white placeholder:text-white/40"
                data-testid="input-barcode"
              />

              <div className="flex justify-end gap-3">
                <Button
                  onClick={() => {
                    setBarcodeModalOpen(false);
                    setBarcodeText("");
                  }}
                  className="bg-white/10 border border-white/20 text-white"
                >
                  Cancel
                </Button>

                <Button
                  onClick={() => {
                    if (barcodeText.trim()) {
                      // Dispatch "interacted" event
                      setTimeout(() => {
                        const interactedEvent = new CustomEvent(
                          "walkthrough:event",
                          {
                            detail: {
                              testId: "shopping-list-interacted",
                              event: "interacted",
                            },
                          },
                        );
                        window.dispatchEvent(interactedEvent);
                      }, 300);

                      addItem({
                        name: "Unknown Item",
                        quantity: 1,
                        unit: "",
                        notes: `Barcode: ${barcodeText.trim()}`,
                      });
                      setBarcodeText("");
                      setBarcodeModalOpen(false);
                      toast({
                        title: "Item added",
                        description: `Barcode ${barcodeText.trim()} added`,
                      });

                      // Dispatch "completed" event
                      setTimeout(() => {
                        const completedEvent = new CustomEvent(
                          "walkthrough:event",
                          {
                            detail: {
                              testId: "shopping-list-completed",
                              event: "completed",
                            },
                          },
                        );
                        window.dispatchEvent(completedEvent);
                      }, 500);
                    }
                  }}
                  className="bg-blue-600/40 border border-blue-300/40 text-blue-100 hover:bg-blue-600/50"
                  data-testid="button-add-barcode"
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
        )}
        {/* Bulk Add Modal */}
        {bulkModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="w-full max-w-md rounded-2xl bg-black/90 border border-white/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-white text-lg font-semibold">
                  Bulk Add Items
                </h2>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                  onClick={() => setBulkModalOpen(false)}
                >
                  ✕
                </Button>
              </div>
              <p className="text-xs text-white/70">
                Type or paste one item per line, or separate items with commas:
              </p>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={6}
                className="w-full rounded-xl bg-black/60 border border-white/25 text-white text-sm p-2 focus:outline-none focus:ring-1 focus:ring-white/50"
                placeholder={"milk\neggs\nchicken breast\nspinach\nbrown rice"}
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                  onClick={() => setBulkModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-blue-600/30 border border-blue-400/40 text-blue-100 hover:bg-blue-600/40"
                  onClick={() => {
                    addManyItems(bulkText);
                    setBulkText("");
                    setBulkModalOpen(false);
                  }}
                  disabled={!bulkText.trim()}
                  data-testid="button-bulk-add-items"
                >
                  Add Items
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}