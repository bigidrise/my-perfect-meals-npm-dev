interface LabValueSupportCardProps {
  className?: string;
}

export default function LabValueSupportCard({ className = "" }: LabValueSupportCardProps) {
  return (
    <div className={`p-4 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-lg text-white ${className}`}>
      <h3 className="text-lg font-semibold mb-2">🩺 Lab Value Support</h3>
      <p className="text-sm opacity-90 mb-3">
        Custom meals based on your cholesterol, A1C, and more. Get personalized nutrition recommendations based on your lab results.
      </p>
      <div className="text-xs bg-white/20 px-2 py-1 rounded">
        Coming Soon
      </div>
    </div>
  );
}