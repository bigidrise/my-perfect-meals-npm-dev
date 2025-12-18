
import { ReactNode } from "react";

interface SafePageContainerProps {
  children: ReactNode;
  hasShoppingBanner?: boolean;
  className?: string;
}

/**
 * SafePageContainer - Ensures page content is never blocked by bottom navigation or shopping banner
 * Uses iOS-safe scrolling and proper safe-area insets for viewport stability
 * 
 * @param hasShoppingBanner - Set to true if the page displays ShoppingAggregateBar
 * @param className - Additional Tailwind classes
 */
export default function SafePageContainer({ 
  children, 
  hasShoppingBanner = false, 
  className = "" 
}: SafePageContainerProps) {
  const paddingClass = hasShoppingBanner ? "pb-safe-both" : "pb-safe-nav";
  
  return (
    <div className={`min-h-full flex flex-col ${paddingClass} pt-safe-top ${className}`}>
      {children}
    </div>
  );
}
