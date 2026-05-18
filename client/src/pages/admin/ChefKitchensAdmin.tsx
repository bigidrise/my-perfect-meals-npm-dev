import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { PillButton } from "@/components/ui/pill-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ChefHat,
  ArrowLeft,
  Plus,
  Eye,
  EyeOff,
  Star,
  Zap,
  AlertTriangle,
} from "lucide-react";

type Kitchen = {
  id: string;
  slug: string;
  displayName: string;
  type: string;
  source: string;
  creatorCategory: string;
  status: string;
  isActive: boolean;
  isVisible: boolean;
  isFeatured: boolean;
  displayPriority: number;
  bio: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  brandingImageUrl: string | null;
  userId: string | null;
  activatedAt: string | null;
  createdAt: string;
};

type KitchenFormData = {
  slug: string;
  displayName: string;
  creatorCategory: string;
  bio: string;
  logoUrl: string;
  heroImageUrl: string;
  brandingImageUrl: string;
  displayPriority: number;
  personaPrompt: string;
  flavorProfiles: string;
  cuisineTypes: string;
  techniques: string;
};

const BLANK_FORM: KitchenFormData = {
  slug: "",
  displayName: "",
  creatorCategory: "chef_kitchen",
  bio: "",
  logoUrl: "",
  heroImageUrl: "",
  brandingImageUrl: "",
  displayPriority: 0,
  personaPrompt: "",
  flavorProfiles: "",
  cuisineTypes: "",
  techniques: "",
};

const CATEGORY_LABELS: Record<string, string> = {
  chef_kitchen: "Chef Kitchen",
  standard_creator: "Standard Creator",
  supplement_partner: "Supplement Partner",
  athlete_partner: "Athlete Partner",
};

const CATEGORY_COLORS: Record<string, string> = {
  chef_kitchen: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  standard_creator: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  supplement_partner: "bg-green-500/20 text-green-300 border-green-500/30",
  athlete_partner: "bg-purple-500/20 text-purple-300 border-purple-500/30",
};

