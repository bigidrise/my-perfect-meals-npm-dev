/**
 * Modal Test Harness — Playwright regression guard
 *
 * Renders every UniversalDialog variant in an open state so Playwright
 * viewport tests can assert layout bounds without needing a real user
 * session or API mocking.
 *
 * URL: /__modal-test__?variant=<name>
 *
 * Variants:
 *   universal      UniversalDialog (base)
 *   confirmation   ConfirmationModal
 *   form           FormModal
 *   picker         PickerModal
 *   information    InformationModal
 *   workflow       WorkflowModal
 *   wizard         WizardModal
 *   all            All variants stacked (default)
 *
 * Gate: only accessible when navigator.webdriver === true (Playwright) OR
 *       import.meta.env.DEV is true (local development).
 */

import { useState, useEffect } from "react";
import {
  UniversalDialog,
  ConfirmationModal,
  FormModal,
  PickerModal,
  InformationModal,
  WorkflowModal,
  WizardModal,
  ModalBody,
} from "@/components/ui/universal-modal";
import { Button } from "@/components/ui/button";

// ── Security gate ─────────────────────────────────────────────────────────────

function isAllowed(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof navigator !== "undefined" && navigator.webdriver) return true;
  return false;
}

// ── Placeholder body content (gives the modal something to scroll) ────────────

function SampleBody({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <p key={i} className="text-sm text-muted-foreground">
          Sample content row {i + 1}. This text gives the modal body something
          to render so layout assertions have realistic content to measure.
        </p>
      ))}
    </div>
  );
}

function SampleFooter({ onClose }: { onClose: () => void }) {
  return (
    <>
      <Button variant="ghost" onClick={onClose} data-testid="modal-cancel-btn">
        Cancel
      </Button>
      <Button data-testid="modal-primary-btn">Confirm</Button>
    </>
  );
}

// ── Individual harness components ─────────────────────────────────────────────

function UniversalHarness() {
  const [open, setOpen] = useState(true);
  return (
    <section data-variant="universal">
      <button
        className="text-xs text-muted-foreground underline mb-2"
        onClick={() => setOpen(true)}
        data-testid="open-universal"
      >
        Open UniversalDialog
      </button>
      <UniversalDialog
        open={open}
        onOpenChange={setOpen}
        title="Universal Dialog"
        description="Base variant — general-purpose use."
        footer={<SampleFooter onClose={() => setOpen(false)} />}
      >
        <SampleBody rows={4} />
      </UniversalDialog>
    </section>
  );
}

function ConfirmationHarness() {
  const [open, setOpen] = useState(true);
  return (
    <section data-variant="confirmation">
      <button
        className="text-xs text-muted-foreground underline mb-2"
        onClick={() => setOpen(true)}
        data-testid="open-confirmation"
      >
        Open ConfirmationModal
      </button>
      <ConfirmationModal
        open={open}
        onOpenChange={setOpen}
        title="Confirm Action"
        description="Are you sure you want to delete this item? This cannot be undone."
        footer={<SampleFooter onClose={() => setOpen(false)} />}
      >
        <p className="text-sm text-muted-foreground py-2">
          This action is permanent. Please confirm before proceeding.
        </p>
      </ConfirmationModal>
    </section>
  );
}

function FormHarness() {
  const [open, setOpen] = useState(true);
  return (
    <section data-variant="form">
      <button
        className="text-xs text-muted-foreground underline mb-2"
        onClick={() => setOpen(true)}
        data-testid="open-form"
      >
        Open FormModal
      </button>
      <FormModal
        open={open}
        onOpenChange={setOpen}
        title="Edit Profile"
        description="Update your information below."
        footer={<SampleFooter onClose={() => setOpen(false)} />}
      >
        <SampleBody rows={6} />
      </FormModal>
    </section>
  );
}

