/**
 * UNIVERSAL MODAL SYSTEM
 *
 * THE RULE: A modal is a container, not a layout.
 * DialogContent is the shell that holds your UI — it should never be
 * the place where you also build the UI itself.
 *
 * ENFORCEMENT: The only file in this codebase allowed to import
 * `DialogContent` is this file. Every other modal must use one of:
 *   UniversalDialog, ConfirmationModal, FormModal, PickerModal,
 *   InformationModal, WorkflowModal, WizardModal
 *
 * See UNIVERSAL_MODAL_SYSTEM.md for the full architecture guide.
 */

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

// ─── 0. UniversalDialog — general-purpose base bridge ────────────────────────
/**
 * Use when a modal doesn't fit any of the 5 typed variants below.
 * All typed components follow the same layout contract as this base.
 *
 * Width: max-w-md by default; override via className.
 * Body: scrolls by default; set disableBodyScroll for fixed-height content.
 */
export interface UniversalDialogProps extends Omit<BaseModalProps, "children" | "title"> {
  /** Required for normal use; omit only when rawLayout=true */
  title?: React.ReactNode
  /** Prevents ModalBody scroll wrapping — use for short non-scrolling content */
  disableBodyScroll?: boolean
  /**
   * Skip the built-in DialogHeader + ModalBody wrapping.
   * Use for complex modals with their own internal header/scroll structure.
   * When true, children render directly inside DialogContent's flex column.
   */
  rawLayout?: boolean
  /**
   * Set to false to suppress the built-in close ✕ button.
   * Use when the consuming modal renders its own close control (e.g. a Trash2 icon).
   * Default: true.
   */
  showCloseButton?: boolean
  /** Forwarded to Radix DialogContent's onOpenAutoFocus */
  onOpenAutoFocus?: (e: Event) => void
  children?: React.ReactNode
}

export function UniversalDialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  className,
  disableBodyScroll = false,
  rawLayout = false,
  showCloseButton = true,
  onOpenAutoFocus,
  children,
}: UniversalDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col max-w-md w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden",
          rawLayout && "p-0",
          className
        )}
        showCloseButton={showCloseButton}
        onOpenAutoFocus={onOpenAutoFocus}
      >
        {rawLayout ? (
          children
        ) : (
          <>
            <DialogHeader className="shrink-0">
              <DialogTitle>{title}</DialogTitle>
              {description && (
                <DialogDescription>{description}</DialogDescription>
              )}
            </DialogHeader>
            {disableBodyScroll ? (
              <div className="shrink-0">{open ? children : null}</div>
            ) : (
              <ModalBody className="px-1">{open ? children : null}</ModalBody>
            )}
            {footer && <ModalFooter>{footer}</ModalFooter>}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Shared layout primitives ─────────────────────────────────────────────────

/**
 * Scrollable body region. Always pair with a typed modal whose container
 * has `flex flex-col overflow-hidden` and a fixed height/max-height.
 *
 * `min-h-0` is essential — without it, a flex child will refuse to shrink
 * past its content height, defeating the overflow-hidden on the parent.
 */
export function ModalBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto overscroll-contain min-h-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Mobile-first sticky footer.
 * - On portrait (< sm): column-reverse so primary action is at the top.
 * - On sm+: row with primary action on the right.
 * - Always separated from body with a subtle border.
 */
export function ModalFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-white/10",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

// ─── Shared base props ────────────────────────────────────────────────────────

interface BaseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  /** Sticky footer — use ModalFooter children or raw buttons */
  footer?: React.ReactNode
  /** Extra classes for the DialogContent container */
  className?: string
  /** The body content — lazy-rendered (not mounted when closed) */
  children: React.ReactNode
}

// ─── 1. ConfirmationModal ─────────────────────────────────────────────────────
/**
 * Delete, save, dangerous actions, short yes/no prompts.
 *
 * Width: max-w-sm. Content must not require internal scroll.
 * Footer: stacks on mobile, row on sm+.
 */
export function ConfirmationModal({
  open,
  onOpenChange,
  title,
  description,
  footer,
  className,
  children,
}: BaseModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col max-w-sm w-[calc(100vw-2rem)]",
          className
        )}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        <div className="shrink-0">{open ? children : null}</div>
        {footer && (
          <ModalFooter className="border-t-0 pt-2">{footer}</ModalFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── 2. FormModal ─────────────────────────────────────────────────────────────
/**
 * Edit profile, create client, settings panels, short-to-medium forms.
 *
 * Width: max-w-md. Header sticks. Body scrolls. Footer sticks.
 */
export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  footer,
  className,
  children,
}: BaseModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col max-w-md w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden",
          className
        )}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        <ModalBody className="px-1">{open ? children : null}</ModalBody>
        {footer && <ModalFooter>{footer}</ModalFooter>}
      </DialogContent>
    </Dialog>
  )
}

