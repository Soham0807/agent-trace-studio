import type { AgentRole } from "./types";

const NODES: { id: AgentRole; label: string; x: number; y: number; color: string }[] = [
  { id: "planner", label: "Planner", x: 200, y: 40, color: "#7dd3fc" },
  { id: "coder", label: "Coder", x: 70, y: 200, color: "#a5b4fc" },
  { id: "critic", label: "Critic", x: 330, y: 200, color: "#fca5a5" },
];

const EDGES: [AgentRole, AgentRole][] = [
  ["planner", "coder"],
  ["coder", "critic"],
  ["critic", "coder"],
];

function nodeById(id: AgentRole) {
  return NODES.find((n) => n.id === id)!;
}

export function AgentGraph({ activeAgent }: { activeAgent: AgentRole | null }) {
  return (
    <svg viewBox="0 0 400 260" className="agent-graph">
      {EDGES.map(([from, to], i) => {
        const a = nodeById(from);
        const b = nodeById(to);
        return (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            className="agent-edge"
          />
        );
      })}
      {NODES.map((n) => (
        <g key={n.id} className={activeAgent === n.id ? "agent-node active" : "agent-node"}>
          <circle cx={n.x} cy={n.y} r={34} fill={n.color} />
          {activeAgent === n.id && <circle cx={n.x} cy={n.y} r={34} className="agent-pulse" fill={n.color} />}
          <text x={n.x} y={n.y + 5} textAnchor="middle" className="agent-label">
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
