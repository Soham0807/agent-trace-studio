import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { runAgentTrace } from "./orchestrator.js";
import type { TraceEvent } from "./types.js";

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

const clients = new Set<WebSocket>();

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
});

function broadcast(event: TraceEvent) {
  const payload = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, hasApiKey: Boolean(process.env.GEMINI_API_KEY) });
});

app.post("/api/runs", async (req, res) => {
  const goal = String(req.body?.goal || "").trim();
  if (!goal) {
    res.status(400).json({ error: "goal is required" });
    return;
  }
  res.json({ started: true });
  // Fire and stream via WebSocket; errors are emitted as run_error events.
  runAgentTrace(goal, broadcast);
});

const PORT = Number(process.env.PORT) || 8787;
server.listen(PORT, () => {
  console.log(`Agent Trace Studio server listening on http://localhost:${PORT}`);
});
