import { useEffect, useState } from "react";
import {
  Download,
  Copy,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Image as ImageIcon,
  FileText,
  Video,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Asset {
  id: string;
  assetType: string;
  label: string | null;
  filename: string;
  mimeType: string | null;
  byteSize: number | null;
  captionText: string | null;
  displayOrder: number;
}

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  monthKey: string;
  status: string;
  publishedAt: string | null;
  assets: Asset[];
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  instagram_post: "Instagram Post",
  instagram_story: "Instagram Story",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  podcast: "Podcast",
  flyer: "Flyer",
  poster: "Poster",
  email: "Email Copy",
  sms: "SMS / Text",
  blog: "Blog",
  video: "Video",
  presentation: "Presentation",
  press_kit: "Press Kit",
  caption: "Caption",
  script: "Script",
  other: "Other",
};

function formatMonthKey(key: string): string {
  try {
    return new Date(key + "-01T12:00:00").toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  } catch {
    return key;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AssetTypeIcon({ mimeType, assetType }: { mimeType: string | null; assetType: string }) {
  if (mimeType?.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-blue-400" />;
  if (
    mimeType?.startsWith("video/") ||
    assetType === "video" ||
    assetType === "youtube"
  )
    return <Video className="h-4 w-4 text-purple-400" />;
  return <FileText className="h-4 w-4 text-orange-400" />;
}

// ─── Text asset (caption, email copy, script) ────────────────────────────────

function TextAssetRow({ asset }: { asset: Asset }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const copyText = () => {
    if (!asset.captionText) return;
    navigator.clipboard.writeText(asset.captionText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-orange-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-white font-medium truncate">
              {asset.label ?? ASSET_TYPE_LABELS[asset.assetType] ?? asset.filename}
            </p>
            <p className="text-[10px] text-white/40">
              {ASSET_TYPE_LABELS[asset.assetType] ?? "Text"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="p-1.5 rounded-lg bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={copyText}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-300 text-xs font-semibold hover:bg-orange-500/30 transition-colors active:scale-[0.97]"
          >
            {copied ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {expanded && asset.captionText && (
        <div className="mt-3 p-3 rounded-lg bg-black/30 border border-white/5">
          <p className="text-xs text-white/70 whitespace-pre-wrap leading-relaxed">
            {asset.captionText}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── File asset (image, video, PDF, etc.) ────────────────────────────────────

function FileAssetRow({ asset, campaignId }: { asset: Asset; campaignId: string }) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const res = await fetch(
        `/api/marketing-center/campaigns/${campaignId}/assets/${asset.id}/download`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = asset.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ variant: "destructive", description: "Download failed. Please try again." });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <AssetTypeIcon mimeType={asset.mimeType} assetType={asset.assetType} />
          <div className="min-w-0">
            <p className="text-sm text-white font-medium truncate">
              {asset.label ?? ASSET_TYPE_LABELS[asset.assetType] ?? asset.filename}
            </p>
            <p className="text-[10px] text-white/40">
              {ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType}
              {asset.byteSize ? ` · ${formatBytes(asset.byteSize)}` : ""}
            </p>
          </div>
        </div>
        <button
          onClick={download}
          disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-300 text-xs font-semibold hover:bg-orange-500/30 transition-colors active:scale-[0.97] disabled:opacity-50"
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {downloading ? "…" : "Download"}
        </button>
      </div>
    </div>
  );
}

// ─── Campaign card ─────────────────────────────────────────────────────────────

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const [expanded, setExpanded] = useState(true);
  const fileAssets = campaign.assets.filter((a) => a.captionText === null);
  const textAssets = campaign.assets.filter((a) => a.captionText !== null);

  return (
    <div className="rounded-2xl bg-black/40 border border-white/10 overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div>
          <p className="text-sm font-bold text-white">{campaign.title}</p>
          <p className="text-xs text-white/50 mt-0.5">{formatMonthKey(campaign.monthKey)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/35">
            {campaign.assets.length} item{campaign.assets.length !== 1 ? "s" : ""}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-white/40" />
          ) : (
            <ChevronDown className="h-4 w-4 text-white/40" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {campaign.description && (
            <p className="text-xs text-white/50 mb-3 leading-relaxed">{campaign.description}</p>
          )}
          {campaign.assets.length === 0 && (
            <p className="text-xs text-white/35 text-center py-4">No assets published yet.</p>
          )}
          {fileAssets.map((asset) => (
            <FileAssetRow key={asset.id} asset={asset} campaignId={campaign.id} />
          ))}
          {textAssets.map((asset) => (
            <TextAssetRow key={asset.id} asset={asset} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MonthlyMarketing() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/marketing-center/campaigns", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setCampaigns(data.campaigns ?? []))
      .catch(() => setError("Failed to load campaigns"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 text-orange-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-7 w-7 text-red-400/60 mx-auto mb-2" />
        <p className="text-white/60 text-sm">{error}</p>
      </div>
    );
  }

  const thisMonth = new Date().toISOString().slice(0, 7);
  const current = campaigns.filter((c) => c.monthKey >= thisMonth);
  const previous = campaigns.filter((c) => c.monthKey < thisMonth);

  return (
    <div className="space-y-5">
      <p className="text-xs text-white/40 text-center leading-relaxed">
        Download assets and copy for your marketing materials. Only campaigns approved for your
        account type are shown.
      </p>

      {campaigns.length === 0 && (
        <div className="text-center py-12">
          <p className="text-white/50 text-sm">No campaigns available yet.</p>
          <p className="text-white/35 text-xs mt-1">
            Monthly campaigns will appear here once published.
          </p>
        </div>
      )}

      {current.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider">
            Current
          </p>
          {current.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}

      {previous.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
            Previous Campaigns
          </p>
          {previous.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}
    </div>
  );
}