export default function ChefKitchensAdmin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Kitchen | null>(null);
  const [editConfig, setEditConfig] = useState<any>(null);
  const [form, setForm] = useState<KitchenFormData>(BLANK_FORM);

  useEffect(() => {
    document.title = "Chef Kitchens Admin | MPM";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/admin/chef-kitchens"), {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setKitchens(data.kitchens ?? []);
    } catch {
      toast({ title: "Failed to load kitchens", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const apiAction = async (method: string, path: string, body?: any, label?: string) => {
    const key = `${method}:${path}`;
    setActionLoading(key);
    try {
      const res = await fetch(apiUrl(`/api/admin/chef-kitchens${path}`), {
        method,
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (label) toast({ title: `${label} — done` });
      await load();
      return data;
    } catch (e: any) {
      toast({ title: `Failed`, description: e.message, variant: "destructive" });
      throw e;
    } finally {
      setActionLoading(null);
    }
  };

  const toggle = (slug: string, field: "isActive" | "isVisible" | "isFeatured", current: boolean) => {
    const labels: Record<string, string> = {
      isActive: current ? "Deactivated" : "Activated",
      isVisible: current ? "Hidden" : "Made visible",
      isFeatured: current ? "Un-featured" : "Featured",
    };
    apiAction("PATCH", `/${slug}`, { [field]: !current }, labels[field]);
  };

  const openCreate = () => {
    setForm(BLANK_FORM);
    setCreateOpen(true);
  };

  const openEdit = async (k: Kitchen) => {
    setEditTarget(k);
    setActionLoading(`edit:${k.slug}`);
    try {
      const res = await fetch(apiUrl(`/api/admin/chef-kitchens/${k.slug}/config`), {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      const cfg = data.kitchen?.configJson ?? {};
      setEditConfig(cfg);
      setForm({
        slug: k.slug,
        displayName: k.displayName,
        creatorCategory: k.creatorCategory,
        bio: k.bio ?? "",
        logoUrl: k.logoUrl ?? "",
        heroImageUrl: k.heroImageUrl ?? "",
        brandingImageUrl: k.brandingImageUrl ?? "",
        displayPriority: k.displayPriority,
        personaPrompt: cfg.personaPrompt ?? "",
        flavorProfiles: (cfg.style?.flavorProfiles ?? []).join(", "),
        cuisineTypes: (cfg.cuisineTypes ?? []).join(", "),
        techniques: (cfg.style?.techniques ?? []).join(", "),
      });
    } catch {
      toast({ title: "Failed to load kitchen config", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const submitCreate = async () => {
    const payload = {
      slug: form.slug.trim(),
      displayName: form.displayName.trim(),
      creatorCategory: form.creatorCategory,
      bio: form.bio.trim() || undefined,
      logoUrl: form.logoUrl.trim() || undefined,
      heroImageUrl: form.heroImageUrl.trim() || undefined,
      brandingImageUrl: form.brandingImageUrl.trim() || undefined,
      displayPriority: form.displayPriority,
      personaPrompt: form.personaPrompt.trim() || undefined,
      flavorProfiles: form.flavorProfiles.split(",").map(s => s.trim()).filter(Boolean),
      cuisineTypes: form.cuisineTypes.split(",").map(s => s.trim()).filter(Boolean),
      techniques: form.techniques.split(",").map(s => s.trim()).filter(Boolean),
    };
    try {
      await apiAction("POST", "", payload, `Kitchen "${payload.displayName}" created`);
      setCreateOpen(false);
    } catch {}
  };

  const submitEdit = async () => {
    if (!editTarget) return;
    const payload: any = {
      displayName: form.displayName.trim(),
      creatorCategory: form.creatorCategory,
      bio: form.bio.trim() || null,
      logoUrl: form.logoUrl.trim() || null,
      heroImageUrl: form.heroImageUrl.trim() || null,
      brandingImageUrl: form.brandingImageUrl.trim() || null,
      displayPriority: form.displayPriority,
      personaPrompt: form.personaPrompt.trim() || null,
      flavorProfiles: form.flavorProfiles.split(",").map(s => s.trim()).filter(Boolean),
      cuisineTypes: form.cuisineTypes.split(",").map(s => s.trim()).filter(Boolean),
      techniques: form.techniques.split(",").map(s => s.trim()).filter(Boolean),
    };
    try {
      await apiAction("PATCH", `/${editTarget.slug}`, payload, "Saved");
      setEditTarget(null);
    } catch {}
  };

  const deactivate = (slug: string, name: string) => {
    if (!window.confirm(`Deactivate "${name}"? It will be hidden and inactive.`)) return;
    apiAction("DELETE", `/${slug}`, undefined, `"${name}" deactivated`);
  };

  const f = (key: keyof KitchenFormData, val: any) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const isSubmitting = actionLoading === "POST:" || actionLoading?.startsWith("PATCH:");

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setLocation("/admin")}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-white/60" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ChefHat className="h-5 w-5 text-orange-400 flex-shrink-0" />
          <h1 className="text-base font-bold text-white truncate">Chef Kitchens</h1>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-orange-500/20 text-orange-300 border border-orange-500/30 flex-shrink-0">
            Admin
          </span>
        </div>
        <PillButton onClick={openCreate}>
          <Plus className="h-3 w-3 mr-1" /> New Kitchen
        </PillButton>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-3">
        {/* Phase label */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-400/20">
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-amber-200/80">
            <span className="font-semibold">Phase 1 — Dormant.</span> All kitchens are hidden from users until you toggle Visible on. Activation makes generation live.
          </p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-white/40 text-sm">Loading kitchens…</div>
        ) : kitchens.length === 0 ? (
          <div className="py-12 text-center">
            <ChefHat className="h-10 w-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40 text-sm">No kitchens yet. Create the first one.</p>
          </div>
        ) : (
          kitchens.map(k => (
            <div key={k.id} className="rounded-xl border border-white/10 bg-zinc-900 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Icon / logo */}
                  <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                    {k.logoUrl ? (
                      <img src={k.logoUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <ChefHat className="h-5 w-5 text-orange-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm">{k.displayName}</span>
                      <span className="font-mono text-[10px] text-white/40">/{k.slug}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${CATEGORY_COLORS[k.creatorCategory] ?? "bg-white/10 text-white/50 border-white/10"}`}>
                        {CATEGORY_LABELS[k.creatorCategory] ?? k.creatorCategory}
                      </span>
                    </div>
                    {k.bio && (
                      <p className="text-xs text-white/50 mt-0.5 truncate">{k.bio}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {/* Status indicators */}
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${k.isActive ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-white/5 text-white/30 border-white/10"}`}>
                        {k.isActive ? "Active" : "Inactive"}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${k.isVisible ? "bg-blue-500/20 text-blue-300 border-blue-500/30" : "bg-white/5 text-white/30 border-white/10"}`}>
                        {k.isVisible ? "Visible" : "Hidden"}
                      </span>
                      {k.isFeatured && (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Featured
                        </span>
                      )}
                      <span className="text-[9px] text-white/30">priority: {k.displayPriority}</span>
                      {k.source === "admin_created" && (
                        <span className="text-[9px] text-white/30">admin-created</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/5">
                  <PillButton onClick={() => openEdit(k)} disabled={actionLoading === `edit:${k.slug}`}>
                    Edit
                  </PillButton>
                  <PillButton
                    onClick={() => toggle(k.slug, "isActive", k.isActive)}
                    disabled={!!actionLoading}
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    {k.isActive ? "Deactivate" : "Activate"}
                  </PillButton>
                  <PillButton
                    onClick={() => toggle(k.slug, "isVisible", k.isVisible)}
                    disabled={!!actionLoading}
                  >
                    {k.isVisible ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                    {k.isVisible ? "Hide" : "Make Visible"}
                  </PillButton>
                  <PillButton
                    onClick={() => toggle(k.slug, "isFeatured", k.isFeatured)}
                    disabled={!!actionLoading}
                  >
                    <Star className="h-3 w-3 mr-1" />
                    {k.isFeatured ? "Un-feature" : "Feature"}
                  </PillButton>
                  <PillButton
                    onClick={() => deactivate(k.slug, k.displayName)}
                    disabled={!!actionLoading}
                  >
                    Remove
                  </PillButton>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Create Dialog ─────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          className="bg-zinc-900 border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto [&>button.absolute]:hidden"
          onOpenAutoFocus={e => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-white">New Chef Kitchen</DialogTitle>
            <DialogDescription className="text-white/50">
              Create a dormant kitchen. Toggle Active + Visible when ready to launch.
            </DialogDescription>
            <div className="flex justify-end">
              <PillButton onClick={() => setCreateOpen(false)}>Close</PillButton>
            </div>
          </DialogHeader>
          <KitchenForm form={form} onChange={f} isCreate />
          <div className="flex gap-2 justify-end pt-2 border-t border-white/10">
            <PillButton onClick={() => setCreateOpen(false)}>Cancel</PillButton>
            <PillButton onClick={submitCreate} disabled={isSubmitting || !form.slug || !form.displayName}>
              {isSubmitting ? "Creating…" : "Create Kitchen"}
            </PillButton>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ───────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null); }}>
        <DialogContent
          className="bg-zinc-900 border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto [&>button.absolute]:hidden"
          onOpenAutoFocus={e => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-white">Edit — {editTarget?.displayName}</DialogTitle>
            <DialogDescription className="text-white/50 font-mono text-xs">
              /{editTarget?.slug}
            </DialogDescription>
            <div className="flex justify-end">
              <PillButton onClick={() => setEditTarget(null)}>Close</PillButton>
            </div>
          </DialogHeader>
          <KitchenForm form={form} onChange={f} isCreate={false} />
          <div className="flex gap-2 justify-end pt-2 border-t border-white/10">
            <PillButton onClick={() => setEditTarget(null)}>Cancel</PillButton>
            <PillButton onClick={submitEdit} disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save Changes"}
            </PillButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Shared form fields component ─────────────────────────────────────────────
function KitchenForm({
  form,
  onChange,
  isCreate,
}: {
  form: KitchenFormData;
  onChange: (key: keyof KitchenFormData, val: any) => void;
  isCreate: boolean;
}) {
  const inputCls = "w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50";
  const labelCls = "block text-xs font-medium text-white/60 mb-1";
  const categories: { value: string; label: string }[] = [
    { value: "chef_kitchen", label: "Chef Kitchen" },
    { value: "standard_creator", label: "Standard Creator" },
    { value: "supplement_partner", label: "Supplement Partner" },
    { value: "athlete_partner", label: "Athlete Partner" },
  ];

  return (
    <div className="space-y-4 py-2">
      {isCreate && (
        <div>
          <label className={labelCls}>Slug <span className="text-white/30">(lowercase, no spaces)</span></label>
          <input
            type="text"
            className={inputCls}
            placeholder="chef-nolan"
            value={form.slug}
            onChange={e => onChange("slug", e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-"))}
          />
        </div>
      )}

      <div>
        <label className={labelCls}>Display Name</label>
        <input
          type="text"
          className={inputCls}
          placeholder="Chef Nolan's Kitchen"
          value={form.displayName}
          onChange={e => onChange("displayName", e.target.value)}
        />
      </div>

      <div>
        <label className={labelCls}>Category</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {categories.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => onChange("creatorCategory", c.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                form.creatorCategory === c.value
                  ? "bg-orange-500/30 text-orange-200 border-orange-500/50"
                  : "bg-white/5 text-white/50 border-white/10 hover:border-white/20"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>Chef Bio / Tagline</label>
        <textarea
          className={`${inputCls} h-20 resize-none`}
          placeholder="A short description of the kitchen's style and philosophy…"
          value={form.bio}
          onChange={e => onChange("bio", e.target.value)}
        />
      </div>

      <div>
        <label className={labelCls}>Chef Persona Prompt <span className="text-white/30">(injected into AI generation)</span></label>
        <textarea
          className={`${inputCls} h-24 resize-none`}
          placeholder="Generate meals inspired by Chef Nolan's elevated comfort-food style with bold seasoning, layered textures, and restaurant-quality plating…"
          value={form.personaPrompt}
          onChange={e => onChange("personaPrompt", e.target.value)}
        />
      </div>

      <div>
        <label className={labelCls}>Flavor Profiles <span className="text-white/30">(comma-separated)</span></label>
        <input
          type="text"
          className={inputCls}
          placeholder="bold, smoky, citrus-forward"
          value={form.flavorProfiles}
          onChange={e => onChange("flavorProfiles", e.target.value)}
        />
      </div>

      <div>
        <label className={labelCls}>Cuisine Types <span className="text-white/30">(comma-separated)</span></label>
        <input
          type="text"
          className={inputCls}
          placeholder="Mediterranean, Southern American, Asian Fusion"
          value={form.cuisineTypes}
          onChange={e => onChange("cuisineTypes", e.target.value)}
        />
      </div>

      <div>
        <label className={labelCls}>Techniques <span className="text-white/30">(comma-separated)</span></label>
        <input
          type="text"
          className={inputCls}
          placeholder="seared, charred, roasted, braised"
          value={form.techniques}
          onChange={e => onChange("techniques", e.target.value)}
        />
      </div>

      <div>
        <label className={labelCls}>Display Priority <span className="text-white/30">(lower = higher on page)</span></label>
        <input
          type="number"
          className={inputCls}
          min={0}
          value={form.displayPriority}
          onChange={e => onChange("displayPriority", parseInt(e.target.value) || 0)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className={labelCls}>Logo URL</label>
          <input type="text" className={inputCls} placeholder="https://…" value={form.logoUrl} onChange={e => onChange("logoUrl", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Hero Image URL</label>
          <input type="text" className={inputCls} placeholder="https://…" value={form.heroImageUrl} onChange={e => onChange("heroImageUrl", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Branding Image URL</label>
          <input type="text" className={inputCls} placeholder="https://…" value={form.brandingImageUrl} onChange={e => onChange("brandingImageUrl", e.target.value)} />
        </div>
      </div>
    </div>
  );
}
