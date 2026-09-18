import "./App.css";
import { AgentGraph } from "./AgentGraph";
import { GoalForm } from "./GoalForm";
import { Timeline } from "./Timeline";
import { useTraceSocket } from "./useTraceSocket";

function App() {
  const { state, connected, startRun } = useTraceSocket();
  const isRunning = state.status === "planning" || state.status === "running";

  return (
    <div className="app">
      <header className="app-header">
        <h1>Agent Trace Studio</h1>
        <p className="subtitle">
          Watch a Planner, Coder, and Critic agent collaborate on a goal in real time.
        </p>
        <span className={connected ? "conn-badge ok" : "conn-badge down"}>
          {connected ? "connected" : "disconnected"}
        </span>
      </header>

      <GoalForm disabled={isRunning} onSubmit={startRun} />

      <main className="main-grid">
        <section className="graph-panel">
          <AgentGraph activeAgent={state.activeAgent} />
          <div className="status-line">
            Status: <strong>{state.status}</strong>
            {state.goal && <div className="goal-echo">Goal: {state.goal}</div>}
          </div>
        </section>

        <section className="timeline-panel">
          <Timeline state={state} />
        </section>
      </main>
    </div>
  );
}

export default App;
