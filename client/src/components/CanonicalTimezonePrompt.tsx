import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/universal-modal";

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

function timezoneLabel(timezone: string): string {
  try {
    const name = new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      timeZoneName: "long",
    }).formatToParts(new Date()).find((part) => part.type === "timeZoneName")?.value;
    return name ? `${name} (${timezone})` : timezone;
  } catch {
    return timezone;
  }
}

export function CanonicalTimezonePrompt() {
  const { user, refreshUser } = useAuth();
  const deviceTimezone = useMemo(detectedTimezone, []);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const canonicalTimezone = user?.timezone || null;
  const mismatchKey =
    user && canonicalTimezone && deviceTimezone
      ? `timezone-mismatch-dismissed:${user.id}:${canonicalTimezone}:${deviceTimezone}`
      : null;

  useEffect(() => {
    if (!user || !deviceTimezone) return;

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
  }, [canonicalTimezone, deviceTimezone, mismatchKey, refreshUser, user]);

  if (!user || !canonicalTimezone || !deviceTimezone || canonicalTimezone === deviceTimezone) {
    return null;
  }

  const keepCurrent = () => {
    if (mismatchKey) localStorage.setItem(mismatchKey, "keep");
    setOpen(false);
  };

  const useDeviceTimezone = async () => {
    setSaving(true);
    try {
      await apiRequest("/api/users/profile", {
        method: "PUT",
        body: JSON.stringify({
          timezone: deviceTimezone,
          timezoneChangeConfirmed: true,
        }),
      });
      if (mismatchKey) localStorage.removeItem(mismatchKey);
      await refreshUser();
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfirmationModal
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !saving) keepCurrent();
      }}
      title="Use your device’s timezone?"
      description="Your device timezone differs from the timezone My Perfect Meals currently uses for Today."
      footer={
        <>
          <Button type="button" variant="outline" onClick={keepCurrent} disabled={saving}>
            Keep {timezoneLabel(canonicalTimezone)}
          </Button>
          <Button type="button" onClick={() => void useDeviceTimezone()} disabled={saving}>
            {saving ? "Updating…" : `Use ${timezoneLabel(deviceTimezone)}`}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        Choose the new timezone only if you want all daily MPM features to follow it.
        Temporary travel will not change your saved timezone unless you confirm here.
      </p>
    </ConfirmationModal>
  );
}