function PickerHarness() {
  const [open, setOpen] = useState(true);
  return (
    <section data-variant="picker">
      <button
        className="text-xs text-muted-foreground underline mb-2"
        onClick={() => setOpen(true)}
        data-testid="open-picker"
      >
        Open PickerModal
      </button>
      <PickerModal
        open={open}
        onOpenChange={setOpen}
        title="Choose a Meal"
        description="Browse and select a saved meal."
        filterBar={
          <div className="flex gap-2 px-1 pb-2">
            <button className="text-xs bg-orange-500 text-white px-3 py-1 rounded-full">
              All
            </button>
            <button className="text-xs bg-white/10 text-white px-3 py-1 rounded-full">
              Breakfast
            </button>
            <button className="text-xs bg-white/10 text-white px-3 py-1 rounded-full">
              Lunch
            </button>
          </div>
        }
        footer={<SampleFooter onClose={() => setOpen(false)} />}
      >
        <SampleBody rows={8} />
      </PickerModal>
    </section>
  );
}

function InformationHarness() {
  const [open, setOpen] = useState(true);
  return (
    <section data-variant="information">
      <button
        className="text-xs text-muted-foreground underline mb-2"
        onClick={() => setOpen(true)}
        data-testid="open-information"
      >
        Open InformationModal
      </button>
      <InformationModal
        open={open}
        onOpenChange={setOpen}
        title="How This Works"
        description="Understanding the meal scoring system."
        footer={<SampleFooter onClose={() => setOpen(false)} />}
      >
        <SampleBody rows={5} />
      </InformationModal>
    </section>
  );
}

function WorkflowHarness() {
  const [open, setOpen] = useState(true);
  return (
    <section data-variant="workflow">
      <button
        className="text-xs text-muted-foreground underline mb-2"
        onClick={() => setOpen(true)}
        data-testid="open-workflow"
      >
        Open WorkflowModal
      </button>
      <WorkflowModal
        open={open}
        onOpenChange={setOpen}
        title="Recipe Editor"
        description="Edit all sections of your custom recipe."
        footer={<SampleFooter onClose={() => setOpen(false)} />}
      >
        <SampleBody rows={12} />
      </WorkflowModal>
    </section>
  );
}

function WizardHarness() {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const totalSteps = 3;
  return (
    <section data-variant="wizard">
      <button
        className="text-xs text-muted-foreground underline mb-2"
        onClick={() => setOpen(true)}
        data-testid="open-wizard"
      >
        Open WizardModal
      </button>
      <WizardModal
        open={open}
        onOpenChange={setOpen}
        title="Setup Wizard"
        description="Complete each step to get started."
        step={step}
        totalSteps={totalSteps}
        isLastStep={step === totalSteps - 1}
        onBack={() => setStep((s) => Math.max(0, s - 1))}
        onNext={() => setStep((s) => Math.min(totalSteps - 1, s + 1))}
        onComplete={() => setOpen(false)}
      >
        <SampleBody rows={4} />
      </WizardModal>
    </section>
  );
}

// ── Variant map ───────────────────────────────────────────────────────────────

const VARIANT_MAP: Record<string, React.FC> = {
  universal: UniversalHarness,
  confirmation: ConfirmationHarness,
  form: FormHarness,
  picker: PickerHarness,
  information: InformationHarness,
  workflow: WorkflowHarness,
  wizard: WizardHarness,
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ModalTestHarness() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(isAllowed());
  }, []);

  if (!allowed) {
    return (
      <div className="flex items-center justify-center min-h-screen text-muted-foreground text-sm">
        Test harness is only available in development or Playwright automation.
      </div>
    );
  }

  // Read ?variant= from the URL
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("variant") ?? "all";

  const variantKeys = Object.keys(VARIANT_MAP);
  const activeKeys =
    requested === "all" || !variantKeys.includes(requested)
      ? variantKeys
      : [requested];

  return (
    <div
      className="min-h-screen bg-background p-8 space-y-6"
      data-testid="modal-test-harness"
    >
      <header>
        <h1 className="text-lg font-semibold">Modal Test Harness</h1>
        <p className="text-sm text-muted-foreground">
          Rendering variant(s):{" "}
          <code className="bg-white/10 px-1 rounded">{requested}</code>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Append <code className="bg-white/10 px-1 rounded">?variant=</code> to
          the URL to test a single variant.
        </p>
      </header>

      {activeKeys.map((key) => {
        const Component = VARIANT_MAP[key];
        return (
          <div key={key} data-harness-variant={key}>
            <p className="text-xs font-mono text-muted-foreground mb-1 uppercase tracking-wide">
              {key}
            </p>
            <Component />
          </div>
        );
      })}
    </div>
  );
}
