"use client";

/**
 * DiscoveryStream
 *
 * Single component that renders the full SSE event stream.
 * Shows pipeline progress, hypotheses, experiment results,
 * validation badges, inline charts, and the final markdown report.
 */

import dynamic from "next/dynamic";
import type { ChartData } from "@/components/DiscoveryChart";

const DiscoveryChart = dynamic(() => import("@/components/DiscoveryChart"), {
  ssr: false,
  loading: () => <div className="h-64 bg-zinc-900/50 border border-zinc-800 rounded-lg animate-pulse" />,
});

interface SSEEvent {
  type: "stage" | "result" | "complete" | "error" | "chart";
  data: Record<string, unknown>;
}

interface DiscoveryStreamProps {
  events: SSEEvent[];
  currentStage: string;
  report: string | null;
}

const STAGES = [
  { key: "profiling", label: "Profile" },
  { key: "hypothesizing", label: "Hypothesize" },
  { key: "experimenting", label: "Experiment" },
  { key: "validating", label: "Validate" },
  { key: "narrating", label: "Narrate" },
];

function gradeColor(grade: string): string {
  if (grade === "A") return "text-green-400";
  if (grade === "B") return "text-yellow-400";
  return "text-red-400";
}

function pColor(p: number): string {
  if (p < 0.01) return "text-green-400";
  if (p < 0.05) return "text-yellow-400";
  return "text-red-400";
}

export default function DiscoveryStream({
  events,
  currentStage,
  report,
}: DiscoveryStreamProps) {
  const hypotheses = events
    .filter((e) => e.type === "result" && e.data.stage === "hypotheses")
    .flatMap((e) => {
      const data = e.data.data;
      return Array.isArray(data) ? data : [];
    });

  const experiments = events
    .filter((e) => e.type === "result" && e.data.stage === "experiment")
    .map((e) => e.data.data as Record<string, unknown>);

  const validations = events
    .filter((e) => e.type === "result" && e.data.stage === "validation")
    .map((e) => e.data.data as Record<string, unknown>);

  const stageMessages = events
    .filter((e) => e.type === "stage")
    .map((e) => e.data as { stage: string; message: string });

  const profileCharts = events
    .filter((e) => e.type === "chart" && e.data.stage === "profile")
    .flatMap((e) => (Array.isArray(e.data.charts) ? (e.data.charts as ChartData[]) : []));

  const completedStages = new Set<string>();
  const stageOrder = STAGES.map((s) => s.key);
  const currentIdx = stageOrder.indexOf(currentStage);
  for (let i = 0; i < currentIdx; i++) {
    completedStages.add(stageOrder[i]);
  }
  if (currentStage === "done") {
    stageOrder.forEach((s) => completedStages.add(s));
  }

  return (
    <div className="space-y-8">
      {/* Pipeline Timeline */}
      <div className="flex items-center gap-2 text-sm">
        {STAGES.map((s, i) => {
          const done = completedStages.has(s.key);
          const active = s.key === currentStage;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                  done
                    ? "border-green-500 bg-green-500/20 text-green-400"
                    : active
                      ? "border-indigo-500 bg-indigo-500/20 text-indigo-400 animate-pulse"
                      : "border-zinc-700 text-zinc-600"
                }`}
              >
                {done ? "\u2713" : i + 1}
              </div>
              <span
                className={
                  done
                    ? "text-green-400"
                    : active
                      ? "text-indigo-400"
                      : "text-zinc-600"
                }
              >
                {s.label}
              </span>
              {i < STAGES.length - 1 && (
                <div
                  className={`w-8 h-px ${done ? "bg-green-500" : "bg-zinc-700"}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Status message */}
      {stageMessages.length > 0 && (
        <p className="text-zinc-400 text-sm italic">
          {stageMessages[stageMessages.length - 1].message}
        </p>
      )}

      {/* Profile Charts */}
      {profileCharts.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-zinc-200">Data Charts</h3>
          {profileCharts.map((chart, i) => (
            <DiscoveryChart key={i} chart={chart} />
          ))}
        </div>
      )}

      {/* Hypotheses */}
      {hypotheses.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-zinc-200">
            Hypotheses
          </h3>
          <div className="grid gap-3">
            {hypotheses.map((h: Record<string, unknown>, i: number) => (
              <div
                key={String(h.id ?? i)}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
              >
                <div className="flex justify-between items-start">
                  <p className="text-zinc-200 text-sm">{String(h.text ?? "")}</p>
                  <span className="text-xs text-indigo-400 ml-4 whitespace-nowrap">
                    surprise: {String(h.surprise_prior ?? "?")}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  {String(h.test_strategy ?? "")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Experiment Results */}
      {experiments.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-zinc-200">
            Experiments
          </h3>
          <div className="grid gap-3">
            {experiments.map((exp, i) => (
              <div
                key={i}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="text-zinc-300 text-sm font-medium">
                    {String(exp.hypothesis ?? "").slice(0, 100)}
                  </p>
                  <span className="text-xs text-zinc-500 ml-2">
                    {String(exp.test_name ?? "")}
                  </span>
                </div>
                <div className="flex gap-4 text-xs">
                  <span className={pColor(Number(exp.p_value ?? 1))}>
                    p = {Number(exp.p_value ?? 1).toFixed(4)}
                  </span>
                  <span className="text-zinc-400">
                    d = {Number(exp.effect_size ?? 0).toFixed(2)}
                  </span>
                  <span
                    className={
                      exp.supports ? "text-green-400" : "text-red-400"
                    }
                  >
                    {exp.supports ? "Supports" : "Does not support"}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  {String(exp.interpretation ?? "")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation Results */}
      {validations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-zinc-200">
            Validation
          </h3>
          <div className="grid gap-3">
            {validations.map((v, i) => {
              const checks = (v.checks ?? []) as Array<{
                name: string;
                result: string;
                reason: string;
              }>;
              return (
                <div
                  key={i}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-4"
                >
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-zinc-300 text-sm">
                      {String(v.hypothesis ?? "").slice(0, 80)}
                    </p>
                    <span
                      className={`text-sm font-bold ${gradeColor(String(v.grade ?? "C"))}`}
                    >
                      Grade {String(v.grade ?? "?")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {checks.map((c, j) => (
                      <span
                        key={j}
                        className={`text-xs px-2 py-1 rounded ${
                          c.result === "PASS"
                            ? "bg-green-500/10 text-green-400 border border-green-500/30"
                            : "bg-red-500/10 text-red-400 border border-red-500/30"
                        }`}
                        title={c.reason}
                      >
                        {c.name}: {c.result}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">
                    surprise: {String(v.surprise_score ?? "?")} | p ={" "}
                    {Number(v.p_value ?? 1).toFixed(4)} | d ={" "}
                    {Number(v.effect_size ?? 0).toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Final Report */}
      {report && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-zinc-200">
              Discovery Report
            </h3>
            <button
              onClick={() => navigator.clipboard.writeText(report)}
              className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded transition-colors"
            >
              Copy Markdown
            </button>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 prose prose-invert prose-sm max-w-none">
            <div
              dangerouslySetInnerHTML={{
                __html: markdownToHtml(report),
              }}
            />
          </div>
        </div>
      )}

      {/* Error display */}
      {events
        .filter((e) => e.type === "error")
        .map((e, i) => (
          <div
            key={i}
            className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm"
          >
            Error: {String(e.data.message ?? "Unknown error")}
          </div>
        ))}
    </div>
  );
}

/**
 * Minimal markdown to HTML. Handles headers, bold, lists, paragraphs.
 * Good enough for a hackathon demo.
 */
function markdownToHtml(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}
