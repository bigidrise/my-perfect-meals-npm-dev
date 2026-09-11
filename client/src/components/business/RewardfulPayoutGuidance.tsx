interface RewardfulPayoutGuidanceProps {
  hasLinkedRewardful: boolean;
  canManage: boolean;
  loading?: boolean;
  onOpenRewardful: () => void;
  onOpenPartnerRevenue: () => void;
}

export default function RewardfulPayoutGuidance({
  hasLinkedRewardful,
  canManage,
  loading = false,
  onOpenRewardful,
  onOpenPartnerRevenue,
}: RewardfulPayoutGuidanceProps) {
  if (!hasLinkedRewardful) {
    return (
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
        <p className="text-sm font-semibold text-white">Connect Rewardful first</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-300">
          Create or connect the selected organization&apos;s Rewardful account before setting up payouts.
        </p>
        {canManage && (
          <button
            type="button"
            onClick={onOpenPartnerRevenue}
            className="mt-3 w-full rounded-xl border border-orange-500/40 bg-orange-500/15 px-4 py-3 text-sm font-bold text-orange-200"
          >
            Open Partner &amp; Revenue Setup
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-gray-300">
        Complete your payout setup directly with Rewardful so your organization can receive My Perfect Meals commissions.
      </p>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-xs font-bold text-white">How to set up your payouts</p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[11px] leading-relaxed text-gray-300">
          <li>Select <span className="font-semibold text-white">Set Up / Manage Payouts in Rewardful</span>.</li>
          <li>In Rewardful, select <span className="font-semibold text-white">Set up your payout info</span> if that action appears.</li>
          <li>Complete the requested business and payment information.</li>
          <li>Select from the payout methods Rewardful makes available to you.</li>
          <li>Return to My Perfect Meals when finished.</li>
        </ol>
      </div>

      {canManage ? (
        <button
          type="button"
          onClick={onOpenRewardful}
          disabled={loading}
          className="w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? "Opening Rewardful..." : "Set Up / Manage Payouts in Rewardful"}
        </button>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-gray-300">
          An organization owner or administrator must open payout settings.
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-gray-500">
        Your payout and banking information is provided directly to Rewardful. My Perfect Meals does not collect or store your bank-account or payout credentials.
      </p>
    </div>
  );
}