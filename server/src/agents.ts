import { ApiError, GoogleGenAI } from "@google/genai";
import type { AgentRole } from "./types.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const SYSTEM_PROMPTS: Record<AgentRole, string> = {
  planner: `You are the Planner agent in a multi-agent software team.
Given a user goal, break it into exactly 3 concrete, sequential implementation steps.
Keep each "title" under 6 words and each "description" under 15 words (one short sentence, no sub-lists).
Respond with ONLY strictly valid, complete JSON, no prose, no markdown fences, matching this shape:
{"steps":[{"id":1,"title":"short title","description":"one short sentence"}]}
The response must be short enough to never be cut off. Do not add anything after the closing brace.`,

  coder: `You are the Coder agent in a multi-agent software team.
You will be given one implementation step (and possibly feedback from a Critic on a previous attempt).
Produce a concise, concrete solution for that step: code snippets where relevant, kept short (under 150 words plus code).
Do not restate the whole plan, focus only on this step.`,

  critic: `You are the Critic agent in a multi-agent software team.
You will be given an implementation step and the Coder's output for it.
Judge whether it adequately and correctly completes the step.
Your response MUST start with exactly one word, either "APPROVED" or "REVISE", followed by a newline and then a short (1-3 sentence) justification. If REVISE, the justification must be actionable feedback for the Coder.`,
};

const MAX_OUTPUT_TOKENS: Record<AgentRole, number> = {
  planner: 1024,
  coder: 600,
  critic: 300,
};

const MAX_RETRIES = 3;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function callAgent(
  role: AgentRole,
  userContent: string,
  onToken: (chunk: string) => void,
): Promise<string> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      let full = "";
      const stream = await ai.models.generateContentStream({
        model: MODEL,
        contents: userContent,
        config: {
          systemInstruction: SYSTEM_PROMPTS[role],
          maxOutputTokens: MAX_OUTPUT_TOKENS[role],
        },
      });

      for await (const chunk of stream) {
        const text = chunk.text ?? "";
        if (text) {
          full += text;
          onToken(text);
        }
      }

      return full;
    } catch (err) {
      const isRateLimited = err instanceof ApiError && err.status === 429;
      if (!isRateLimited) throw err;
      // A per-day quota exhausted mid-run won't recover no matter how long we wait; fail fast
      // with a clear message instead of burning retries. A per-minute cap is worth backing off for.
      const message = err instanceof Error ? err.message : "";
      if (/PerDay/i.test(message)) {
        throw new Error(
          "Gemini free-tier daily quota exhausted for this model. Try again tomorrow, or set GEMINI_MODEL to a model with more daily headroom.",
        );
      }
      if (attempt === MAX_RETRIES) throw err;
      await sleep(2 ** attempt * 5000);
    }
  }
  throw new Error("unreachable");
}
