import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { isCalculatorCopilotPaused } from "./calculatorCopilotPause";
import { CopilotProvider, CopilotAction, useCopilot } from "./CopilotContext";
import { CopilotButton } from "./CopilotButton";
import { CopilotSheet } from "./CopilotSheet";
import { executeCommand, setResponseHandler } from "./CopilotCommandRegistry";
import { CopilotGuidedModeProvider } from "./CopilotGuidedModeContext";
import { useCopilotPageExplanation } from "./useCopilotPageExplanation";

interface CopilotSystemProps {
  children: React.ReactNode;
  onAction?: (action: CopilotAction) => void | Promise<void>;
}

const CopilotSystemInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setLastResponse } = useCopilot();
  const [pathname] = useLocation();

  useEffect(() => {
    setResponseHandler((response) => {
      console.log("📖 Setting knowledge response:", response?.title);
      setLastResponse(response);
    });
  }, [setLastResponse]);

  return (
    <>
      {children}
      {!isCalculatorCopilotPaused(pathname) && <ActiveCopilotChrome />}
    </>
  );
};

function ActiveCopilotChrome() {
  useCopilotPageExplanation();
  return <CopilotSheet />;
}

export const CopilotSystem: React.FC<CopilotSystemProps> = ({ 
  children,
  onAction: customOnAction,
}) => {
  const handleAction = async (action: CopilotAction) => {
    await executeCommand(action);
    
    if (customOnAction) {
      await customOnAction(action);
    }
  };

  return (
    <CopilotGuidedModeProvider>
      <CopilotProvider onAction={handleAction}>
        <CopilotSystemInner>
          {children}
        </CopilotSystemInner>
      </CopilotProvider>
    </CopilotGuidedModeProvider>
  );
};
