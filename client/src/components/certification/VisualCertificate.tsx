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

// Template image: 2000 × 1545 px (ratio 1.2945 — matches landscape LETTER almost exactly)
// Display at 760 px wide → height = 587 px
// All overlay positions expressed as percentages of 760 × 587.
//
// Dynamic fields only (everything else is baked into the template):
//   1. Recipient name  — covers faded placeholder at ~30 – 42 % height, horizontally centered
//   2. Cert number     — covers "MPCP-2026-0001" at ~71 % height, left column
//   3. Date issued     — covers "May 30, 2026"   at ~71 % height, right column

const W = 760;
const H = Math.round(W * 1545 / 2000); // 587

// Cream colour sampled from the template background
const CREAM = "#F7F2E7";
const NAVY  = "#0F1F3D";

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
        {/* ── STATIC TEMPLATE ── logo, borders, seal, signature, icons, all fixed text */}
        <img
          src="/cert-template-professional.png"
          alt="Certificate template"
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

        {/* ══════════════════════════════════════════════
            OVERLAY 1 — RECIPIENT NAME
            Template has a faded "Your paragraph text" placeholder here.
            We cover it with a cream rectangle then render the real name.
        ══════════════════════════════════════════════ */}
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

        {/* ══════════════════════════════════════════════
            OVERLAY 2 — CERTIFICATION NUMBER
            Covers baked-in "MPCP-2026-0001" value and replaces it.
        ══════════════════════════════════════════════ */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "71%",
            left: "15%",
            width: "19%",
            height: "5.5%",
            background: CREAM,
          }}
        />
        <p
          style={{
            position: "absolute",
            top: "71.5%",
            left: "15.5%",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontWeight: 700,
            fontSize: 12,
            color: NAVY,
            margin: 0,
            lineHeight: 1,
          }}
        >
          {certificateNumber}
        </p>

        {/* ══════════════════════════════════════════════
            OVERLAY 3 — DATE ISSUED
            Covers baked-in "May 30, 2026" value and replaces it.
        ══════════════════════════════════════════════ */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: "71%",
            right: "9%",
            width: "18%",
            height: "5.5%",
            background: CREAM,
          }}
        />
        <p
          style={{
            position: "absolute",
            top: "71.5%",
            right: "9.5%",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontWeight: 700,
            fontSize: 12,
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
