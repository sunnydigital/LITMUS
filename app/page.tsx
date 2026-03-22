"use client";

/**
 * LITMUS - Single Page App
 *
 * Upload training artifacts or run demo data.
 * Streams all 5 pipeline stages from /api/discover.
 * Renders results via DiscoveryStream component.
 */

import { useState, useCallback } from "react";
import DataUpload from "@/components/DataUpload";
import DiscoveryStream from "@/components/DiscoveryStream";

interface SSEEvent {
  type: "stage" | "result" | "complete" | "error";
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

        // Parse SSE events from buffer
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

  const handleReset = useCallback(() => {
    setStage("idle");
    setEvents([]);
    setReport(null);
    setRunning(false);
  }, []);

  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto">
      <header className="mb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">LITMUS</h1>
            <p className="text-zinc-400 mt-2">
              Find hidden dynamics in your transformer training runs
            </p>
          </div>
          {stage !== "idle" && (
            <button
              onClick={handleReset}
              className="text-sm px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-lg transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </header>

      {stage === "idle" ? (
        <DataUpload
          onUpload={handleUpload}
          onDemo={handleDemo}
          disabled={running}
        />
      ) : (
        <DiscoveryStream
          events={events}
          currentStage={stage}
          report={report}
        />
      )}

      <footer className="mt-16 text-zinc-600 text-xs text-center">
        LITMUS v0.2 -- EmpireHacks 2026 -- Operator Track
      </footer>
    </main>
  );
}
