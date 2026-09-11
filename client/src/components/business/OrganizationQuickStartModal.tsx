import { useState } from "react";
import { useLocation } from "wouter";
import {
  BookOpen,
  Building2,
  DollarSign,
  MapPin,
  Rocket,
  Users,
  UserRoundCheck,
} from "lucide-react";
import { UniversalDialog } from "@/components/ui/universal-modal";
import { Button } from "@/components/ui/button";
import { PillButton } from "@/components/ui/pill-button";

type OrganizationQuickStartModalProps = {
  open: boolean;
  hasOrganization: boolean;
  onClose: (disableFutureAutoOpen: boolean) => void;
};

const steps = [
  {
    icon: Building2,
    title: "Complete Your Organization",
    description: "This is your clinic or business's permanent My Perfect Meals home. Confirm organization-owned details, including its name, business contact, and business email.",
    action: "Open Organization Dashboard",
    route: "/business-dashboard",
    needsOrganization: true,
  },
  {
    icon: MapPin,
    title: "Add Locations",
    description: "Add clinics, offices, or other locations when needed. Each location stays inside the organization you selected.",
    action: "Manage Locations",
    route: "/business-dashboard",
    needsOrganization: true,
  },
  {
    icon: Users,
    title: "Add or Manage People",
    description: "Internal staff work for the organization. External delegated contractors can administer it without owning it. Clients and customers remain separate.",
    action: "Manage Team & Clients",
    route: "/business-dashboard",
    needsOrganization: true,
  },
  {
    icon: BookOpen,
    title: "Learn My Perfect Meals",
    description: "Academy teaches each person how to use the platform. Training belongs to the person and is not repeated for every organization they manage. It does not activate Partner & Revenue.",
    action: "Launch Academy",
    route: "/business-center/academy",
    needsOrganization: false,
  },
  {
    icon: Rocket,
    title: "Use Your 30-Day Business Pilot",
    description: "Use the organization's existing pilot to complete setup and learn the business tools. Opening this guide never starts, restarts, or extends the pilot.",
  },
  {
    icon: DollarSign,
    title: "Set Up Partner & Revenue",
    description: "Partner & Revenue belongs to the organization. When eligible, attach its exact existing Rewardful affiliate ID or create a setup using the organization's own business contact information.",
    action: "Open Partner & Revenue",
    route: "/business-center/affiliate/dashboard",
    needsOrganization: true,
  },
  {
    icon: UserRoundCheck,
    title: "Invite and Work With People",
    description: "A referral introduces someone to My Perfect Meals. A Studio relationship is separate and must be created intentionally; referrals do not automatically become Studio clients.",
    action: "Open ProCare Studio",
    route: "/care-team",
    needsOrganization: false,
  },
] as const;

export function OrganizationQuickStartModal({
  open,
  hasOrganization,
  onClose,
}: OrganizationQuickStartModalProps) {
  const [, navigate] = useLocation();
  const [disableFutureAutoOpen, setDisableFutureAutoOpen] = useState(false);

  function goTo(route: string) {
    onClose(disableFutureAutoOpen);
    navigate(route);
  }

  return (
    <UniversalDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose(disableFutureAutoOpen);
      }}
      title="Organization Quick Start"
      description="Seven practical steps for setting up and using an organization."
      className="border-blue-400/20 bg-zinc-950 text-white sm:max-w-xl"
      footer={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <PillButton
            active={disableFutureAutoOpen}
            onClick={() => setDisableFutureAutoOpen((current) => !current)}
            data-testid="organization-quick-start-disable-auto"
          >
            Don't open automatically again
          </PillButton>
          <Button
            type="button"
            onClick={() => onClose(disableFutureAutoOpen)}
            className="rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-500"
          >
            Close Guide
          </Button>
        </div>
      }
    >
      <div className="space-y-3 pr-1">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const canNavigate = "route" in step && (!step.needsOrganization || hasOrganization);
          return (
            <section
              key={step.title}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-400/30 bg-blue-500/15 text-blue-200">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-300">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-0.5 text-sm font-bold text-white">{step.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-white/65">{step.description}</p>
                  {canNavigate && "route" in step && "action" in step && (
                    <button
                      type="button"
                      onClick={() => goTo(step.route)}
                      className="mt-3 text-xs font-semibold text-blue-300 underline-offset-4 hover:text-blue-200 hover:underline"
                    >
                      {step.action}
                    </button>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </UniversalDialog>
  );
}