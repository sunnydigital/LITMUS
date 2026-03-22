"use client";

import { useState, useCallback } from "react";
import DataUpload from "@/components/DataUpload";
import DiscoveryStream from "@/components/DiscoveryStream";

interface SSEEvent {
  type: "stage" | "result" | "complete" | "error" | "chart";
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
      const res = await fetch("/api/discover", {
        method: "POST",
        body: formData,
      });

      if (!res.ok || !res.body) {
        setEvents((prev) => [
          ...prev,
          { type: "error", data: { message: `HTTP ${res.status}` } },
        ]);
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

          const lines = part.split("\n");
          let eventType = "";
          let eventData = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7);
            } else if (line.startsWith("data: ")) {
              eventData = line.slice(6);
            }
          }

          if (!eventType || !eventData) continue;

          try {
            const parsed = JSON.parse(eventData);
            const sseEvent: SSEEvent = {
              type: eventType as SSEEvent["type"],
              data: parsed,
            };

            setEvents((prev) => [...prev, sseEvent]);

            if (eventType === "stage" && parsed.stage) {
              setStage(parsed.stage);
            }

            if (eventType === "complete") {
              setReport(parsed.report || null);
              setStage("done");
            }

            if (eventType === "error") {
              setStage("error");
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setEvents((prev) => [...prev, { type: "error", data: { message: msg } }]);
      setStage("error");
    } finally {
      setRunning(false);
    }
  }, []);

  const handleUpload = useCallback(
    (files: File[]) => {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }
      runPipeline(formData);
    },
    [runPipeline],
  );

  const handleDemo = useCallback(() => {
    const formData = new FormData();
    formData.append("demo", "true");
    runPipeline(formData);
  }, [runPipeline]);

  const handleDemoDataset = useCallback(
    (datasetId: string) => {
      const formData = new FormData();
      formData.append("demoDataset", datasetId);
      runPipeline(formData);
    },
    [runPipeline],
  );

  const handleReset = useCallback(() => {
    setStage("idle");
    setEvents([]);
    setReport(null);
    setRunning(false);
  }, []);

  return (
    <main className="min-h-screen bg-bg-primary relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-float" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />
        <div className="absolute inset-0 bg-mesh opacity-50" />
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 opacity-[0.02]" style={{
        backgroundImage: `linear-gradient(var(--border-color) 1px, transparent 1px), linear-gradient(90deg, var(--border-color) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {stage === "idle" ? (
          <div className="flex flex-col min-h-screen">
            {/* Navigation */}
            <nav className="flex items-center justify-between py-6 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-glow">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-zinc-400">EmpireHacks 2026</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-accent">Operator Track</span>
              </div>
            </nav>

            {/* Hero Section */}
            <section className="flex-grow flex flex-col justify-center py-16">
              <div className="text-center max-w-4xl mx-auto">
                {/* Logo */}
                <div className="mb-8 animate-fade-in-up">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-accent to-purple-500 shadow-glow animate-stage-pulse">
                    <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                </div>

                {/* Title */}
                <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tighter mb-6 animate-fade-in-up delay-100">
                  <span className="gradient-text">LITMUS</span>
                </h1>

                {/* Tagline */}
                <p className="text-xl md:text-2xl text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-8 animate-fade-in-up delay-200">
                  Autonomous data exploration agent that{" "}
                  <span className="text-accent-light font-medium">challenges itself</span>{" "}
                  to find what&apos;s wrong before you do.
                </p>

                {/* Feature Tags */}
                <div className="flex flex-wrap justify-center gap-3 mb-12 animate-fade-in-up delay-300">
                  <span className="tag">Statistical Rigor</span>
                  <span className="tag">Self-Debunking</span>
                  <span className="tag">5-Stage Pipeline</span>
                  <span className="tag">AI-Powered</span>
                </div>

                {/* CTA */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-400">
                  <button 
                    onClick={() => document.getElementById('upload-section')?.scrollIntoView({ behavior: 'smooth' })}
                    className="btn-primary px-8 py-4 text-base shadow-accent"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Start Exploring
                  </button>
                  <button onClick={handleDemo} className="btn-secondary px-6 py-4">
                    Try Demo
                  </button>
                </div>
              </div>
            </section>

            {/* Upload Section */}
            <section id="upload-section" className="pb-16">
              <DataUpload
                onUpload={handleUpload}
                onDemo={handleDemo}
                onDemoDataset={handleDemoDataset}
                disabled={running}
              />
            </section>

            {/* Footer */}
            <footer className="py-8 text-center border-t border-zinc-800/50">
              <p className="text-sm text-zinc-600">
                LITMUS v0.2 — Autonomous Research Agent
              </p>
            </footer>
          </div>
        ) : (
          <div className="py-8">
            {/* Header */}
            <header className="flex items-center justify-between mb-8 animate-fade-in">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center shadow-glow">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold gradient-text-static">LITMUS</h1>
                  <p className="text-sm text-zinc-500">Analysis in Progress</p>
                </div>
              </div>
              <button onClick={handleReset} className="btn-secondary">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Start Over
              </button>
            </header>

            <DiscoveryStream
              events={events}
              currentStage={stage}
              report={report}
            />
          </div>
        )}
      </div>
    </main>
  );
}
