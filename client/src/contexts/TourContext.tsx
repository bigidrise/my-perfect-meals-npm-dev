import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const DISABLE_ALL_TOURS = true;

interface TourStep {
  id: string;
  target: string;
  message: string;
  route?: string;
}

interface TourContextType {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  startTour: (steps: TourStep[]) => void;
  nextStep: () => void;
  completeTour: () => void;
  skipTour: () => void;
  getCurrentStepTarget: () => string | null;
  getCurrentStepMessage: () => string | null;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<TourStep[]>([]);

  useEffect(() => {
    if (DISABLE_ALL_TOURS) return;
    
    const coachMode = localStorage.getItem("coachMode");
    const tourCompleted = localStorage.getItem("tourCompleted");
    
    if (coachMode === "guided" && !tourCompleted) {
      setIsActive(true);
    }
  }, []);

  const startTour = (newSteps: TourStep[]) => {
    if (DISABLE_ALL_TOURS) return;
    setSteps(newSteps);
    setCurrentStep(0);
    setIsActive(true);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      completeTour();
    }
  };

  const completeTour = () => {
    setIsActive(false);
    setCurrentStep(0);
    setSteps([]);
    localStorage.setItem("tourCompleted", "true");
  };

  const skipTour = () => {
    completeTour();
  };

  const getCurrentStepTarget = () => {
    if (!isActive || currentStep >= steps.length) return null;
    return steps[currentStep]?.target || null;
  };

  const getCurrentStepMessage = () => {
    if (!isActive || currentStep >= steps.length) return null;
    return steps[currentStep]?.message || null;
  };

  return (
    <TourContext.Provider
      value={{
        isActive,
        currentStep,
        steps,
        startTour,
        nextStep,
        completeTour,
        skipTour,
        getCurrentStepTarget,
        getCurrentStepMessage
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within TourProvider");
  }
  return context;
}
