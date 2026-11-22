type Props = {
  onClick: () => void;
  label: string;
  size?: number;
  horizontal?: boolean;
};

/** Feature navigation uses the dashboard microphone artwork, not a reply avatar. */
export default function AskChefNavButton({ onClick, label, size = 48, horizontal = false }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`group flex min-h-11 min-w-11 items-center justify-center select-none touch-manipulation ${
        horizontal ? "w-full gap-2 pb-3" : "flex-col gap-0.5"
      }`}
    >
      <img
        src="/assets/ask-chef-desk-160.webp"
        srcSet="/assets/ask-chef-desk-160.webp 160w, /assets/ask-chef-desk-240.webp 240w, /assets/ask-chef-desk.webp 500w"
        sizes={`${size}px`}
        width={size}
        height={size}
        alt=""
        className="shrink-0 rounded-xl border border-orange-300/30 bg-black object-cover"
      />
      <span className={`${horizontal ? "text-sm" : "text-[10px] leading-3"} font-medium text-white/70 group-hover:text-orange-400 transition-colors`}>
        {label}
      </span>
    </button>
  );
}
