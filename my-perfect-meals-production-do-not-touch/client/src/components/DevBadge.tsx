export default function DevBadge() {
  if (import.meta.env.MODE !== "development") return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "8px",
        right: "8px",
        zIndex: 9999,
        background: "#dc2626",
        color: "white",
        padding: "6px 10px",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: 700,
        letterSpacing: "0.05em",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      DEV
    </div>
  );
}
