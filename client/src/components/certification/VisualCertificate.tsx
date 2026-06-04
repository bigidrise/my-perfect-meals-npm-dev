import React from "react";
import { Brain, ShieldCheck, Lightbulb, RefreshCw, BarChart2, Monitor } from "lucide-react";

interface VisualCertificateProps {
  recipientName: string;
  certType: string;
  certificateNumber: string;
  completedAt: string;
}

const NAVY = "#0F1F3D";
const GOLD = "#C9A84C";
const CREAM = "#F8F5EE";

function certTypeLabel(certType: string): string {
  if (certType === "affiliate_coaching") return "Business & Coaching Affiliate";
  return "Social & Referral Affiliate";
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const COMPETENCIES: { Icon: React.ElementType; label: string }[] = [
  { Icon: Brain,       label: "ADAPTIVE\nNUTRITION" },
  { Icon: ShieldCheck, label: "PROTOCOL-AWARE\nNUTRITION" },
  { Icon: Lightbulb,   label: "BEHAVIOR CHANGE\nPRINCIPLES" },
  { Icon: RefreshCw,   label: "LIFESTYLE\nINTEGRATION" },
  { Icon: BarChart2,   label: "SPECIALIZED\nNUTRITION SYSTEMS" },
  { Icon: Monitor,     label: "MPM PLATFORM\nOPERATIONS" },
];

export default function VisualCertificate({
  recipientName,
  certType,
  certificateNumber,
  completedAt,
}: VisualCertificateProps) {
  const label = certTypeLabel(certType);
  const dateStr = formatDate(completedAt);
  const sigUrl = "/api/certifications/assets/signature";

  return (
    <div className="overflow-x-auto w-full print:overflow-visible">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap');`}</style>

      {/* Certificate canvas — 760 × 587 (11 : 8.5 ratio) */}
      <div
        className="relative mx-auto print:mx-0 select-none"
        style={{ width: 760, minWidth: 760, height: 587, background: CREAM }}
      >
        {/* ── FRAME ── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ border: `7px solid ${NAVY}`, zIndex: 10 }}
        />
        <div
          className="absolute pointer-events-none"
          style={{ inset: 11, border: `1.5px solid ${GOLD}`, zIndex: 10 }}
        />
        <div
          className="absolute pointer-events-none"
          style={{ inset: 15, border: `0.5px solid ${GOLD}`, zIndex: 10 }}
        />

        {/* Corner gold diamonds */}
        {(["topLeft", "topRight", "bottomLeft", "bottomRight"] as const).map((corner) => {
          const style: React.CSSProperties = {
            position: "absolute",
            width: 20,
            height: 20,
            background: GOLD,
            transform: "rotate(45deg) scale(0.75)",
            zIndex: 12,
            pointerEvents: "none",
            ...(corner === "topLeft"     ? { top: -4, left: -4 }     : {}),
            ...(corner === "topRight"    ? { top: -4, right: -4 }    : {}),
            ...(corner === "bottomLeft"  ? { bottom: -4, left: -4 }  : {}),
            ...(corner === "bottomRight" ? { bottom: -4, right: -4 } : {}),
          };
          return <div key={corner} style={style} />;
        })}

        {/* ── NAVY HEADER ── */}
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-center gap-4"
          style={{ height: 66, background: NAVY, zIndex: 5 }}
        >
          <span
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: GOLD,
              letterSpacing: "0.04em",
              fontFamily: "Georgia, serif",
              lineHeight: 1,
            }}
          >
            MPM
          </span>
          <div style={{ width: 1, height: 36, background: `${GOLD}55` }} />
          <div className="flex flex-col">
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#FFFFFF",
                letterSpacing: "0.15em",
                fontFamily: "Arial, Helvetica, sans-serif",
                lineHeight: 1,
              }}
            >
              MY PERFECT MEALS
            </span>
            <span
              style={{
                fontSize: 7,
                color: GOLD,
                letterSpacing: "0.2em",
                fontFamily: "Arial, Helvetica, sans-serif",
                marginTop: 4,
                lineHeight: 1,
              }}
            >
              AI POWERED ADAPTIVE NUTRITION
            </span>
          </div>
        </div>

        {/* ── MAIN BODY ── */}
        <div
          className="absolute left-0 right-0 flex flex-col items-center"
          style={{ top: 66, paddingTop: 13, paddingLeft: 52, paddingRight: 52 }}
        >
          {/* CERTIFIED PROFESSIONAL */}
          <p
            style={{
              fontSize: 29,
              fontWeight: 900,
              color: NAVY,
              letterSpacing: "0.07em",
              fontFamily: "Arial, Helvetica, sans-serif",
              lineHeight: 1,
              margin: 0,
            }}
          >
            CERTIFIED PROFESSIONAL
          </p>

          {/* Gold ornament rule */}
          <div
            className="flex items-center gap-2 mt-2"
            style={{ width: "100%" }}
          >
            <div
              style={{
                flex: 1,
                height: 1,
                background: `linear-gradient(to right, transparent, ${GOLD})`,
              }}
            />
            <span style={{ fontSize: 10, color: GOLD, lineHeight: 1 }}>✦</span>
            <div
              style={{
                flex: 1,
                height: 1,
                background: `linear-gradient(to left, transparent, ${GOLD})`,
              }}
            />
          </div>

          {/* Cert type subtitle */}
          <p
            style={{
              fontSize: 7.5,
              color: GOLD,
              letterSpacing: "0.22em",
              fontFamily: "Arial, Helvetica, sans-serif",
              fontWeight: 700,
              marginTop: 4,
              textAlign: "center",
            }}
          >
            {label.toUpperCase()}&nbsp;&nbsp;·&nbsp;&nbsp;CERTIFICATE OF COMPLETION
          </p>

          {/* This certifies that */}
          <p
            style={{
              fontSize: 9.5,
              color: "#8B7355",
              marginTop: 8,
              fontFamily: "Georgia, serif",
              fontStyle: "italic",
            }}
          >
            This certifies that
          </p>

          {/* Recipient name — Great Vibes script */}
          <p
            style={{
              fontSize: 46,
              color: NAVY,
              lineHeight: 1.05,
              marginTop: 2,
              fontFamily: "'Great Vibes', cursive",
              textAlign: "center",
            }}
          >
            {recipientName}
          </p>

          {/* Gold name underline */}
          <div
            style={{
              width: Math.min(recipientName.length * 17, 420),
              height: 1,
              background: `linear-gradient(to right, transparent, ${GOLD}, transparent)`,
              marginTop: 2,
            }}
          />

          {/* Completion text */}
          <p
            style={{
              fontSize: 9.5,
              color: "#8B7355",
              marginTop: 6,
              fontFamily: "Georgia, serif",
              fontStyle: "italic",
            }}
          >
            has successfully completed the
          </p>
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: NAVY,
              fontFamily: "Arial, Helvetica, sans-serif",
              marginTop: 2,
              letterSpacing: "0.01em",
            }}
          >
            My Perfect Meals Certification Program
          </p>

          {/* Competency label */}
          <p
            style={{
              fontSize: 8.5,
              color: "#8B7355",
              marginTop: 7,
              fontFamily: "Georgia, serif",
              fontStyle: "italic",
            }}
          >
            and has demonstrated competency in:
          </p>

          {/* Competency icons */}
          <div
            className="flex items-start justify-center mt-2"
            style={{ gap: 14 }}
          >
            {COMPETENCIES.map(({ Icon, label: compLabel }, i) => (
              <div
                key={i}
                className="flex flex-col items-center"
                style={{ width: 66 }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: `1px solid ${GOLD}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon style={{ width: 13, height: 13, color: GOLD }} />
                </div>
                <p
                  style={{
                    fontSize: 6,
                    color: NAVY,
                    textAlign: "center",
                    marginTop: 3,
                    fontFamily: "Arial, Helvetica, sans-serif",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    lineHeight: 1.35,
                    whiteSpace: "pre-line",
                  }}
                >
                  {compLabel}
                </p>
              </div>
            ))}
          </div>

          {/* Description */}
          <p
            style={{
              fontSize: 7.5,
              color: "#8B7355",
              textAlign: "center",
              marginTop: 6,
              maxWidth: 510,
              lineHeight: 1.6,
              fontFamily: "Georgia, serif",
              fontStyle: "italic",
            }}
          >
            This certification recognizes the recipient's successful completion of all required
            coursework, practical exercises, case studies, and final assessments.
          </p>
        </div>

        {/* ── BOTTOM INFO ROW ── */}
        <div
          className="absolute left-0 right-0 flex items-end"
          style={{ bottom: 32, paddingLeft: 44, paddingRight: 44, paddingBottom: 6 }}
        >
          {/* Gold seal */}
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: `radial-gradient(circle at 38% 38%, #E8C96A 0%, #9A6D1C 100%)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              border: `2.5px solid ${GOLD}`,
              boxShadow: "0 3px 10px rgba(0,0,0,0.30)",
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: NAVY,
                fontFamily: "Arial, Helvetica, sans-serif",
                letterSpacing: "0.04em",
                lineHeight: 1,
              }}
            >
              MPM
            </span>
            <span
              style={{
                fontSize: 4.5,
                color: NAVY,
                fontFamily: "Arial, Helvetica, sans-serif",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textAlign: "center",
                lineHeight: 1.35,
                marginTop: 2,
              }}
            >
              MY PERFECT{"\n"}MEALS
            </span>
            <div className="flex gap-1 mt-1">
              {[0, 1, 2].map((i) => (
                <span key={i} style={{ fontSize: 6, color: NAVY, lineHeight: 1 }}>
                  ★
                </span>
              ))}
            </div>
          </div>

          {/* Center: cert number | signature | date */}
          <div
            className="flex items-end justify-between"
            style={{ flex: 1, marginLeft: 20 }}
          >
            {/* Cert number */}
            <div style={{ paddingBottom: 2 }}>
              <p
                style={{
                  fontSize: 6.5,
                  color: GOLD,
                  letterSpacing: "0.16em",
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontWeight: 700,
                  marginBottom: 3,
                }}
              >
                CERTIFICATION NUMBER
              </p>
              <p
                style={{
                  fontSize: 9.5,
                  color: NAVY,
                  fontFamily: "'Courier New', monospace",
                  fontWeight: 700,
                }}
              >
                {certificateNumber}
              </p>
            </div>

            {/* Signature block */}
            <div className="flex flex-col items-center" style={{ paddingBottom: 0 }}>
              <img
                src={sigUrl}
                alt="Signature"
                style={{ height: 62, objectFit: "contain", marginBottom: 3 }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div style={{ width: 210, height: 0.8, background: "#B8960C" }} />
              <p
                style={{
                  fontSize: 8.5,
                  fontWeight: 700,
                  color: NAVY,
                  fontFamily: "Arial, Helvetica, sans-serif",
                  marginTop: 3,
                  letterSpacing: "0.04em",
                }}
              >
                IDRISE WARD-EL
              </p>
              <p
                style={{
                  fontSize: 7,
                  color: "#8B7355",
                  fontFamily: "Georgia, serif",
                  marginTop: 1,
                }}
              >
                Founder &amp; CEO &nbsp;·&nbsp; My Perfect Meals
              </p>
            </div>

            {/* Date issued */}
            <div className="text-right" style={{ paddingBottom: 2 }}>
              <p
                style={{
                  fontSize: 6.5,
                  color: GOLD,
                  letterSpacing: "0.16em",
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontWeight: 700,
                  marginBottom: 3,
                }}
              >
                DATE ISSUED
              </p>
              <p
                style={{
                  fontSize: 9.5,
                  color: NAVY,
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontWeight: 700,
                }}
              >
                {dateStr}
              </p>
            </div>
          </div>
        </div>

        {/* ── NAVY FOOTER BANNER ── */}
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3"
          style={{ height: 28, background: NAVY }}
        >
          <div style={{ width: 32, height: 0.8, background: GOLD, opacity: 0.8 }} />
          <span
            style={{
              fontSize: 7,
              color: GOLD,
              letterSpacing: "0.22em",
              fontFamily: "Arial, Helvetica, sans-serif",
              fontWeight: 600,
            }}
          >
            AI POWERED ADAPTIVE NUTRITION BUILT FOR REAL LIFE
          </span>
          <div style={{ width: 32, height: 0.8, background: GOLD, opacity: 0.8 }} />
        </div>
      </div>
    </div>
  );
}
