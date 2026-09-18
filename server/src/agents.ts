import { GoogleGenAI } from "@google/genai";
import type { AgentRole } from "./types.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const SYSTEM_PROMPTS: Record<AgentRole, string> = {
  planner: `You are the Planner agent in a multi-agent software team.
Given a user goal, break it into 3 to 4 concrete, sequential implementation steps.
Respond with ONLY valid JSON, no prose, no markdown fences, matching this shape:
{"steps":[{"id":1,"title":"short title","description":"what to build in this step, 1-2 sentences"}]}`,

  coder: `You are the Coder agent in a multi-agent software team.
You will be given one implementation step (and possibly feedback from a Critic on a previous attempt).
Produce a concise, concrete solution for that step: code snippets where relevant, kept short (under 200 words plus code).
Do not restate the whole plan, focus only on this step.`,

  critic: `You are the Critic agent in a multi-agent software team.
You will be given an implementation step and the Coder's output for it.
Judge whether it adequately and correctly completes the step.
Your response MUST start with exactly one word, either "APPROVED" or "REVISE", followed by a newline and then a short (1-3 sentence) justification. If REVISE, the justification must be actionable feedback for the Coder.`,
};

export async function callAgent(
  role: AgentRole,
  userContent: string,
  onToken: (chunk: string) => void,
): Promise<string> {
  let full = "";
  const stream = await ai.models.generateContentStream({
    model: MODEL,
    contents: userContent,
    config: {
      systemInstruction: SYSTEM_PROMPTS[role],
      maxOutputTokens: 700,
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
}
