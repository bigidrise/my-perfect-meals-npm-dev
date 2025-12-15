interface PageTransitionProps {
  children: React.ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  return (
    <div className="animate-in slide-in-from-right-4 duration-300">
      {children}
    </div>
  );
}