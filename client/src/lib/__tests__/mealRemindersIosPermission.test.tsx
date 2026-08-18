/**
 * @jest-environment jsdom
 *
 * MealReminders — iOS permission badge mid-session accuracy
 *
 * The component attaches a `visibilitychange` handler that calls
 * `checkNotificationPermission()` whenever the user returns to the app,
 * then updates the `iOSPermission` state which drives the iOS permission
 * status badge (`data-testid="ios-permission-label"`).
 *
 * This suite confirms:
 *   1. On mount (iOS, granted) the badge shows "Connected" / allowed text.
 *   2. On mount (iOS, denied) the badge shows "Blocked" text.
 *   3. Returning from background with permission revoked flips the badge
 *      from granted → blocked.
 *   4. Returning after re-granting permission flips it from blocked → granted.
 *   5. A hidden-only visibility event does NOT re-check / flip the badge.
 *   6. Multiple round-trips accumulate correctly.
 *   7. On web the iOS badge is absent and the pipeline path is used instead.
 */

import React from 'react';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mock Capacitor ────────────────────────────────────────────────────────────

const mockIsNativePlatform = jest.fn<boolean, []>();

jest.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockIsNativePlatform() },
}));

// ── Mock the reminder service ─────────────────────────────────────────────────

const mockCheckNotificationPermission = jest.fn<Promise<boolean>, []>();
const mockSetupNotificationListeners = jest.fn(() => () => {});
const mockLoadRemindersFromServer = jest.fn<Promise<any[]>, []>();
const mockCheckWebPushPipeline = jest.fn();
const mockGetWebPushPermission = jest.fn(() => 'default');

jest.mock('@/services/mealReminderService', () => ({
  checkNotificationPermission: (...args: any[]) =>
    mockCheckNotificationPermission(...args),
  setupNotificationListeners: (...args: any[]) =>
    mockSetupNotificationListeners(...args),
  loadRemindersFromServer: (...args: any[]) =>
    mockLoadRemindersFromServer(...args),
  checkWebPushPipeline: (...args: any[]) => mockCheckWebPushPipeline(...args),
  getWebPushPermission: (...args: any[]) => mockGetWebPushPermission(...args),
  saveRemindersToServer: jest.fn(),
  syncToiOS: jest.fn(),
  canceliOSReminders: jest.fn(),
  requestNotificationPermission: jest.fn(),
  enrollWebPush: jest.fn(),
  getDefaultSlots: () => [
    { label: 'Meal 1', time: '08:00', enabled: false },
    { label: 'Meal 2', time: '13:00', enabled: false },
  ],
  MAX_SLOTS: 6,
}));

