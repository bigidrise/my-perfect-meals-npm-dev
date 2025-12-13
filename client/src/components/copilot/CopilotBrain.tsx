import React, { Component, ReactNode } from "react";
import { useCopilotBrain, CopilotBrainProps } from "./useCopilotBrain";

class CopilotBrainErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("❌ CopilotBrain Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

const CopilotBrainInner: React.FC<CopilotBrainProps> = (props) => {
  useCopilotBrain(props);
  return null;
};

export const CopilotBrain: React.FC<CopilotBrainProps> = (props) => {
  return (
    <CopilotBrainErrorBoundary>
      <CopilotBrainInner {...props} />
    </CopilotBrainErrorBoundary>
  );
};
