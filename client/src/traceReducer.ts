import type { TraceEvent, TraceState } from "./types";

export const initialTraceState: TraceState = {
  runId: null,
  goal: "",
  status: "idle",
  plannerText: "",
  activeAgent: null,
  activeStep: null,
  steps: [],
  stepStates: {},
  summary: null,
  error: null,
};

function ensureStep(state: TraceState, stepId: number, attempt: number) {
  const existing = state.stepStates[stepId];
  const planStep = state.steps.find((s) => s.id === stepId) ?? {
    id: stepId,
    title: `Step ${stepId}`,
    description: "",
  };
  const stepState = existing ?? { step: planStep, attempts: [] };
  let attemptState = stepState.attempts.find((a) => a.attempt === attempt);
  if (!attemptState) {
    attemptState = { attempt, coderText: "", criticText: "", approved: null };
    stepState.attempts = [...stepState.attempts, attemptState];
  }
  return { stepState, attemptState };
}

export function traceReducer(state: TraceState, event: TraceEvent): TraceState {
  switch (event.type) {
    case "run_start":
      return {
        ...initialTraceState,
        runId: event.runId,
        goal: event.goal,
        status: "planning",
      };

    case "plan_ready":
      return { ...state, steps: event.steps };

    case "agent_start": {
      const next = { ...state, activeAgent: event.agent, activeStep: event.step, status: "running" as const };
      if (event.step === 0) return next;
      const { stepState, attemptState } = ensureStep(next, event.step, event.attempt);
      attemptState.coderText = attemptState.coderText; // no-op, placeholder for clarity
      return {
        ...next,
        stepStates: { ...next.stepStates, [event.step]: { ...stepState } },
      };
    }

    case "agent_message": {
      if (event.step === 0) {
        return { ...state, plannerText: state.plannerText + event.content };
      }
      const { stepState, attemptState } = ensureStep(state, event.step, event.attempt);
      if (event.agent === "coder") attemptState.coderText += event.content;
      if (event.agent === "critic") attemptState.criticText += event.content;
      return {
        ...state,
        stepStates: {
          ...state.stepStates,
          [event.step]: { ...stepState, attempts: [...stepState.attempts] },
        },
      };
    }

    case "agent_end":
      return { ...state, activeAgent: null };

    case "step_complete": {
      const { stepState, attemptState } = ensureStep(state, event.step, 0);
      const lastAttempt = stepState.attempts[stepState.attempts.length - 1] ?? attemptState;
      lastAttempt.approved = event.approved;
      return {
        ...state,
        stepStates: {
          ...state.stepStates,
          [event.step]: { ...stepState, attempts: [...stepState.attempts] },
        },
      };
    }

    case "run_complete":
      return { ...state, status: "complete", summary: event.summary, activeAgent: null };

    case "run_error":
      return { ...state, status: "error", error: event.message, activeAgent: null };

    default:
      return state;
  }
}
