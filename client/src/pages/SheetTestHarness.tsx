/**
 * Sheet / Drawer Test Harness — Playwright regression guard
 *
 * Renders Sheet and Drawer variants in an open state so Playwright viewport
 * tests can assert layout bounds without needing a real user session or API
 * mocking. Mirrors the pattern established by ModalTestHarness.tsx.
 *
 * URL: /__sheet-test__?variant=<name>
 *
 * Variants:
 *   sheet-bottom   Sheet (side="bottom") — slides up from screen bottom
 *   sheet-right    Sheet (side="right")  — slides in from screen right
 *   drawer         Vaul Drawer           — drag-to-dismiss bottom drawer
 *   all            All variants stacked (default)
 *
 * Gate: only accessible when navigator.webdriver === true (Playwright) OR
 *       import.meta.env.DEV is true (local development).
 *
 * Architecture reference: docs/responsive-ui-regression-guard.md
 */

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

// ── Security gate ─────────────────────────────────────────────────────────────

function isAllowed(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof navigator !== "undefined" && navigator.webdriver) return true;
  return false;
}

// ── Placeholder body content ───────────────────────────────────────────────────

function SampleBody({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <p key={i} className="text-sm text-muted-foreground">
          Sample content row {i + 1}. This text gives the sheet body something
          to render so layout assertions have realistic content to measure.
        </p>
      ))}
    </div>
  );
}

// ── Individual harness components ─────────────────────────────────────────────

function SheetBottomHarness() {
  const [open, setOpen] = useState(true);
  return (
    <section data-variant="sheet-bottom">
      <button
        className="text-xs text-muted-foreground underline mb-2"
        onClick={() => setOpen(true)}
        data-testid="open-sheet-bottom"
      >
        Open Sheet (bottom)
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Bottom Sheet</SheetTitle>
            <SheetDescription>
              Slides up from the bottom of the screen. Key risk: if{" "}
              <code>inset-x-0</code> breaks, the sheet can overflow horizontally.
            </SheetDescription>
          </SheetHeader>
          <SampleBody rows={3} />
          <SheetFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              data-testid="sheet-cancel-btn"
            >
              Cancel
            </Button>
            <Button data-testid="sheet-primary-btn">Confirm</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}

function SheetRightHarness() {
  const [open, setOpen] = useState(true);
  return (
    <section data-variant="sheet-right">
      <button
        className="text-xs text-muted-foreground underline mb-2"
        onClick={() => setOpen(true)}
        data-testid="open-sheet-right"
      >
        Open Sheet (right)
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Right Sheet</SheetTitle>
            <SheetDescription>
              Slides in from the right. Key risk: width&nbsp;w-3/4 can overflow
              past the viewport right edge on very narrow screens.
            </SheetDescription>
          </SheetHeader>
          <SampleBody rows={5} />
          <SheetFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              data-testid="sheet-cancel-btn"
            >
              Cancel
            </Button>
            <Button data-testid="sheet-primary-btn">Confirm</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}

function DrawerBottomHarness() {
  const [open, setOpen] = useState(true);
  return (
    <section data-variant="drawer">
      <button
        className="text-xs text-muted-foreground underline mb-2"
        onClick={() => setOpen(true)}
        data-testid="open-drawer"
      >
        Open Drawer (bottom)
      </button>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Bottom Drawer</DrawerTitle>
            <DrawerDescription>
              Vaul drag-to-dismiss bottom drawer. Key risk:{" "}
              <code>inset-x-0</code> must remain intact or the drawer can
              escape the horizontal viewport.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4">
            <SampleBody rows={3} />
          </div>
          <DrawerFooter>
            <Button data-testid="drawer-primary-btn">Confirm</Button>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              data-testid="drawer-cancel-btn"
            >
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </section>
  );
}

// ── Variant map ───────────────────────────────────────────────────────────────

const VARIANT_MAP: Record<string, React.FC> = {
  "sheet-bottom": SheetBottomHarness,
  "sheet-right": SheetRightHarness,
  drawer: DrawerBottomHarness,
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SheetTestHarness() {
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
      data-testid="sheet-test-harness"
    >
      <header>
        <h1 className="text-lg font-semibold">Sheet / Drawer Test Harness</h1>
        <p className="text-sm text-muted-foreground">
          Rendering variant(s):{" "}
          <code className="bg-white/10 px-1 rounded">{requested}</code>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Append{" "}
          <code className="bg-white/10 px-1 rounded">?variant=</code> to the
          URL to test a single variant.
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
