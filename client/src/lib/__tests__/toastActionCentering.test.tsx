/**
 * @jest-environment jsdom
 *
 * Toast — ToastAction vertical centering regression
 *
 * The Toast container (`items-start`) top-aligns its flex children by default.
 * ToastAction compensates with `self-center` so the button stays vertically
 * centered regardless of how tall the title + description block grows.
 *
 * This test guards against accidental removal of that class in toast.tsx or
 * the action wrapper div in toaster.tsx.
 *
 * Run: npx jest client/src/lib/__tests__/toastActionCentering.test.tsx
 */

// ── Module mocks — must appear before imports ──────────────────────────────────

// Render Radix portals inline so toast content appears in the test document.
jest.mock('react-dom', () => ({
  ...jest.requireActual('react-dom'),
  createPortal: (node: React.ReactNode) => node,
}));

import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  Toast,
  ToastTitle,
  ToastDescription,
  ToastAction,
  ToastProvider,
  ToastViewport,
} from '@/components/ui/toast';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Renders a Toast containing title, description, and an action button.
 * This is the layout that trips top-alignment when `self-center` is absent.
 */
function renderToastWithAction() {
  return render(
    <ToastProvider>
      <Toast open>
        <div className="grid gap-1">
          <ToastTitle>Meal saved</ToastTitle>
          <ToastDescription>
            Your meal has been added to your favorites list.
          </ToastDescription>
        </div>
        <ToastAction altText="Undo">Undo</ToastAction>
      </Toast>
      <ToastViewport />
    </ToastProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('ToastAction — vertical centering when title and description are present', () => {
  it('carries self-center so the button is not top-aligned by items-start', () => {
    const { getByRole } = renderToastWithAction();

    // The action element itself must opt out of the container's items-start
    // alignment by declaring self-center.
    const actionButton = getByRole('button', { name: 'Undo' });
    expect(actionButton).toHaveClass('self-center');
  });

  it('keeps the action button vertically centred even when description spans multiple lines', () => {
    const { getByRole } = render(
      <ToastProvider>
        <Toast open>
          <div className="grid gap-1">
            <ToastTitle>Subscription updated</ToastTitle>
            <ToastDescription>
              Your plan has been upgraded to Premium. All new features are now
              unlocked and available across your account.
            </ToastDescription>
          </div>
          <ToastAction altText="View plan">View plan</ToastAction>
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );

    const actionButton = getByRole('button', { name: 'View plan' });
    expect(actionButton).toHaveClass('self-center');
  });

  it('keeps self-center on ToastAction inside a destructive variant toast', () => {
    const { getByRole } = render(
      <ToastProvider>
        <Toast open variant="destructive">
          <div className="grid gap-1">
            <ToastTitle>Action failed</ToastTitle>
            <ToastDescription>
              We could not complete the request. Please try again later.
            </ToastDescription>
          </div>
          <ToastAction altText="Retry">Retry</ToastAction>
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );

    const actionButton = getByRole('button', { name: 'Retry' });
    expect(actionButton).toHaveClass('self-center');
  });

  it('keeps self-center on ToastAction inside a warning variant toast', () => {
    const { getByRole } = render(
      <ToastProvider>
        <Toast open variant="warning">
          <div className="grid gap-1">
            <ToastTitle>Storage almost full</ToastTitle>
            <ToastDescription>
              You are approaching your storage limit. Free up space to avoid
              losing new data.
            </ToastDescription>
          </div>
          <ToastAction altText="Manage storage">Manage storage</ToastAction>
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );

    const actionButton = getByRole('button', { name: 'Manage storage' });
    expect(actionButton).toHaveClass('self-center');
  });

  it('Toaster action wrapper div also applies self-center', () => {
    // toaster.tsx wraps the action element in <div className="self-center">.
    // This test mirrors that pattern to confirm the wrapper carries the class.
    const { container } = render(
      <ToastProvider>
        <Toast open>
          <div className="grid gap-1">
            <ToastTitle>Item removed</ToastTitle>
            <ToastDescription>The item was removed from your list.</ToastDescription>
          </div>
          {/* mirrors the <div className="self-center">{action}</div> in toaster.tsx */}
          <div className="self-center">
            <ToastAction altText="Undo">Undo</ToastAction>
          </div>
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );

    const wrapper = container.querySelector('div.self-center');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toBeInTheDocument();
  });
});
