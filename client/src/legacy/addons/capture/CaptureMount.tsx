// ADD-ONLY: e.g., client/src/addons/capture/CaptureMount.tsx
import React, { useState } from "react";
import CaptureBar, { type CapturedItem } from "./CaptureBar";
import CaptureInbox from "./CaptureInbox";

export default function CaptureMount() {
  const [inboxOpen, setInboxOpen] = useState(false);
  const [pending, setPending] = useState<CapturedItem[]>([]);
  const userId = localStorage.getItem("userId") || "00000000-0000-0000-0000-000000000000";

  return (
    <>
      <CaptureBar
        onCaptured={(items) => {
          setPending(items);
          setInboxOpen(true);
        }}
      />
      <CaptureInbox
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
        items={pending}
        userId={userId}
      />
    </>
  );
}