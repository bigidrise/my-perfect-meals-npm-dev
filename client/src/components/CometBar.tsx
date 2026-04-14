// client/src/components/CometBar.tsx
// Sweeping scan-line indicator for location-based search screens
// (Restaurant Guide + Find Meals Near Me).
// A comet head races left → right with an orange glow trail.
// Never reaches "100%" — communicates active scanning, not generation.

interface CometBarProps {
  label?: string;
  className?: string;
}

export default function CometBar({
  label = "Scanning nearby…",
  className = "",
}: CometBarProps) {
  return (
    <div className={`flex flex-col items-center gap-4 py-2 ${className}`}>
      {/* Glass pill container */}
      <div
        style={{
          background: "rgba(0, 0, 0, 0.45)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "999px",
          padding: "14px 28px",
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
          minWidth: "200px",
        }}
      >
        {/* Track */}
        <div
          style={{
            position: "relative",
            width: "160px",
            height: "3px",
            borderRadius: "999px",
            background: "rgba(255, 255, 255, 0.08)",
            overflow: "hidden",
          }}
        >
          {/* Comet — head + trailing glow */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              transform: "translateY(-50%)",
              width: "56px",
              height: "3px",
              borderRadius: "999px",
              background:
                "linear-gradient(to left, rgba(251,146,60,0) 0%, rgba(251,146,60,0.55) 45%, rgba(255,200,120,1) 100%)",
              boxShadow:
                "0 0 8px 2px rgba(251,146,60,0.7), 0 0 18px 4px rgba(251,146,60,0.3)",
              animation: "cometSweep 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
        </div>
      </div>

      {/* Label */}
      {label && (
        <p className="text-white/55 text-xs font-medium tracking-widest uppercase">
          {label}
        </p>
      )}

      <style>{`
        @keyframes cometSweep {
          0%   { left: -56px;  opacity: 0;   }
          10%  { opacity: 1; }
          85%  { opacity: 1; }
          100% { left: 160px;  opacity: 0;   }
        }
      `}</style>
    </div>
  );
}
