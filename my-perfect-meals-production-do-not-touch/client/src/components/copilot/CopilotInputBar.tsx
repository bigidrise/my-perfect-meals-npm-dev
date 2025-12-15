import { useState, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopilotInputBarProps {
  onSubmit: (query: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

/**
 * CopilotInputBar - Text command input for Copilot
 * 
 * Provides text-based input as fallback/alternative to voice commands.
 * Uses black glass styling to match Copilot UI aesthetic.
 * 
 * Features:
 * - Enter key submission
 * - Auto-focus for voice fallback scenarios
 * - Clear input after submission
 * - Send button icon
 */
export function CopilotInputBar({ 
  onSubmit, 
  placeholder = "Type a command…", 
  autoFocus = false,
  className 
}: CopilotInputBarProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (trimmed) {
      onSubmit(trimmed);
      setQuery(""); // Clear input after submit
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="flex-1 px-4 py-2 rounded-xl bg-black/20 backdrop-blur-md border border-white/20 text-white placeholder:text-white/50 shadow-lg focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-300"
      />
      <button
        onClick={handleSubmit}
        disabled={!query.trim()}
        className="p-2 rounded-xl bg-black/20 backdrop-blur-md border border-white/20 text-white shadow-lg hover:bg-black/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
        aria-label="Send command"
      >
        <Send className="w-5 h-5" />
      </button>
    </div>
  );
}
