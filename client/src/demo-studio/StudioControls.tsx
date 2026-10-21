import React from "react";

export type DemoWorkflow = "onboarding" | "macro" | "dashboard";

type StudioControlsProps = {
  workflow: DemoWorkflow | null;
  name: string;
  calories: number;
  onNavigate: (workflow: DemoWorkflow) => void;
  onStartFresh: (workflow: DemoWorkflow) => void;
  onResetCurrent: () => void;
  onResetAll: () => void;
  onReturn: () => void;
  blockedRequests: string[];
  children?: React.ReactNode;
  onEnter?: () => void;
  onResetDemo?: () => void;
  currentPage?: string;
};

const workflows: { id: DemoWorkflow; title: string; detail: string }[] = [
  {
    id: "onboarding",
    title: "Onboarding",
    detail: "The first steps of a new member experience",
  },
  {
    id: "macro",
    title: "Macro calculator",
    detail: "Personal targets and nutrition planning",
  },
  {
    id: "dashboard",
    title: "Member dashboard",
    detail: "A returning member’s daily overview",
  },
];

const workflowTitle = (id: DemoWorkflow) =>
  workflows.find((item) => item.id === id)?.title ?? id;

export default function StudioControls({
  workflow,
  name,
  calories,
  onNavigate,
  onStartFresh,
  onResetCurrent,
  onResetAll,
  onReturn,
  blockedRequests,
  children,
  onEnter, onResetDemo, currentPage,
}: StudioControlsProps) {
  return (
    <div className={`demo-studio${workflow ? " ds-session" : ""}`}>
      <style>{`
        .demo-studio {
          --ds-ink: #171613;
          --ds-panel: #211f1b;
          --ds-panel-raised: #292620;
          --ds-line: rgba(246, 239, 222, .14);
          --ds-text: #f4efe4;
          --ds-muted: #b5ad9d;
          --ds-amber: #d99a3d;
          --ds-amber-pale: #f1c77f;
          color: var(--ds-text);
          background: var(--ds-ink);
          border: 1px solid rgba(217, 154, 61, .34);
          border-radius: 14px;
          box-shadow: 0 12px 34px rgba(20, 16, 9, .18);
          font-family: inherit;
          margin: 0 0 1rem;
          overflow: hidden;
        }
        .demo-studio *, .demo-studio *::before, .demo-studio *::after { box-sizing: border-box; }
        .ds-topbar {
          position: sticky;
          top: 0;
          z-index: 100;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 13px 18px;
          border-bottom: 1px solid var(--ds-line);
          background: linear-gradient(100deg, #201e19 0%, #28241d 100%);
        }
        .ds-brand { display: flex; align-items: center; gap: 11px; min-width: 0; }
        .ds-mark {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border: 1px solid rgba(217, 154, 61, .65);
          border-radius: 8px;
          color: var(--ds-amber-pale);
          font-size: 13px;
          font-weight: 800;
          letter-spacing: -.06em;
          flex: 0 0 auto;
        }
        .ds-brand-copy { display: grid; gap: 2px; }
        .ds-eyebrow {
          color: var(--ds-amber-pale);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .16em;
          line-height: 1.2;
          text-transform: uppercase;
        }
        .ds-title { color: var(--ds-text); font-size: 13px; font-weight: 700; line-height: 1.2; }
        .ds-mode {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 9px;
          border: 1px solid rgba(217, 154, 61, .38);
          border-radius: 999px;
          background: rgba(217, 154, 61, .11);
          color: var(--ds-amber-pale);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .09em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .ds-mode-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ds-amber); }
        .ds-body { padding: 16px 18px 18px; }
        .ds-safety {
          margin: 0 0 16px;
          color: var(--ds-muted);
          font-size: 12px;
          line-height: 1.55;
        }
        .ds-safety strong { color: #e8dfcf; font-weight: 650; }
        .ds-section-label {
          margin: 16px 0 12px;
          color: var(--ds-text);
          font-size: 18px;
          font-weight: 700;
          line-height: 1.3;
        }
        .ds-workflows { display: grid; gap: 8px; margin-bottom: 12px; }
        .ds-workflow {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 12px 13px;
          border: 1px solid var(--ds-line);
          border-radius: 10px;
          background: rgba(255, 255, 255, .025);
        }
        .ds-workflow.ds-active {
          border-color: rgba(217, 154, 61, .48);
          background: rgba(217, 154, 61, .075);
        }
        .ds-workflow-copy { min-width: 0; }
        .ds-workflow-title { margin: 0; color: var(--ds-text); font-size: 13px; font-weight: 700; }
        .ds-workflow-detail { margin: 4px 0 0; color: var(--ds-muted); font-size: 11px; line-height: 1.4; }
        .ds-workflow-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 7px; flex: 0 0 auto; }
        .ds-button {
          display: inline-flex;
          min-height: 34px;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 7px 10px;
          border: 1px solid rgba(246, 239, 222, .2);
          border-radius: 7px;
          background: rgba(255, 255, 255, .045);
          color: var(--ds-text);
          cursor: pointer;
          font: inherit;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.2;
          transition: background .16s ease, border-color .16s ease, transform .16s ease;
        }
        .ds-button:hover { border-color: rgba(246, 239, 222, .42); background: rgba(255, 255, 255, .09); }
        .ds-button:active { transform: translateY(1px); }
        .ds-button:focus-visible, .demo-studio details summary:focus-visible {
          outline: 2px solid var(--ds-amber-pale);
          outline-offset: 3px;
        }
        .ds-button-primary {
          border-color: var(--ds-amber);
          background: var(--ds-amber);
          color: #21190e;
        }
        .ds-button-primary:hover { border-color: #e7ad56; background: #e7ad56; }
        .ds-button-quiet { color: #d4cbbb; }
        .ds-divider { height: 1px; margin: 16px 0 13px; background: var(--ds-line); }
        .ds-selected {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 13px;
        }
        .ds-selected-title { margin: 0; font-size: 17px; font-weight: 700; letter-spacing: -.02em; }
        .ds-selected-meta { margin: 4px 0 0; color: var(--ds-muted); font-size: 11px; }
        .ds-selected-meta strong { color: #e9dfcf; font-weight: 650; }
        .ds-current-controls { display: flex; flex-wrap: wrap; gap: 7px; }
        .ds-return { margin-left: auto; }
        .ds-blocked {
          margin-top: 12px;
          border-top: 1px solid var(--ds-line);
          padding-top: 11px;
        }
        .ds-blocked summary { width: fit-content; color: #c7bdad; cursor: pointer; font-size: 11px; }
        .ds-blocked-count { margin-left: 4px; color: var(--ds-amber-pale); }
        .ds-blocked ul { margin: 9px 0 0; padding-left: 17px; color: var(--ds-muted); font-size: 11px; line-height: 1.6; }
        .ds-stage { color: inherit; }
        .ds-session-body {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px 12px;
          padding: 8px 12px;
          flex: 0 0 auto;
          border-bottom: 1px solid var(--ds-line);
        }
        .ds-session-brand { display: grid; gap: 3px; }
        .ds-session-title { margin: 0; color: var(--ds-muted); font-size: 11px; font-weight: 600; }
        .ds-session-body .ds-workflow-actions { justify-content: flex-start; gap: 6px; }
        .ds-session-body .ds-button { min-height: 32px; padding: 6px 8px; }
        .ds-session-body .ds-blocked { flex-basis: 100%; margin-top: 0; }
        @media (max-width: 620px) {
          .ds-topbar { padding: 12px 13px; }
          .ds-body { padding: 14px 13px 15px; }
          .ds-workflow { align-items: flex-start; flex-direction: column; }
          .ds-workflow-actions { width: 100%; justify-content: flex-start; }
          .ds-selected { align-items: flex-start; flex-direction: column; gap: 9px; }
          .ds-current-controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .ds-current-controls .ds-return { margin-left: 0; }
          .ds-current-controls .ds-button { width: 100%; }
        }
      `}</style>

      {!workflow && <header className="ds-topbar">
        <div className="ds-brand">
          <span className="ds-mark" aria-hidden="true">MP</span>
          <div className="ds-brand-copy">
            <span className="ds-eyebrow">Development only</span>
            <span className="ds-title">My Perfect Meals · Demo Studio</span>
          </div>
        </div>
      </header>}

      <div className={workflow ? "ds-body ds-session-body" : "ds-body"}>
        {!workflow ? (
          <>
            <p className="ds-safety">
              Walk through the real customer experience with <strong>synthetic demo data</strong>.
              Changes stay in this demo runtime; no customer records or production data are used.
            </p>
            {onEnter && <button className="ds-button ds-button-primary" type="button"
              onClick={onEnter}>Enter Demo Mode</button>}
            <h1 className="ds-section-label">Choose a demo walkthrough</h1>
            <div className="ds-workflows">
              {workflows.map((item) => (
                <section className="ds-workflow" key={item.id} aria-labelledby={`ds-${item.id}-title`}>
                  <div className="ds-workflow-copy">
                    <h2 className="ds-workflow-title" id={`ds-${item.id}-title`}>{item.title}</h2>
                    <p className="ds-workflow-detail">{item.detail}</p>
                  </div>
                  <div className="ds-workflow-actions">
                    <button className="ds-button ds-button-quiet" type="button" onClick={() => onNavigate(item.id)}>
                      Continue demo
                    </button>
                    <button className="ds-button ds-button-primary" type="button" onClick={() => onStartFresh(item.id)}>
                      Start Fresh
                    </button>
                  </div>
                </section>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="ds-session-brand" title={`Synthetic profile: ${name} · ${calories.toLocaleString()} kcal target`}>
              <span className="ds-mode" aria-label="Demo Mode is active — synthetic data">
                <span className="ds-mode-dot" aria-hidden="true" />
                Demo · Synthetic
              </span>
              <h1 className="ds-session-title">{currentPage ?? workflowTitle(workflow)}</h1>
            </div>
            <nav aria-label="Demo workflow navigation">
              <div className="ds-workflow-actions">
                {workflows.map((item) => (
                  <button
                    aria-current={workflow === item.id ? "page" : undefined}
                    className={`ds-button${workflow === item.id ? " ds-button-primary" : ""}`}
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    type="button"
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </nav>
            <div className="ds-workflow-actions" aria-label="Demo controls">
              <button className="ds-button" type="button" onClick={onResetCurrent}>Reset Current Demo</button>
              <button className="ds-button" type="button" onClick={onResetAll}>Reset All Demo Data</button>
              {onResetDemo && <button className="ds-button" type="button" onClick={onResetDemo}>Reset Demo</button>}
              <button className="ds-button ds-button-quiet ds-return" type="button" onClick={onReturn}>
                Return to Demo Studio
              </button>
            </div>
          </>
        )}
        {blockedRequests.length > 0 && (
          <aside className="ds-blocked" role="alert" aria-label="Unsupported demo action">
            <p>This action is not connected in Demo Mode Group 1. It was blocked; no live fallback was used.</p>
            <details>
              <summary>Unsupported actions blocked ({blockedRequests.length})</summary>
              <ul>{blockedRequests.map((request, index) =>
                <li key={`${request}-${index}`}>{request}</li>)}</ul>
            </details>
          </aside>
        )}
      </div>
      {workflow && children != null && <div className="ds-stage" data-workflow={workflow}>{children}</div>}
    </div>
  );
}
