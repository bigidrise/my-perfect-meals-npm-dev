// client/src/components/ThinkingDots.tsx
// AI "thinking" indicator — three glowing dots that wave in sequence.
// Replaces progress bars and spinners during AI generation states.
// Designed for the black glass aesthetic: orange glow on dark backgrounds.

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
      <div className="flex gap-[6px] items-center justify-center">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full bg-orange-400"
            style={{
              animation: "thinkingBounce 1.1s ease-in-out infinite",
              animationDelay: `${i * 0.18}s`,
              boxShadow: "0 0 8px rgba(251,146,60,0.7)",
            }}
          />
        ))}
      </div>
      {label && (
        <p className="text-white/70 text-sm font-medium tracking-wide">{label}</p>
      )}
      <style>{`
        @keyframes thinkingBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.7; }
          40%            { transform: translateY(-7px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
