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
// NEW TEMPLATE: The cert-number and date areas in the bottom section are BLANK —
// the user removed the placeholder text. We simply place label + value there.
// The name area still has the faded ghost placeholder — we cover it with a cream rect.
//
// Bottom section layout (left → right):
//   [Gold Seal ~3–18%] | [CERT NUMBER ~19–36%] | [Signature center] | [DATE ~67–86%]

const W = 760;
const H = Math.round(W * 1545 / 2000); // 587

const CREAM = "#F7F2E7";
const NAVY  = "#0F1F3D";
const GOLD  = "#C4973A";

export default function VisualCertificate({
  recipientName,
  certType: _certType,
  certificateNumber,
  completedAt,
}: VisualCertificateProps) {
  const dateStr = formatDate(completedAt);

  return (
    <div className="overflow-x-auto w-full print:overflow-visible">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap');`}</style>

      <div
        className="relative mx-auto print:mx-0 select-none"
        style={{ width: W, minWidth: W, height: H }}
      >
        {/* ── STATIC TEMPLATE ── */}
        <img
          src="/cert-template-professional.png"
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
            top: "69%",
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
            top: "73%",
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
            top: "69%",
            right: "10%",
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
            top: "73%",
            right: "10%",
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
  );
}
