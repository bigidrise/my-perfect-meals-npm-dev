export default function ReadOnlyNote({ children }: { children?: React.ReactNode }) {
  return (
    <p className="text-xs text-gray-400/90 mt-2 italic select-none">
      {children}
    </p>
  );
}
