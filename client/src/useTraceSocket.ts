import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { traceReducer, initialTraceState } from "./traceReducer";
import type { TraceEvent } from "./types";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8787/ws";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8787";

export function useTraceSocket() {
  const [state, dispatch] = useReducer(traceReducer, initialTraceState);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as TraceEvent;
        dispatch(event);
      } catch {
        // ignore malformed frames
      }
    };
    return () => ws.close();
  }, []);

  const startRun = useCallback(async (goal: string) => {
    await fetch(`${API_URL}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal }),
    });
  }, []);

  return { state, connected, startRun };
}
