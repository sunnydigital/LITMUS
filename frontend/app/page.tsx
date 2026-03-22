"use client";

import { useState, useCallback } from "react";
import DataUpload from "@/components/DataUpload";
import DiscoveryStream from "@/components/DiscoveryStream";

export interface SSEEvent {
  type: "stage" | "result" | "complete" | "error" | "chart" | "subagent";
  data: Record<string, unknown>;
}

export default function Home() {
  const [stage, setStage] = useState("idle");
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const runPipeline = useCallback(async (formData: FormData) => {
    setRunning(true);
    setStage("profiling");
    setEvents([]);
    setReport(null);

    try {
      const res = await fetch("/api/discover", { method: "POST", body: formData });
      if (!res.ok || !res.body) {
        setEvents(p => [...p, { type: "error", data: { message: `HTTP ${res.status}` } }]);
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.trim()) continue;
          let eventType = "", eventData = "";
          for (const line of part.split("\n")) {
            if (line.startsWith("event: ")) eventType = line.slice(7);
            else if (line.startsWith("data: ")) eventData = line.slice(6);
          }
          if (!eventType || !eventData) continue;
          try {
            const parsed = JSON.parse(eventData);
            setEvents(p => [...p, { type: eventType as SSEEvent["type"], data: parsed }]);
            if (eventType === "stage" && parsed.stage) setStage(parsed.stage);
            if (eventType === "complete") { setReport(parsed.report || null); setStage("done"); }
            if (eventType === "error") setStage("error");
          } catch { /* skip bad JSON */ }
        }
      }
    } catch (err: unknown) {
      setEvents(p => [...p, {
        type: "error",
        data: { message: err instanceof Error ? err.message : "Connection failed" }
      }]);
      setStage("error");
    } finally {
      setRunning(false);
    }
  }, []);

  const handleUpload     = useCallback((files: File[]) => { const fd = new FormData(); files.forEach(f => fd.append("files", f)); runPipeline(fd); }, [runPipeline]);
  const handleDemoDs     = useCallback((id: string)   => { const fd = new FormData(); fd.append("demoDataset", id); runPipeline(fd); }, [runPipeline]);
  const handleReset      = useCallback(() => { setStage("idle"); setEvents([]); setReport(null); setRunning(false); }, []);

  return (
    <div className="container">
      {/* Header */}
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 40 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            {/* Logo mark */}
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 800, color: "#fff",
              boxShadow: "0 0 16px rgba(99,102,241,0.4)"
            }}>L</div>
            <h1 style={{
              fontSize: 24, fontWeight: 800, letterSpacing: "-0.04em",
              background: "linear-gradient(135deg, #818cf8, #6366f1, #a78bfa)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
            }}>LITMUS</h1>
            <span className="badge badge-tag" style={{ fontSize: 10 }}>EmpireHacks 2026</span>
          </div>
          <p style={{ color: "#52525b", fontSize: 13 }}>
            Autonomous research agent that{" "}
            <span style={{ color: "#818cf8" }}>tries to debunk itself</span>
            {" "}— findings must survive a 5-check skeptic gauntlet.
          </p>
        </div>
        {stage !== "idle" && (
          <button className="btn btn-ghost" onClick={handleReset} style={{ marginTop: 4 }}>
            ← New Run
          </button>
        )}
      </header>

      {/* Content */}
      {stage === "idle" ? (
        <DataUpload onUpload={handleUpload} onDemoDataset={handleDemoDs} disabled={running} />
      ) : (
        <DiscoveryStream events={events} currentStage={stage} report={report} />
      )}

      {/* Footer */}
      <footer style={{ marginTop: 64, textAlign: "center", color: "#3f3f46", fontSize: 12 }}>
        LITMUS v0.2 · EmpireHacks 2026 · Operator Track
      </footer>
    </div>
  );
}
