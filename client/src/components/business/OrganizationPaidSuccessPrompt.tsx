import { UniversalDialog } from "@/components/ui/universal-modal";

interface OrganizationPaidSuccessPromptProps {
  open: boolean;
  hasLinkedRewardful: boolean;
  onContinue: () => void;
  onDismiss: () => void;
}

export default function OrganizationPaidSuccessPrompt({
  open,
  hasLinkedRewardful,
  onContinue,
  onDismiss,
}: OrganizationPaidSuccessPromptProps) {
  const description = hasLinkedRewardful
    ? "Your Organization is now active. Your Rewardful affiliate account is linked, so you can manage it and continue referring subscribers to My Perfect Meals."
    : "Your Organization is now active. You can set up your Rewardful affiliate account to begin referring subscribers to My Perfect Meals.";

  return (
    <UniversalDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onDismiss();
      }}
      title="Your Business Subscription Is Active!"
      description={description}
      disableBodyScroll
      className="border-orange-500/20"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            I'll Do This Later
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          >
            {hasLinkedRewardful ? "Manage Rewardful" : "Set Up Rewardful"}
          </button>
        </div>
      }
    >
      {null}
    </UniversalDialog>
  );
}
