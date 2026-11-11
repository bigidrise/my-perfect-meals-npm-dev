import { UniversalDialog } from "@/components/ui/universal-modal";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const description = hasLinkedRewardful
    ? t("organizationPaidSuccess.linkedDescription")
    : t("organizationPaidSuccess.setupDescription");

  return (
    <UniversalDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onDismiss();
      }}
      title={t("organizationPaidSuccess.title")}
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
            {t("organizationPaidSuccess.later")}
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
          >
            {hasLinkedRewardful ? t("organizationPaidSuccess.manage") : t("organizationPaidSuccess.setup")}
          </button>
        </div>
      }
    >
      {null}
    </UniversalDialog>
  );
}
