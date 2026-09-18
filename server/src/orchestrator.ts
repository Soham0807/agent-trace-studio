import { randomUUID } from "node:crypto";
import { callAgent } from "./agents.js";
import type { PlanStep, TraceEvent } from "./types.js";

const MAX_REVISE_ATTEMPTS = 2;

function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Planner did not return JSON");
  return text.slice(start, end + 1);
}

export async function runAgentTrace(
  goal: string,
  emit: (event: TraceEvent) => void,
): Promise<void> {
  const runId = randomUUID();
  const now = () => Date.now();

  emit({ type: "run_start", runId, goal, timestamp: now() });

  try {
    // --- Planner ---
    emit({ type: "agent_start", runId, agent: "planner", step: 0, attempt: 1, timestamp: now() });
    const planRaw = await callAgent("planner", `Goal: ${goal}`, (chunk) =>
      emit({ type: "agent_message", runId, agent: "planner", step: 0, attempt: 1, content: chunk, timestamp: now() }),
    );
    emit({ type: "agent_end", runId, agent: "planner", step: 0, attempt: 1, timestamp: now() });

    const steps: PlanStep[] = JSON.parse(extractJson(planRaw)).steps;
    emit({ type: "plan_ready", runId, steps, timestamp: now() });

    const completedWork: string[] = [];

    // --- Coder / Critic loop per step ---
    for (const step of steps) {
      let approved = false;
      let attempt = 1;
      let feedback = "";

      while (!approved && attempt <= MAX_REVISE_ATTEMPTS) {
        emit({ type: "agent_start", runId, agent: "coder", step: step.id, attempt, timestamp: now() });
        const coderPrompt = `Step ${step.id}: ${step.title}\n${step.description}\n${
          feedback ? `\nCritic feedback from previous attempt: ${feedback}\nRevise accordingly.` : ""
        }${completedWork.length ? `\n\nContext from prior completed steps:\n${completedWork.join("\n---\n")}` : ""}`;
        const coderOutput = await callAgent("coder", coderPrompt, (chunk) =>
          emit({ type: "agent_message", runId, agent: "coder", step: step.id, attempt, content: chunk, timestamp: now() }),
        );
        emit({ type: "agent_end", runId, agent: "coder", step: step.id, attempt, timestamp: now() });

        emit({ type: "agent_start", runId, agent: "critic", step: step.id, attempt, timestamp: now() });
        const criticPrompt = `Step ${step.id}: ${step.title}\n${step.description}\n\nCoder's output:\n${coderOutput}`;
        const criticOutput = await callAgent("critic", criticPrompt, (chunk) =>
          emit({ type: "agent_message", runId, agent: "critic", step: step.id, attempt, content: chunk, timestamp: now() }),
        );
        emit({ type: "agent_end", runId, agent: "critic", step: step.id, attempt, timestamp: now() });

        approved = criticOutput.trim().toUpperCase().startsWith("APPROVED");
        feedback = criticOutput.replace(/^APPROVED|^REVISE/i, "").trim();

        if (approved) {
          completedWork.push(`Step ${step.id} (${step.title}):\n${coderOutput}`);
        }
        attempt++;
      }

      emit({ type: "step_complete", runId, step: step.id, approved, timestamp: now() });
    }

    emit({
      type: "run_complete",
      runId,
      summary: `Completed ${steps.length} step(s) for goal: "${goal}".`,
      timestamp: now(),
    });
  } catch (err) {
    emit({
      type: "run_error",
      runId,
      message: err instanceof Error ? err.message : String(err),
      timestamp: now(),
    });
  }
}