// ── Mock i18n ─────────────────────────────────────────────────────────────────

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      if (key === 'mealReminders.mealN') return `Meal ${opts?.n ?? ''}`;
      // statusConnected → "statusConnected", statusBlocked → "statusBlocked"
      return key.split('.').pop() ?? key;
    },
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Simulate document visibility changing to the given state. */
function fireVisibilityChange(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Render MealReminders after all module mocks are in place. */
async function renderComponent() {
  const { default: MealReminders } = await import('@/components/MealReminders');
  let result: ReturnType<typeof render> | undefined;
  await act(async () => {
    result = render(<MealReminders />);
  });
  return result!;
}

// i18n key values produced by the mock for the two badge states
const LABEL_GRANTED = 'statusConnected';
const LABEL_DENIED  = 'statusBlockedIos';

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('MealReminders — iOS permission badge mid-session accuracy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsNativePlatform.mockReturnValue(true);
    mockLoadRemindersFromServer.mockResolvedValue([
      { id: '1', label: 'Breakfast', time: '08:00', enabled: false },
    ]);
    mockCheckWebPushPipeline.mockResolvedValue({ steps: [], ready: false });
  });

  afterEach(() => {
    cleanup();
    // Restore visibility to visible so event state doesn't bleed.
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
  });

  // ── Test 1: initial mount, permission granted ───────────────────────────────
  it('shows the granted badge on mount when iOS permission is already allowed', async () => {
    mockCheckNotificationPermission.mockResolvedValue(true);

    const { getByTestId } = await renderComponent();

    const label = getByTestId('ios-permission-label');
    expect(label).toHaveTextContent(LABEL_GRANTED);
  });

  // ── Test 2: initial mount, permission denied ────────────────────────────────
  it('shows the denied badge on mount when iOS permission is not granted', async () => {
    mockCheckNotificationPermission.mockResolvedValue(false);

    const { getByTestId } = await renderComponent();

    const label = getByTestId('ios-permission-label');
    expect(label).toHaveTextContent(LABEL_DENIED);
  });

  // ── Test 3: revoke mid-session — badge flips granted → denied ───────────────
  it('flips the badge to denied when the user revokes permission in Settings', async () => {
    mockCheckNotificationPermission.mockResolvedValue(true);

    const { getByTestId } = await renderComponent();

    // Badge starts as granted.
    expect(getByTestId('ios-permission-label')).toHaveTextContent(LABEL_GRANTED);

    // User opens Settings and revokes permission.
    fireVisibilityChange('hidden');
    mockCheckNotificationPermission.mockResolvedValue(false);

    // User returns to the app.
    await act(async () => {
      fireVisibilityChange('visible');
    });

    // Badge must now show denied without requiring a page reload.
    await waitFor(() => {
      expect(getByTestId('ios-permission-label')).toHaveTextContent(LABEL_DENIED);
    });
  });

  // ── Test 4: grant mid-session — badge flips denied → granted ───────────────
  it('flips the badge to granted when the user enables permission in Settings', async () => {
    mockCheckNotificationPermission.mockResolvedValue(false);

    const { getByTestId } = await renderComponent();

    // Badge starts as denied.
    expect(getByTestId('ios-permission-label')).toHaveTextContent(LABEL_DENIED);

    // User opens Settings and grants permission.
    fireVisibilityChange('hidden');
    mockCheckNotificationPermission.mockResolvedValue(true);

    await act(async () => {
      fireVisibilityChange('visible');
    });

    // Badge must now reflect the newly granted permission.
    await waitFor(() => {
      expect(getByTestId('ios-permission-label')).toHaveTextContent(LABEL_GRANTED);
    });
  });

  // ── Test 5: hiding the page alone must NOT flip the badge ───────────────────
  it('does not change the badge when only the hidden event fires (no return)', async () => {
    mockCheckNotificationPermission.mockResolvedValue(true);

    const { getByTestId } = await renderComponent();

    expect(getByTestId('ios-permission-label')).toHaveTextContent(LABEL_GRANTED);

    // Simulate the app going to the background only.
    await act(async () => {
      fireVisibilityChange('hidden');
    });

    // Badge must be unchanged.
    expect(getByTestId('ios-permission-label')).toHaveTextContent(LABEL_GRANTED);
  });

  // ── Test 6: multiple round-trips accumulate correctly ──────────────────────
  it('tracks permission accurately across multiple Settings visits', async () => {
    // Mount: granted
    mockCheckNotificationPermission
      .mockResolvedValueOnce(true)   // mount
      .mockResolvedValueOnce(false)  // first return — revoked
      .mockResolvedValueOnce(true);  // second return — re-granted

    const { getByTestId } = await renderComponent();
    expect(getByTestId('ios-permission-label')).toHaveTextContent(LABEL_GRANTED);

    // First round-trip: revoke
    fireVisibilityChange('hidden');
    await act(async () => { fireVisibilityChange('visible'); });
    await waitFor(() => {
      expect(getByTestId('ios-permission-label')).toHaveTextContent(LABEL_DENIED);
    });

    // Second round-trip: re-grant
    fireVisibilityChange('hidden');
    await act(async () => { fireVisibilityChange('visible'); });
    await waitFor(() => {
      expect(getByTestId('ios-permission-label')).toHaveTextContent(LABEL_GRANTED);
    });
  });

  // ── Test 7: web — iOS badge is absent; pipeline path used instead ──────────
  it('does not render the iOS permission badge on web and uses the pipeline check instead', async () => {
    mockIsNativePlatform.mockReturnValue(false);
    mockCheckWebPushPipeline.mockResolvedValue({ steps: [], ready: true });
    mockGetWebPushPermission.mockReturnValue('granted');

    const { queryByTestId } = await renderComponent();

    // The iOS badge must not be present.
    expect(queryByTestId('ios-permission-label')).toBeNull();

    // Returning to the app on web must call the pipeline, not the iOS check.
    await act(async () => {
      fireVisibilityChange('hidden');
      fireVisibilityChange('visible');
    });

    expect(mockCheckNotificationPermission).not.toHaveBeenCalled();
    expect(mockCheckWebPushPipeline).toHaveBeenCalled();
  });
});
