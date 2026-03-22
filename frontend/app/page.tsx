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
      {/* Stunning Glassmorphism Header */}
      <header className="mb-12 relative">
        {/* Background decoration */}
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between relative">
          <div className="flex-1">
            {/* Logo + Title */}
            <div className="flex items-center gap-4 mb-4">
              {/* Animated Logo */}
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 
                  flex items-center justify-center shadow-lg animate-glow"
                  style={{
                    boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4), 0 0 60px rgba(139, 92, 246, 0.2)'
                  }}
                >
                  <span className="text-2xl font-bold text-white">L</span>
                </div>
                {/* Orbiting ring */}
                <div className="absolute inset-0 rounded-2xl border-2 border-indigo-400/30 animate-spin" 
                  style={{ animationDuration: '8s' }} />
              </div>

              <div>
                <h1 className="text-4xl font-extrabold tracking-tight">
                  <span className="text-gradient">LITMUS</span>
                </h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="badge badge-tag">EmpireHacks 2026</span>
                  <span className="text-xs text-zinc-600">The Operator Track</span>
                </div>
              </div>
            </div>

            {/* Tagline */}
            <p className="text-zinc-400 text-[15px] max-w-xl leading-relaxed mb-2">
              Autonomous research agent that{" "}
              <span className="text-indigo-400 font-medium">challenges itself</span>{" "}
              to find what's wrong before you do.
            </p>
            
            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 mt-4">
              {["Statistical Rigor", "Self-Debunking", "5-Stage Pipeline", "Surprise Scoring"].map((tag, i) => (
                <span 
                  key={tag}
                  className="px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: `rgba(99, 102, 241, ${0.1 + (i * 0.05)})`,
                    color: i === 0 ? '#818cf8' : i === 1 ? '#a78bfa' : i === 2 ? '#c084fc' : '#f472b6',
                    border: `1px solid rgba(99, 102, 241, ${0.2 + (i * 0.1)})`
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Reset button */}
          {stage !== "idle" && (
            <button 
              className="btn btn-ghost animate-fade-up" 
              onClick={handleReset}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              New Run
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      {stage === "idle" ? (
        <DataUpload onUpload={handleUpload} onDemoDataset={handleDemoDs} disabled={running} />
      ) : (
        <DiscoveryStream events={events} currentStage={stage} report={report} />
      )}

      {/* Footer */}
      <footer className="mt-20 pt-8 border-t border-white/5 text-center">
        <p className="text-xs text-zinc-600">
          <span className="text-gradient font-semibold">LITMUS</span> v0.2 · EmpireHacks 2026 · Operator Track
        </p>
      </footer>
    </div>
  );
}
