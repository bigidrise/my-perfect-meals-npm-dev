import React from "react";

interface VisualCertificateProps {
  recipientName: string;
  certType: string;
  certificateNumber: string;
  completedAt: string;
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Template image: 2000 × 1545 px  (matches landscape LETTER almost exactly)
// Display at 760 × 587 px.
//
// CROP: The PNG has ~5% white margin at top and bottom outside the decorative border.
// We clip those with overflow:hidden + a negative marginTop on the inner div.
// Overlays stay % relative to the inner (full) height — no position math needed.
//
// Bottom section layout (left → right):
//   [Gold Seal ~3–18%] | [CERT NUMBER ~19–36%] | [Signature center] | [DATE ~67–86%]

const W = 760;
const H = Math.round(W * 1545 / 2000); // 587 — full inner height (used for overlays)

// How many px to slice from top and bottom of the displayed image
const CROP_TOP    = Math.round(H * 0.05); // ~29 px
const CROP_BOTTOM = Math.round(H * 0.05); // ~29 px
const DISPLAY_H   = H - CROP_TOP - CROP_BOTTOM; // ~529 px visible

const CREAM = "#F7F2E7";
const NAVY  = "#0F1F3D";
const GOLD  = "#C4973A";

export default function VisualCertificate({
  recipientName,
  certType,
  certificateNumber,
  completedAt,
}: VisualCertificateProps) {
  const dateStr = formatDate(completedAt);
  const templateSrc =
    certType === "mpm_specialist"
      ? "/cert-template-specialist.png"
      : "/cert-template-professional.png";

  return (
    <div className="overflow-x-auto w-full print:overflow-visible">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap');`}</style>

      {/* Outer crop shell — clips top and bottom white margins */}
      <div
        className="mx-auto print:mx-0"
        style={{ width: W, minWidth: W, height: DISPLAY_H, overflow: "hidden" }}
      >

      {/* Inner full-size container — shifted up by CROP_TOP to center-crop */}
      <div
        className="relative select-none"
        style={{ width: W, height: H, marginTop: -CROP_TOP }}
      >
        {/* ── STATIC TEMPLATE ── */}
        <img
          src={templateSrc}
          alt="Certificate"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "fill",
            userSelect: "none",
          }}
          draggable={false}
        />

        {/* ══════════════════════════════════════════
            OVERLAY 1 — RECIPIENT NAME
            Cover the faded "Your paragraph text" ghost, render real name.
        ══════════════════════════════════════════ */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "30%",
            left: "13%",
            right: "13%",
            height: "13%",
            background: CREAM,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "30%",
            left: "13%",
            right: "13%",
            height: "13%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <p
            style={{
              fontFamily: "'Great Vibes', cursive",
              fontSize: 50,
              color: NAVY,
              margin: 0,
              lineHeight: 1.05,
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            {recipientName}
          </p>
        </div>

        {/* ══════════════════════════════════════════
            OVERLAY 2 — CERTIFICATION NUMBER
            Bottom-left column, right of the gold seal (~19–36% width).
            Template is blank here — no cream cover needed, just place text.
        ══════════════════════════════════════════ */}

        {/* Label */}
        <p
          style={{
            position: "absolute",
            top: "74%",
            left: "19%",
            width: "17%",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontWeight: 700,
            fontSize: 7,
            color: GOLD,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            margin: 0,
            lineHeight: 1,
          }}
        >
          Certification Number
        </p>

        {/* Value */}
        <p
          style={{
            position: "absolute",
            top: "78%",
            left: "19%",
            width: "17%",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontWeight: 700,
            fontSize: 11,
            color: NAVY,
            margin: 0,
            lineHeight: 1,
          }}
        >
          {certificateNumber}
        </p>

        {/* ══════════════════════════════════════════
            OVERLAY 3 — DATE ISSUED
            Bottom-right column (~67–86% width).
            Template is blank here — no cream cover needed.
        ══════════════════════════════════════════ */}

        {/* Label */}
        <p
          style={{
            position: "absolute",
            top: "74%",
            right: "22%",
            width: "16%",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontWeight: 700,
            fontSize: 7,
            color: GOLD,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            margin: 0,
            lineHeight: 1,
            textAlign: "right",
          }}
        >
          Date Issued
        </p>

        {/* Value */}
        <p
          style={{
            position: "absolute",
            top: "78%",
            right: "22%",
            width: "16%",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontWeight: 700,
            fontSize: 11,
            color: NAVY,
            margin: 0,
            lineHeight: 1,
            textAlign: "right",
          }}
        >
          {dateStr}
        </p>
      </div>
      </div>
    </div>
  );
}
