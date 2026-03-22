"use client";

import React, { useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import type { ChartData } from "@/components/DiscoveryChart";

const DiscoveryChart = dynamic(() => import("@/components/DiscoveryChart"), {
  ssr: false,
  loading: () => (
    <div className="h-64 rounded-xl bg-bg-secondary border border-zinc-800 animate-pulse">
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    </div>
  ),
});

interface SSEEvent {
  type: "stage" | "result" | "complete" | "error" | "chart" | "thinking" | "tool_call" | "tool_result";
  data: Record<string, unknown>;
}

interface DiscoveryStreamProps {
  events: SSEEvent[];
  currentStage: string;
  report: string | null;
}

const TOOL_LABELS: Record<string, { label: string; color: string; icon: React.ReactElement }> = {
  describe_dataset: {
    label: "Describe Dataset",
    color: "indigo",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  run_ttest: {
    label: "T-Test",
    color: "amber",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  compute_correlation: {
    label: "Correlation",
    color: "purple",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  detect_simpsons_paradox: {
    label: "Simpson's Paradox",
    color: "amber",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  detect_changepoints: {
    label: "Changepoints",
    color: "emerald",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
      </svg>
    ),
  },
  detect_anomalies: {
    label: "Anomaly Detection",
    color: "red",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  chi_square_test: {
    label: "Chi-Square Test",
    color: "purple",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
      </svg>
    ),
  },
  compute_entropy: {
    label: "Entropy Analysis",
    color: "indigo",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  validate_findings: {
    label: "Validate Findings",
    color: "emerald",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  generate_chart: {
    label: "Generate Chart",
    color: "indigo",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
    ),
  },
  web_search: {
    label: "Web Search",
    color: "blue",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
};

const TOOL_COLOR_MAP: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  indigo: { bg: "bg-indigo-500/10", border: "border-indigo-500/20", text: "text-indigo-400", dot: "bg-indigo-500" },
  purple: { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-400", dot: "bg-purple-500" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", dot: "bg-amber-500" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-500" },
  red: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400", dot: "bg-red-500" },
  blue: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400", dot: "bg-blue-500" },
};

function getToolMeta(toolName: string) {
  return TOOL_LABELS[toolName] || {
    label: toolName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    color: "indigo",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  };
}

function formatToolInput(input: Record<string, unknown>): string {
  const entries = Object.entries(input).filter(([k]) => k !== "type");
  if (entries.length === 0) return "";
  return entries.map(([k, v]) => {
    const val = typeof v === "string" ? v : JSON.stringify(v);
    const display = val.length > 60 ? val.slice(0, 57) + "..." : val;
    return `${k}: ${display}`;
  }).join(" | ");
}

function truncateData(data: unknown, maxLen = 300): string {
  const s = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return s.length > maxLen ? s.slice(0, maxLen) + "\n..." : s;
}

export default function DiscoveryStream({
  events,
  currentStage,
  report,
}: DiscoveryStreamProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  // Collect all charts from chart events
  const allCharts = events
    .filter((e) => e.type === "chart")
    .flatMap((e) => (Array.isArray(e.data.charts) ? (e.data.charts as ChartData[]) : []));

  // Build the agentic timeline: thinking, tool_call, tool_result interleaved
  const timelineEvents = events.filter(
    (e) => e.type === "thinking" || e.type === "tool_call" || e.type === "tool_result"
  );

  // Count tool calls for the header
  const toolCallCount = events.filter((e) => e.type === "tool_call").length;
  const isDone = currentStage === "done";

  // Latest stage message
  const stageMessages = events.filter((e) => e.type === "stage");
  const latestStage = stageMessages.length > 0
    ? (stageMessages[stageMessages.length - 1].data as { stage: string; message: string })
    : null;

  return (
    <div className="space-y-6">
      {/* Agent Status Header */}
      <div className="card p-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDone ? "bg-gradient-to-br from-emerald-500 to-emerald-600" : "bg-gradient-to-br from-indigo-500 to-purple-500 animate-stage-pulse"} shadow-lg`}>
              {isDone ? (
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                {isDone ? "Investigation Complete" : "Agent Investigating"}
              </h2>
              <p className="text-sm text-zinc-500">
                {latestStage?.message || "Starting analysis..."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-tertiary border border-zinc-800">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm font-medium text-zinc-300">{toolCallCount} tools used</span>
            </div>
            {!isDone && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                <div className="w-2 h-2 rounded-full bg-indigo-500 -ml-4 relative z-10" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Charts (only shown while waiting for timeline to start) */}
      {allCharts.length > 0 && timelineEvents.length === 0 && !isDone && (
        <section className="animate-fade-in-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-100">Data Overview</h3>
              <p className="text-sm text-zinc-500">Initial profile of your dataset</p>
            </div>
          </div>
          <div className="grid gap-4">
            {allCharts.map((chart, i) => (
              <DiscoveryChart key={i} chart={chart} />
            ))}
          </div>
        </section>
      )}

      {/* Agentic Timeline */}
      {timelineEvents.length > 0 && (
        <section className="animate-fade-in-up">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-100">Agent Timeline</h3>
              <p className="text-sm text-zinc-500">Real-time view of autonomous investigation</p>
            </div>
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[15px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-indigo-500/50 via-purple-500/30 to-zinc-700/20" />

            <div className="space-y-3">
              {timelineEvents.map((event, idx) => {
                if (event.type === "thinking") {
                  return (
                    <div key={idx} className="relative pl-12 animate-fade-in">
                      {/* Timeline dot */}
                      <div className="absolute left-[14px] top-3 w-3 h-3 rounded-full bg-zinc-600 border-2 border-bg-primary" />
                      <div className="p-4 rounded-xl bg-bg-secondary/50 border border-zinc-800/50">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Reasoning</span>
                        </div>
                        <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">
                          {String(event.data.text || "")}
                        </p>
                      </div>
                    </div>
                  );
                }

                if (event.type === "tool_call") {
                  const toolName = String(event.data.tool || "");
                  const meta = getToolMeta(toolName);
                  const colors = TOOL_COLOR_MAP[meta.color] || TOOL_COLOR_MAP.indigo;
                  const input = (event.data.input || {}) as Record<string, unknown>;
                  const inputStr = formatToolInput(input);

                  return (
                    <div key={idx} className="relative pl-12 animate-fade-in">
                      {/* Timeline dot */}
                      <div className={`absolute left-[14px] top-3 w-3 h-3 rounded-full ${colors.dot} border-2 border-bg-primary`} />
                      <div className={`p-4 rounded-xl ${colors.bg} border ${colors.border}`}>
                        <div className="flex items-center gap-2">
                          <span className={colors.text}>{meta.icon}</span>
                          <span className={`text-sm font-semibold ${colors.text}`}>{meta.label}</span>
                          <svg className="w-3.5 h-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </div>
                        {inputStr && (
                          <p className="text-xs text-zinc-500 mt-2 font-mono">{inputStr}</p>
                        )}
                      </div>
                    </div>
                  );
                }

                if (event.type === "tool_result") {
                  const success = event.data.success as boolean;
                  const toolName = String(event.data.tool || "");
                  const data = event.data.data;
                  const dataStr = truncateData(data);

                  return (
                    <div key={idx} className="relative pl-12 animate-fade-in">
                      {/* Timeline dot */}
                      <div className={`absolute left-[14px] top-3 w-3 h-3 rounded-full ${success ? "bg-emerald-500" : "bg-red-500"} border-2 border-bg-primary`} />
                      <details className={`rounded-xl border ${success ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"}`}>
                        <summary className="p-3 cursor-pointer flex items-center gap-2 select-none">
                          {success ? (
                            <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          <span className={`text-xs font-medium ${success ? "text-emerald-400" : "text-red-400"}`}>
                            {toolName.replace(/_/g, " ")} — {success ? "success" : "failed"}
                          </span>
                        </summary>
                        <pre className="text-xs text-zinc-500 font-mono overflow-x-auto max-h-48 overflow-y-auto px-4 pb-3">
                          {dataStr}
                        </pre>
                      </details>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        </section>
      )}

      {/* Charts from tool results (inline after timeline) */}
      {allCharts.length > 0 && timelineEvents.length > 0 && (
        <section className="animate-fade-in-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-100">Visualizations</h3>
              <p className="text-sm text-zinc-500">Charts generated during investigation</p>
            </div>
          </div>
          <div className="grid gap-4">
            {allCharts.map((chart, i) => (
              <DiscoveryChart key={i} chart={chart} />
            ))}
          </div>
        </section>
      )}

      {/* Report */}
      {report && (
        <section className="animate-fade-in-up">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-glow">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100">Discovery Report</h3>
                  <p className="text-sm text-zinc-500">Validated findings from autonomous investigation</p>
                </div>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(report)}
                className="btn-secondary"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </button>
            </div>
            <div className="report-container">
              <div dangerouslySetInnerHTML={{ __html: markdownToHtml(report) }} />
            </div>
          </div>
        </section>
      )}

      {/* Errors */}
      {events
        .filter((e) => e.type === "error")
        .map((e, i) => (
          <div key={i} className="error-container">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 text-red-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-red-400 font-medium">Error</p>
              <p className="text-red-300/70 text-sm mt-1">{String(e.data.message ?? "Unknown error")}</p>
            </div>
          </div>
        ))}

      <div ref={bottomRef} />
    </div>
  );
}

function markdownToHtml(md: string): string {
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-zinc-200 mt-6 mb-3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold text-zinc-100 mt-8 mb-4">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-zinc-100 mb-6">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-zinc-100 font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-zinc-400">$1</em>')
    .replace(/^- (.+)$/gm, '<li class="text-zinc-400 ml-4">$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul class="list-disc list-inside space-y-1 my-3">${m}</ul>`)
    .replace(/\n\n/g, '</p><p class="text-zinc-300 mb-4">')
    .replace(/^/, '<p class="text-zinc-300 mb-4">')
    .replace(/$/, "</p>");
}
