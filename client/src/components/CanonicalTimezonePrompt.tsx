import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/universal-modal";
import {
  SUPPORTED_TIMEZONES,
  timezoneLabel,
} from "@/lib/canonicalTimezones";

function detectedTimezone(): string | null {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezone) return null;
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return null;
  }
}

export function CanonicalTimezonePrompt() {
  const { user, loading, refreshUser } = useAuth();
  const deviceTimezone = useMemo(detectedTimezone, []);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [choosingAnother, setChoosingAnother] = useState(false);
  const [selectedTimezone, setSelectedTimezone] = useState(SUPPORTED_TIMEZONES[0].timezone);

  const canonicalTimezone = user?.timezone || null;
  const mismatchKey =
    user && canonicalTimezone && deviceTimezone
      ? `timezone-mismatch-dismissed:${user.id}:${canonicalTimezone}:${deviceTimezone}`
      : null;

  useEffect(() => {
    if (loading || !user || !deviceTimezone) return;

    if (!canonicalTimezone) {
      void apiRequest("/api/users/profile", {
        method: "PUT",
        body: JSON.stringify({
          timezone: deviceTimezone,
          timezoneChangeConfirmed: true,
        }),
      }).then(() => refreshUser()).catch((error) => {
        console.warn("[timezone] Could not initialize canonical timezone", error);
      });
      return;
    }

    if (
      canonicalTimezone !== deviceTimezone &&
      mismatchKey &&
      localStorage.getItem(mismatchKey) !== "keep"
    ) {
      setOpen(true);
    }
  }, [canonicalTimezone, deviceTimezone, loading, mismatchKey, refreshUser, user]);

  if (!user || !canonicalTimezone || !deviceTimezone || canonicalTimezone === deviceTimezone) {
    return null;
  }

  const keepCurrent = () => {
    if (mismatchKey) localStorage.setItem(mismatchKey, "keep");
    setOpen(false);
  };

  const saveTimezone = async (timezone: string) => {
    setSaving(true);
    try {
      await apiRequest("/api/users/profile", {
        method: "PUT",
        body: JSON.stringify({
          timezone,
          timezoneChangeConfirmed: true,
        }),
      });
      if (mismatchKey) localStorage.removeItem(mismatchKey);
      await refreshUser();
      setChoosingAnother(false);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const useDeviceTimezone = () => saveTimezone(deviceTimezone);
  const chooseAnother = () => {
    setSelectedTimezone(
      SUPPORTED_TIMEZONES.some(({ timezone }) => timezone === canonicalTimezone)
        ? canonicalTimezone
        : SUPPORTED_TIMEZONES[0].timezone,
    );
    setChoosingAnother(true);
  };

  return (
    <ConfirmationModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !saving) keepCurrent();
      }}
      title={choosingAnother ? "Choose your timezone" : "Use your device’s timezone?"}
      description={
        choosingAnother
          ? "Select the timezone MPM should use for Today and daily features."
          : "Your device timezone differs from the timezone My Perfect Meals currently uses for Today."
      }
      footer={
        choosingAnother ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full min-w-0 whitespace-normal sm:w-auto"
              onClick={() => setChoosingAnother(false)}
              disabled={saving}
            >
              Back
            </Button>
            <Button
              type="button"
              className="w-full min-w-0 whitespace-normal sm:w-auto"
              onClick={() => void saveTimezone(selectedTimezone)}
              disabled={saving}
            >
              {saving ? "Updating…" : `Use ${timezoneLabel(selectedTimezone)}`}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full min-w-0 whitespace-normal sm:w-auto"
              onClick={keepCurrent}
              disabled={saving}
            >
              Keep {timezoneLabel(canonicalTimezone)}
            </Button>
            <Button
              type="button"
              className="w-full min-w-0 whitespace-normal sm:w-auto"
              onClick={() => void useDeviceTimezone()}
              disabled={saving}
            >
              {saving ? "Updating…" : `Use ${timezoneLabel(deviceTimezone)}`}
            </Button>
          </>
        )
      }
    >
      {choosingAnother ? (
        <div className="space-y-2">
          <label htmlFor="timezone-choice" className="text-sm font-medium">
            Timezone
          </label>
          <select
            id="timezone-choice"
            value={selectedTimezone}
            onChange={(event) => setSelectedTimezone(event.target.value)}
            className="w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={saving}
          >
            {SUPPORTED_TIMEZONES.map(({ timezone, label }) => (
              <option key={timezone} value={timezone}>{label}</option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Choose the new timezone only if you want all daily MPM features to follow it.
            Temporary travel will not change your saved timezone unless you confirm here.
          </p>
          <Button
            type="button"
            variant="link"
            className="h-auto max-w-full justify-start whitespace-normal px-0 text-left"
            onClick={chooseAnother}
            disabled={saving}
          >
            Choose another timezone
          </Button>
        </>
      )}
    </ConfirmationModal>
  );
}