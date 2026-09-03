// client/src/components/ThinkingDots.tsx
// AI "thinking" indicator — three glowing dots inside a black glass pill.
// Matches the app's black glass aesthetic: dark backdrop, blur, soft border.

interface ThinkingDotsProps {
  label?: string;
  className?: string;
}

export default function ThinkingDots({
  label = "Chef is thinking…",
  className = "",
}: ThinkingDotsProps) {
  return (
    <div className={`flex flex-col items-center gap-3 py-4 ${className}`}>
      {/* Glass pill container */}
      <div
        style={{
          background: "rgba(0, 0, 0, 0.45)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "999px",
          padding: "10px 20px",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: "9px",
              height: "9px",
              borderRadius: "50%",
              backgroundColor: "rgba(251, 146, 60, 0.9)",
              animation: "thinkingBounce 1.1s ease-in-out infinite",
              animationDelay: `${i * 0.18}s`,
              boxShadow: "0 0 10px rgba(251,146,60,0.8), 0 0 20px rgba(251,146,60,0.3)",
            }}
          />
        ))}
      </div>

      {/* Label sits below the glass pill */}
      {label && (
        <p className="text-white/55 text-xs font-medium tracking-widest uppercase">
          {label}
        </p>
      )}

      <style>{`
        @keyframes thinkingBounce {
          0%, 80%, 100% { transform: translateY(0);   opacity: 0.55; }
          40%            { transform: translateY(-6px); opacity: 1;    }
        }
      `}</style>
    </div>
  );
}
