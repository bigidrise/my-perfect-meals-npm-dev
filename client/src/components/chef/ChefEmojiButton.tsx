type Props = {
  onClick?: () => void;
};

export default function ChefEmojiButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-full bg-black/70 border-2 border-white/15 backdrop-blur-xl shadow-lg shadow-orange-500/60 hover:shadow-orange-500/100 hover:border-orange-400/100 transition-shadow transition-colors duration-300 select-none touch-manipulation"
      style={{
        width: "72px",
        height: "72px",
        boxShadow: "0 0 15px rgba(251,146,60,0.3), 0 0 25px rgba(251,146,60,0.2)",
      }}
      aria-label="Chef"
    >
      <img
        src="/icons/chef.png"
        alt="Chef"
        className="pointer-events-none"
        style={{ width: "64px", height: "64px" }}
      />
    </button>
  );
}
