import { useState, useEffect, useRef, ChangeEvent } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Plus,
  Upload,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  Globe,
  Lock,
  Archive,
  FileText,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Asset {
  id: string;
  assetType: string;
  label: string | null;
  filename: string;
  mimeType: string | null;
  byteSize: number | null;
  captionText: string | null;
  displayOrder: number;
  objectKey: string;
}

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  monthKey: string;
  status: string;
  audienceModes: string[];
  publishedAt: string | null;
  assets: Asset[];
}

const AUDIENCE_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "co_branded", label: "Co-branded" },
  { value: "white_label", label: "White Label" },
];

const ASSET_TYPE_OPTIONS = [
  "instagram_post", "instagram_story", "facebook", "linkedin",
  "youtube", "podcast", "flyer", "poster", "email", "sms",
  "blog", "video", "presentation", "press_kit", "caption", "script", "other",
];

const ASSET_TYPE_LABELS: Record<string, string> = {
  instagram_post: "Instagram Post", instagram_story: "Instagram Story",
  facebook: "Facebook", linkedin: "LinkedIn", youtube: "YouTube",
  podcast: "Podcast", flyer: "Flyer", poster: "Poster", email: "Email Copy",
  sms: "SMS / Text", blog: "Blog", video: "Video", presentation: "Presentation",
  press_kit: "Press Kit", caption: "Caption", script: "Script", other: "Other",
};

function formatMonthKey(key: string) {
  try {
    return new Date(key + "-01T12:00:00").toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  } catch {
    return key;
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadge(status: string) {
  if (status === "published")
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">
        <Globe className="h-3 w-3" /> Published
      </span>
    );
  if (status === "archived")
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
        <Archive className="h-3 w-3" /> Archived
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
      <Lock className="h-3 w-3" /> Draft
    </span>
  );
}

// ─── Upload helper: presigned PUT → register asset ────────────────────────────

async function uploadAssetFile(
  campaignId: string,
  file: File,
  assetType: string,
  label: string,
  displayOrder: number
): Promise<void> {
  // 1. Request presigned upload URL
  const urlRes = await fetch("/api/uploads/request-url", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mimeType: file.type, filename: file.name }),
  });
  if (!urlRes.ok) throw new Error("Failed to get upload URL");
  const { uploadURL, objectPath } = await urlRes.json();

  // 2. Upload directly to presigned URL
  const putRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!putRes.ok) throw new Error("Upload to storage failed");

  // 3. Register the asset in our DB
  const regRes = await fetch(`/api/marketing-center/admin/campaigns/${campaignId}/assets`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      assetType,
      label: label || null,
      filename: file.name,
      objectKey: objectPath,
      mimeType: file.type,
      byteSize: file.size,
      captionText: null,
      displayOrder,
    }),
  });
  if (!regRes.ok) throw new Error("Failed to register asset");
}

// ─── New campaign form ────────────────────────────────────────────────────────

