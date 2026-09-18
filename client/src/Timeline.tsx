import type { TraceState } from "./types";

function AttemptCard({ stepId, attempt }: { stepId: number; attempt: { attempt: number; coderText: string; criticText: string; approved: boolean | null } }) {
  return (
    <div className="attempt-card">
      <div className="attempt-header">
        Step {stepId} · Attempt {attempt.attempt}
        {attempt.approved === true && <span className="badge approved">approved</span>}
        {attempt.approved === false && <span className="badge revise">revise</span>}
      </div>
      {attempt.coderText && (
        <div className="message coder">
          <div className="message-role">Coder</div>
          <pre>{attempt.coderText}</pre>
        </div>
      )}
      {attempt.criticText && (
        <div className="message critic">
          <div className="message-role">Critic</div>
          <pre>{attempt.criticText}</pre>
        </div>
      )}
    </div>
  );
}

export function Timeline({ state }: { state: TraceState }) {
  return (
    <div className="timeline">
      {state.plannerText && (
        <div className="message planner">
          <div className="message-role">Planner</div>
          <pre>{state.plannerText}</pre>
        </div>
      )}

      {state.steps.map((step) => {
        const stepState = state.stepStates[step.id];
        return (
          <div key={step.id} className="step-block">
            <div className="step-title">
              #{step.id} {step.title}
            </div>
            <div className="step-description">{step.description}</div>
            {stepState?.attempts.map((a) => (
              <AttemptCard key={a.attempt} stepId={step.id} attempt={a} />
            ))}
          </div>
        );
      })}

      {state.summary && <div className="summary">{state.summary}</div>}
      {state.error && <div className="error">{state.error}</div>}
    </div>
  );
}
