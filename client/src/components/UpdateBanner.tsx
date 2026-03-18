interface UpdateBannerProps {
  show: boolean;
}

export function UpdateBanner({ show }: UpdateBannerProps) {
  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-0 right-0 z-[9999] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 bg-black/90 border border-orange-500/50 backdrop-blur-lg rounded-full px-5 py-3 shadow-lg shadow-orange-500/20">
        <span className="text-sm text-white/90">Update available</span>
        <button
          onClick={() => window.location.reload()}
          className="text-sm font-semibold text-orange-400 active:scale-[0.98] transition-transform"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
