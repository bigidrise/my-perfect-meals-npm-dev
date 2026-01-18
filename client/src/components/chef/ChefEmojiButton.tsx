type Props = {
  onClick?: () => void;
};

export default function ChefEmojiButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border-2 border-white/15 backdrop-blur-xl shadow-lg shadow-orange-500/60 hover:shadow-orange-500/100 hover:border-orange-400/100 transition-shadow transition-colors duration-300 select-none touch-manipulation overflow-hidden"
      style={{
        width: "56px",
        height: "56px",
        boxShadow: "0 0 15px rgba(251,146,60,0.3), 0 0 25px rgba(251,146,60,0.2)",
        backgroundImage: "url(/icons/chef.png)",
        backgroundSize: "120%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "rgba(0,0,0,0.7)",
      }}
      aria-label="Chef"
    />
  );
}