// ─── 3. PickerModal ───────────────────────────────────────────────────────────
/**
 * Meal pickers, recipe pickers, food search, library browse.
 *
 * Width: max-w-2xl. Header sticks. Optional filter bar sticks below header.
 * Body scrolls. Optional footer sticks.
 */
export interface PickerModalProps extends BaseModalProps {
  /** Filter chips, category tabs, or search inputs that stick below the header */
  filterBar?: React.ReactNode
}

export function PickerModal({
  open,
  onOpenChange,
  title,
  description,
  filterBar,
  footer,
  className,
  children,
}: PickerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col max-w-2xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden",
          className
        )}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        {filterBar && (
          <div className="shrink-0">{filterBar}</div>
        )}
        <ModalBody>{open ? children : null}</ModalBody>
        {footer && <ModalFooter>{footer}</ModalFooter>}
      </DialogContent>
    </Dialog>
  )
}

// ─── 4. InformationModal ──────────────────────────────────────────────────────
/**
 * Help dialogs, explanations, onboarding tips, feature announcements.
 *
 * Width: max-w-md. Header sticks. Body scrolls. Optional footer sticks.
 */
export function InformationModal({
  open,
  onOpenChange,
  title,
  description,
  footer,
  className,
  children,
}: BaseModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col max-w-md w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden",
          className
        )}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        <ModalBody className="px-1">{open ? children : null}</ModalBody>
        {footer && <ModalFooter>{footer}</ModalFooter>}
      </DialogContent>
    </Dialog>
  )
}

// ─── 5. WorkflowModal ─────────────────────────────────────────────────────────
/**
 * Multi-section editors: RecipeEditorPro, CulturalRecipeEditor, FamilyRecipeEditor.
 *
 * Width: max-w-4xl. Near-full-screen on portrait mobile (h-[90vh]).
 * Header sticks. Full body scrolls. Optional sticky footer.
 */
export function WorkflowModal({
  open,
  onOpenChange,
  title,
  description,
  footer,
  className,
  children,
}: BaseModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col max-w-4xl w-[calc(100vw-2rem)] h-[90vh] overflow-hidden",
          className
        )}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>
        <ModalBody>{open ? children : null}</ModalBody>
        {footer && <ModalFooter>{footer}</ModalFooter>}
      </DialogContent>
    </Dialog>
  )
}

// ─── 6. WizardModal ───────────────────────────────────────────────────────────
/**
 * Multi-step onboarding, certification flows, medical intake, questionnaires.
 *
 * Width: max-w-lg. Progress bar sticks below header. Body scrolls.
 * Back / Next / Complete footer sticks. Step validation enforced via nextDisabled.
 */
interface WizardModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Top-level title of the wizard (shown throughout) */
  title: React.ReactNode
  description?: React.ReactNode
  /** 0-indexed current step */
  step: number
  totalSteps: number
  /** Override the default "Step N of M" label */
  stepLabel?: string
  onBack?: () => void
  onNext?: () => void
  onComplete?: () => void
  nextLabel?: string
  completeLabel?: string
  backLabel?: string
  nextDisabled?: boolean
  completeDisabled?: boolean
  /** When true, renders completeLabel instead of nextLabel */
  isLastStep?: boolean
  className?: string
  children: React.ReactNode
}

export function WizardModal({
  open,
  onOpenChange,
  title,
  description,
  step,
  totalSteps,
  stepLabel,
  onBack,
  onNext,
  onComplete,
  nextLabel = "Continue",
  completeLabel = "Complete",
  backLabel = "Back",
  nextDisabled = false,
  completeDisabled = false,
  isLastStep = false,
  className,
  children,
}: WizardModalProps) {
  const progressPct =
    totalSteps > 1 ? Math.round(((step + 1) / totalSteps) * 100) : 100

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col max-w-lg w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden",
          className
        )}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        {/* Sticky progress bar */}
        <div className="shrink-0 space-y-1.5 pb-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{stepLabel ?? `Step ${step + 1} of ${totalSteps}`}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <ModalBody className="px-1">{open ? children : null}</ModalBody>

        <ModalFooter>
          {onBack && step > 0 && (
            <button
              type="button"
              onClick={onBack}
              className="shrink-0 bg-white/10 text-white/80 text-sm font-semibold px-4 py-2 rounded-xl active:bg-white/20"
            >
              {backLabel}
            </button>
          )}
          <div className="flex-1" />
          {isLastStep ? (
            <button
              type="button"
              onClick={onComplete}
              disabled={completeDisabled}
              className="bg-orange-600 text-white text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-50"
            >
              {completeLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              disabled={nextDisabled}
              className="bg-orange-600 text-white text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-50"
            >
              {nextLabel}
            </button>
          )}
        </ModalFooter>
      </DialogContent>
    </Dialog>
  )
}