function NewCampaignForm({ onCreated }: { onCreated: (c: Campaign) => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [monthKey, setMonthKey] = useState("");
  const [audienceModes, setAudienceModes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleMode = (mode: string) =>
    setAudienceModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );

  const submit = async () => {
    if (!title.trim() || !monthKey) {
      toast({ variant: "destructive", description: "Title and month are required." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/marketing-center/admin/campaigns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, monthKey, audienceModes }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ variant: "destructive", description: data.error ?? "Failed to create campaign" });
        return;
      }
      toast({ description: "Campaign created." });
      onCreated({ ...data.campaign, assets: [] });
      setTitle("");
      setDescription("");
      setMonthKey("");
      setAudienceModes([]);
    } catch {
      toast({ variant: "destructive", description: "Network error." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-black/40 border border-white/10 p-5 space-y-3">
      <p className="text-sm font-bold text-white mb-1">New Campaign</p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Campaign title"
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Short description (optional)"
        rows={2}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50 resize-none"
      />
      <div>
        <p className="text-xs text-white/50 mb-1.5">Month</p>
        <input
          type="month"
          value={monthKey}
          onChange={(e) => setMonthKey(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50"
        />
      </div>
      <div>
        <p className="text-xs text-white/50 mb-2">Who can see this campaign?</p>
        <div className="flex flex-wrap gap-2">
          {AUDIENCE_OPTIONS.map((opt) => {
            const active = audienceModes.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleMode(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  active
                    ? "bg-orange-500/30 border-orange-500/50 text-orange-200"
                    : "bg-white/5 border-white/10 text-white/50 hover:text-white/80"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
      <button
        onClick={submit}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Create Campaign
      </button>
    </div>
  );
}

// ─── Add asset form (file or text) ───────────────────────────────────────────

function AddAssetForm({
  campaignId,
  onAdded,
}: {
  campaignId: string;
  onAdded: (asset: Asset) => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"file" | "text">("file");
  const [assetType, setAssetType] = useState("other");
  const [label, setLabel] = useState("");
  const [captionText, setCaptionText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] ?? null);
  };

  const submit = async () => {
    if (mode === "file") {
      if (!selectedFile) {
        toast({ variant: "destructive", description: "Select a file." });
        return;
      }
      setUploading(true);
      try {
        await uploadAssetFile(campaignId, selectedFile, assetType, label, displayOrder);
        // Re-fetch the last asset to get its ID
        const res = await fetch(`/api/marketing-center/admin/campaigns`, {
          credentials: "include",
        });
        const data = await res.json();
        const updated = (data.campaigns as Campaign[]).find((c) => c.id === campaignId);
        const newest = updated?.assets.slice(-1)[0];
        if (newest) onAdded(newest);
        toast({ description: "Asset uploaded." });
        setSelectedFile(null);
        setLabel("");
        setDisplayOrder(0);
        if (fileRef.current) fileRef.current.value = "";
      } catch (err: any) {
        toast({ variant: "destructive", description: err.message ?? "Upload failed." });
      } finally {
        setUploading(false);
      }
    } else {
      if (!captionText.trim()) {
        toast({ variant: "destructive", description: "Enter the text content." });
        return;
      }
      setUploading(true);
      try {
        const res = await fetch(`/api/marketing-center/admin/campaigns/${campaignId}/assets`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assetType,
            label: label || null,
            filename: label || ASSET_TYPE_LABELS[assetType] || "text",
            captionText,
            displayOrder,
          }),
        });
        if (!res.ok) throw new Error("Failed to add text asset");
        const data = await res.json();
        onAdded(data.asset);
        toast({ description: "Text block added." });
        setCaptionText("");
        setLabel("");
      } catch {
        toast({ variant: "destructive", description: "Failed to add text block." });
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <div className="rounded-xl bg-white/5 border border-dashed border-white/15 p-4 space-y-3">
      <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Add Asset</p>

      {/* File / Text toggle */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-0.5 w-fit">
        {(["file", "text"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              mode === m ? "bg-white/15 text-white" : "text-white/40 hover:text-white/60"
            }`}
          >
            {m === "file" ? "File" : "Text Block"}
          </button>
        ))}
      </div>

      {/* Asset type */}
      <select
        value={assetType}
        onChange={(e) => setAssetType(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50"
      >
        {ASSET_TYPE_OPTIONS.map((t) => (
          <option key={t} value={t}>
            {ASSET_TYPE_LABELS[t]}
          </option>
        ))}
      </select>

      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Display label (optional)"
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50"
      />

      {mode === "file" ? (
        <div>
          <input
            ref={fileRef}
            type="file"
            onChange={handleFileChange}
            className="block w-full text-xs text-white/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-orange-500/20 file:text-orange-300 file:text-xs file:font-semibold hover:file:bg-orange-500/30 cursor-pointer"
          />
          {selectedFile && (
            <p className="text-[10px] text-white/40 mt-1">{formatBytes(selectedFile.size)}</p>
          )}
        </div>
      ) : (
        <textarea
          value={captionText}
          onChange={(e) => setCaptionText(e.target.value)}
          placeholder="Paste caption, email copy, script, or any text…"
          rows={4}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50 resize-none"
        />
      )}

      <div className="flex items-center gap-2">
        <label className="text-xs text-white/40">Order:</label>
        <input
          type="number"
          value={displayOrder}
          onChange={(e) => setDisplayOrder(Number(e.target.value))}
          className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
          min={0}
        />
      </div>

      <button
        onClick={submit}
        disabled={uploading}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-xs font-semibold hover:bg-white/15 transition-colors disabled:opacity-50"
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : mode === "file" ? (
          <Upload className="h-3.5 w-3.5" />
        ) : (
          <FileText className="h-3.5 w-3.5" />
        )}
        {uploading ? "Uploading…" : mode === "file" ? "Upload File" : "Add Text Block"}
      </button>
    </div>
  );
}

// ─── Single campaign card ─────────────────────────────────────────────────────

function CampaignCard({
  campaign,
  onUpdate,
}: {
  campaign: Campaign;
  onUpdate: (updated: Campaign) => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  const patchStatus = async (status: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/marketing-center/admin/campaigns/${campaign.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUpdate({ ...campaign, ...data.campaign });
      toast({ description: `Campaign ${status}.` });
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message ?? "Failed to update" });
    } finally {
      setSaving(false);
    }
  };

  const deleteAsset = async (assetId: string) => {
    const res = await fetch(
      `/api/marketing-center/admin/campaigns/${campaign.id}/assets/${assetId}`,
      { method: "DELETE", credentials: "include" }
    );
    if (res.ok) {
      onUpdate({ ...campaign, assets: campaign.assets.filter((a) => a.id !== assetId) });
    }
  };

  const audienceLabel =
    campaign.audienceModes.length === 0
      ? "No audience set"
      : campaign.audienceModes
          .map((m) => AUDIENCE_OPTIONS.find((o) => o.value === m)?.label ?? m)
          .join(", ");

  const AUDIENCE_OPTIONS_MAP: Record<string, string> = {
    standard: "Standard",
    co_branded: "Co-branded",
    white_label: "White Label",
  };

  return (
    <div className="rounded-2xl bg-black/40 border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-white">{campaign.title}</p>
              {statusBadge(campaign.status)}
            </div>
            <p className="text-xs text-white/40 mt-0.5">
              {formatMonthKey(campaign.monthKey)} · {audienceLabel}
            </p>
          </div>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:text-white flex-shrink-0"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Status actions */}
        <div className="flex gap-2 mt-3">
          {campaign.status !== "published" && (
            <button
              onClick={() => patchStatus("published")}
              disabled={saving || campaign.audienceModes.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Globe className="h-3.5 w-3.5" />
              )}
              Publish
            </button>
          )}
          {campaign.status === "published" && (
            <button
              onClick={() => patchStatus("draft")}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-colors disabled:opacity-40"
            >
              <Lock className="h-3.5 w-3.5" />
              Unpublish
            </button>
          )}
          {campaign.status !== "archived" && (
            <button
              onClick={() => patchStatus("archived")}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs font-semibold hover:bg-white/10 transition-colors disabled:opacity-40"
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </button>
          )}
        </div>

        {campaign.audienceModes.length === 0 && campaign.status !== "published" && (
          <p className="flex items-center gap-1 text-[10px] text-amber-400/70 mt-2">
            <AlertCircle className="h-3 w-3" />
            Set an audience before publishing.
          </p>
        )}
      </div>

      {/* Expanded: assets + add form */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
          {campaign.assets.length === 0 && (
            <p className="text-xs text-white/35 text-center py-2">No assets yet.</p>
          )}
          {campaign.assets.map((asset) => (
            <div
              key={asset.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-white/5 border border-white/8 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-xs text-white font-medium truncate">
                  {asset.label ?? ASSET_TYPE_LABELS[asset.assetType] ?? asset.filename}
                </p>
                <p className="text-[10px] text-white/35">
                  {ASSET_TYPE_LABELS[asset.assetType]}
                  {asset.captionText !== null
                    ? " · text"
                    : asset.byteSize
                    ? ` · ${formatBytes(asset.byteSize)}`
                    : ""}
                </p>
              </div>
              <button
                onClick={() => deleteAsset(asset.id)}
                className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          <AddAssetForm
            campaignId={campaign.id}
            onAdded={(asset) =>
              onUpdate({ ...campaign, assets: [...campaign.assets, asset] })
            }
          />
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminCampaignManager() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);

  useEffect(() => {
    fetch("/api/marketing-center/admin/campaigns", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setCampaigns(data.campaigns ?? []))
      .catch(() => toast({ variant: "destructive", description: "Failed to load campaigns" }))
      .finally(() => setLoading(false));
  }, []);

  const handleCreated = (c: Campaign) => {
    setCampaigns((prev) => [c, ...prev]);
    setShowNewForm(false);
  };

  const handleUpdate = (updated: Campaign) =>
    setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));

  return (
    <div className="min-h-screen bg-black/90 pb-28">
      {/* Header */}
      <div
        className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => setLocation("/admin")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
            Admin
          </button>
          <h1 className="text-lg font-bold text-white">Campaign Manager</h1>
        </div>
      </div>

      <div className="px-4 pt-4 max-w-2xl mx-auto space-y-4">
        {/* New campaign toggle */}
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-orange-500/15 border border-dashed border-orange-500/30 text-orange-300 text-sm font-semibold hover:bg-orange-500/20 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Campaign
        </button>

        {showNewForm && <NewCampaignForm onCreated={handleCreated} />}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 text-orange-400 animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-white/40 text-sm">No campaigns yet.</p>
          </div>
        ) : (
          campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} onUpdate={handleUpdate} />
          ))
        )}
      </div>
    </div>
  );
}
