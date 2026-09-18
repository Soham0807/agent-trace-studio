export type AgentRole = "planner" | "coder" | "critic";

export interface PlanStep {
  id: number;
  title: string;
  description: string;
}

export type TraceEvent =
  | { type: "run_start"; runId: string; goal: string; timestamp: number }
  | {
      type: "plan_ready";
      runId: string;
      steps: PlanStep[];
      timestamp: number;
    }
  | {
      type: "agent_start";
      runId: string;
      agent: AgentRole;
      step: number;
      attempt: number;
      timestamp: number;
    }
  | {
      type: "agent_message";
      runId: string;
      agent: AgentRole;
      step: number;
      attempt: number;
      content: string;
      timestamp: number;
    }
  | {
      type: "agent_end";
      runId: string;
      agent: AgentRole;
      step: number;
      attempt: number;
      timestamp: number;
    }
  | {
      type: "step_complete";
      runId: string;
      step: number;
      approved: boolean;
      timestamp: number;
    }
  | { type: "run_complete"; runId: string; summary: string; timestamp: number }
  | { type: "run_error"; runId: string; message: string; timestamp: number };
