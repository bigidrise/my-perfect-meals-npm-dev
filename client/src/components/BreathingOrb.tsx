// client/src/components/BreathingOrb.tsx
// Premium AI "thinking" indicator for Create with Chef.
// A single soft glowing orb that slowly inhales and exhales —
// feels like calm intelligence, not a loading spinner.
// Black glass container matches the app's glass aesthetic.

interface BreathingOrbProps {
  label?: string;
  className?: string;
}

export default function BreathingOrb({
  label = "Chef is preparing your meal…",
  className = "",
}: BreathingOrbProps) {
  return (
    <div className={`flex flex-col items-center gap-4 py-4 ${className}`}>
      {/* Glass pill container */}
      <div
        style={{
          background: "rgba(0, 0, 0, 0.45)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "999px",
          padding: "16px 24px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Outer glow ring */}
        <div
          style={{
            position: "relative",
            width: "36px",
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Expanding ring */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: "rgba(251, 146, 60, 0.15)",
              animation: "orbBreathe 2.8s ease-in-out infinite",
              boxShadow: "0 0 20px rgba(251,146,60,0.25)",
            }}
          />
          {/* Core orb */}
          <div
            style={{
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background: "radial-gradient(circle at 35% 35%, rgba(255,180,100,1), rgba(251,146,60,0.85))",
              animation: "orbPulse 2.8s ease-in-out infinite",
              boxShadow: "0 0 14px rgba(251,146,60,0.9), 0 0 28px rgba(251,146,60,0.4)",
              flexShrink: 0,
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
        @keyframes orbBreathe {
          0%, 100% { transform: scale(1);    opacity: 0.6; }
          50%       { transform: scale(1.55); opacity: 1;   }
        }
        @keyframes orbPulse {
          0%, 100% { transform: scale(1);    opacity: 0.8; }
          50%       { transform: scale(1.12); opacity: 1;   }
        }
      `}</style>
    </div>
  );
}
