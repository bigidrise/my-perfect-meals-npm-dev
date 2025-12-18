import { Button } from "@/components/ui/button";
import { ArrowUp, Navigation } from "lucide-react";
import { useEffect, useState } from "react";

interface ScrollNavigationProps {
  sections?: { id: string; label: string }[];
}

export default function ScrollNavigation({ sections }: ScrollNavigationProps) {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");

  const defaultSections = [
    { id: "progress-overview", label: "Progress" },
    { id: "nutrition-tracker", label: "Nutrition" },
    { id: "meal-planning-hub", label: "Meals" },
    { id: "weekly-overview", label: "Calendar" }
  ];

  const navigationSections = sections || defaultSections;

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);

      // Determine active section
      const sectionElements = navigationSections.map(section => ({
        id: section.id,
        element: document.getElementById(section.id),
        label: section.label
      }));

      for (let i = sectionElements.length - 1; i >= 0; i--) {
        const element = sectionElements[i].element;
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 100) {
            setActiveSection(sectionElements[i].id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [navigationSections]);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-40 space-y-2">
      {/* Section Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 border">
        <div className="flex flex-col space-y-1">
          <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400">
            <Navigation className="w-3 h-3" />
            Jump to
          </div>
          {navigationSections.map((section) => (
            <Button
              key={section.id}
              variant={activeSection === section.id ? "default" : "ghost"}
              size="sm"
              onClick={() => scrollToSection(section.id)}
              className="text-xs h-8 justify-start"
            >
              {section.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Scroll to Top */}
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          size="sm"
          className="rounded-full w-10 h-10 shadow-lg"
        >
          <ArrowUp className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
