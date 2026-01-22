type Props = {
  onClick?: () => void;
};

export default function ChefEmojiButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border-2 border-white/15 select-none touch-manipulation overflow-hidden"
      style={{
        width: "56px",
        height: "56px",
        backgroundImage: "url(/icons/chef.png)",
        backgroundSize: "120%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "black",
      }}
      aria-label="Chef"
    />
  );
}
