/**
 * SharePanel — Desktop fallback share modal
 *
 * Shown when navigator.share is unavailable (Chrome/Firefox on Mac/Windows).
 * Provides: Copy Link, Email, Copy Recipe text.
 */

import { useState } from "react";
import { Copy, Mail, FileText, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SharePanelProps {
  open: boolean;
  onClose: () => void;
  shareUrl: string;
  mealName: string;
  shareText: string; // full formatted recipe text
}

export default function SharePanel({ open, onClose, shareUrl, mealName, shareText }: SharePanelProps) {
  const [copiedLink, setCopiedLink]   = useState(false);
  const [copiedRecipe, setCopiedRecipe] = useState(false);

  if (!open) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // fallback: select + execCommand
      const el = document.createElement("textarea");
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const copyRecipe = async () => {
    const full = `${shareText}\n\nView the full recipe: ${shareUrl}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopiedRecipe(true);
      setTimeout(() => setCopiedRecipe(false), 2000);
    } catch {
      const el = document.createElement("textarea");
      el.value = full;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiedRecipe(true);
      setTimeout(() => setCopiedRecipe(false), 2000);
    }
  };

  const emailShare = () => {
    const subject = encodeURIComponent(`Check out this meal: ${mealName}`);
    const body = encodeURIComponent(
      `I thought you'd love this meal from My Perfect Meals!\n\n${mealName}\n\n${shareUrl}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Panel */}
      <div
        className="w-full sm:max-w-sm bg-neutral-900 border border-white/10 rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-white font-semibold text-base">Share Meal</h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/70 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-white/50 text-sm mb-5 truncate">{mealName}</p>

        {/* Share link display */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 mb-4">
          <span className="text-white/50 text-xs truncate flex-1">{shareUrl}</span>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <ShareAction
            icon={copiedLink ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            label={copiedLink ? "Link copied!" : "Copy Link"}
            onClick={copyLink}
            highlight={copiedLink}
          />
          <ShareAction
            icon={<Mail className="w-4 h-4" />}
            label="Email"
            onClick={emailShare}
          />
          <ShareAction
            icon={copiedRecipe ? <Check className="w-4 h-4 text-green-400" /> : <FileText className="w-4 h-4" />}
            label={copiedRecipe ? "Recipe copied!" : "Copy Recipe"}
            onClick={copyRecipe}
            highlight={copiedRecipe}
          />
        </div>

        <Button
          variant="ghost"
          className="w-full mt-4 text-white/40 hover:text-white/60 text-sm"
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function ShareAction({
  icon,
  label,
  onClick,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
        highlight
          ? "bg-green-500/10 border-green-500/30 text-green-300"
          : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20"
      }`}
    >
      <span className={highlight ? "text-green-400" : "text-white/50"}>{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
