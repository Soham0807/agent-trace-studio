# Agent Trace Studio

A live visualizer for a multi-agent LLM workflow. You type a goal; a **Planner**
agent breaks it into steps, a **Coder** agent implements each step, and a
**Critic** agent reviews the Coder's work and either approves it or sends it
back for revision. Every message, tool transition, and verdict streams to the
browser over a WebSocket and renders as an animated agent graph + timeline —
effectively a flight recorder for an AI agent team.

## Why this project

- Demonstrates real multi-agent orchestration (not a single-prompt wrapper):
  role separation, structured hand-offs, a revise-and-retry loop.
- Full-stack: Express + WebSocket streaming backend, React + TS frontend,
  typed event protocol shared conceptually across both.
- The orchestration pattern here (`server/src/orchestrator.ts`) is a minimal,
  readable reference for the exact mechanics behind "AI agents building
  software overnight" — see the section below.

## Run it

You need a free Gemini API key: https://aistudio.google.com/apikey (no card
required, generous free daily quota).

```bash
# from the repo root
npm install                     # installs root (concurrently)
npm --prefix server install     # already done if you followed setup
npm --prefix client install     # already done if you followed setup

# put your real key in server/.env
#   GEMINI_API_KEY=...

npm run dev
```

- Client: http://localhost:5173
- Server: http://localhost:8787 (health check at `/health`)

Type a goal (e.g. "Build a rate limiter middleware for an Express API") and
hit **Run agents**. Watch the graph light up as Planner → Coder → Critic pass
control back and forth, and the timeline fill in with each agent's streamed
output.

## Architecture

```
client/  React + TS (Vite)
  useTraceSocket.ts   WebSocket client + REST trigger, feeds a reducer
  traceReducer.ts     Turns a stream of TraceEvents into UI state
  AgentGraph.tsx       SVG node graph, pulses the currently active agent
  Timeline.tsx          Swimlane feed of planner/coder/critic messages

server/  Express + ws + TS
  agents.ts            System prompts per role + Gemini streaming call
  orchestrator.ts       The actual agent loop (see below)
  index.ts              HTTP trigger (POST /api/runs) + WebSocket broadcast
```

Every step emits typed events (`run_start`, `plan_ready`, `agent_start`,
`agent_message` (streamed tokens), `agent_end`, `step_complete`,
`run_complete` / `run_error`) that the frontend reduces into view state. This
event-sourced trace is the same idea production agent-observability tools
(LangSmith, Braintrust, etc.) are built around — you're building a tiny one.

## The orchestration loop, in words

1. **Planner** gets the goal, returns a JSON plan of 3-4 steps.
2. For each step:
   - **Coder** gets the step + any prior approved work as context, produces a
     solution.
   - **Critic** gets the step + Coder's output, returns `APPROVED` or
     `REVISE` + feedback.
   - If `REVISE`, feedback is fed back into the Coder prompt and it retries
     (capped at 2 attempts, so a bad loop can't run forever).
3. Once all steps are done, emit a summary.

That retry cap, the explicit role/system-prompt separation, and the
structured hand-off format (JSON plan, `APPROVED`/`REVISE` parsing) are the
three things that make this reliable instead of a chatty mess — see below for
why they generalize.

---

## Learning track: using AI agents to build projects overnight

You said you want to learn to run agents unattended while you sleep. The
short version: **an "overnight agent" is this same loop, just pointed at a
real codebase with real tools (shell, file edit, test runner) instead of
plain text, plus a way to check its work without you watching.** Everything
below builds on what you just shipped.

### 1. The core pattern (you just built it)

Role separation + structured hand-offs + a bounded retry loop is the whole
trick. Production versions differ from your Coder/Critic loop mainly by:

- **Real tools instead of text.** The Coder agent gets function-calling tools
  like `read_file`, `write_file`, `run_shell`, `run_tests` instead of just
  returning prose. This is exactly what Claude Code / the Claude Agent SDK
  gives you already.
- **A verifiable Critic.** Instead of an LLM grading another LLM's prose
  (weak signal), the Critic step *runs the test suite / linter / build* and
  only calls it "approved" if those pass. LLM-as-critic is fine for judgment
  calls (code quality, naming) but should never be the only gate for
  correctness — tests are.
- **A hard stop condition.** Max retries, max wall-clock time, max cost. Your
  `MAX_REVISE_ATTEMPTS = 2` is that same idea. Overnight runs need this or a
  stuck loop burns your API budget while you sleep.

### 2. How to actually run something overnight

- **Claude Agent SDK** (Python/TS) — build a custom headless agent loop with
  your own tool set, run it as a long-lived process or a scheduled job.
  Best when you want a bespoke pipeline like the one you just built, scaled
  up with real file/shell tools.
- **Claude Code in headless/non-interactive mode** (`claude -p "<task>"` or
  scripted via the SDK) — point it at a repo with a clear task and a
  `CLAUDE.md` describing conventions, let it run in a loop or via a cron
  job. This repo's `schedule`/`loop` skills are literally this.
- **Guardrails that matter for unattended runs:**
  - Work in a git worktree or branch per run, never `main` — you review and
    merge in the morning, the agent never pushes directly.
  - Require tests to pass before a change is considered "done" — don't trust
    the agent's self-report.
  - Cap tokens/cost and wall-clock time per run explicitly.
  - Log everything (this is what your Agent Trace Studio pattern is for) so
    you can audit *why* it made a decision, not just *what* it produced.

### 3. Project ideas that are good overnight-agent exercises

- **Test-coverage filler bot**: point an agent at a repo, have it find
  untested functions (via coverage report), write tests, run them, keep only
  the ones that pass and catch real bugs. Low-risk (only adds tests), clear
  success metric (coverage delta), great first overnight project.
- **Dependency upgrade agent**: given a repo with outdated deps, agent
  upgrades one at a time, runs the test suite after each, reverts on
  failure, produces a PR per successful upgrade with a changelog summary.
- **Bug-to-PR pipeline**: feed it a GitHub issue, agent reproduces the bug
  (writes a failing test first), fixes it, confirms the test now passes,
  opens a draft PR. This is the current frontier pattern (SWE-bench-style
  agents) and is very resume-relevant.
- **Multi-repo doc sync**: agent watches a "source of truth" repo, and
  overnight, regenerates docs/READMEs in dependent repos to match, opening
  PRs for review. Good exercise in multi-step planning + tool use with low
  blast radius.
- **Extend Agent Trace Studio itself**: swap the Coder agent's plain-text
  output for real tool calls (file write + shell exec in a sandboxed temp
  dir) against a toy repo, and watch the exact same graph/timeline UI you
  built now visualize a *real* coding agent instead of a text-only one. This
  is the natural "version 2" of tonight's project and ties both of your
  goals into one codebase.

### 4. What separates a toy agent loop from a trustworthy overnight one

1. Verification is mechanical (tests/build/lint), not another LLM's opinion,
   wherever possible.
2. Every run is isolated (branch/worktree/sandbox) and diffable.
3. There's a hard budget: cost, time, and retry count.
4. Every decision is logged in a structured, replayable trace — exactly the
   event stream you just built the UI for.
