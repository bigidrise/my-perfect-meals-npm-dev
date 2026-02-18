type Props = {
  onClick?: () => void;
  size?: number;          // optional
  version?: string;       // optional cache buster
};

export default function ChefEmojiButton({ onClick, size = 64, version = "2026c" }: Props) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-full border-2 border-white/15 select-none touch-manipulation overflow-hidden bg-transparent"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(/icons/chef.png?v=${version})`,
        backgroundSize: "130%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
      aria-label="Chef"
    />
  );
}