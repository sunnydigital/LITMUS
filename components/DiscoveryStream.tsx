"use client";

import React from "react";
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
  type: "stage" | "result" | "complete" | "error" | "chart";
  data: Record<string, unknown>;
}

interface DiscoveryStreamProps {
  events: SSEEvent[];
  currentStage: string;
  report: string | null;
}

const STAGES = [
  { key: "profiling", label: "Profile", color: "indigo" },
  { key: "hypothesizing", label: "Hypothesize", color: "purple" },
  { key: "experimenting", label: "Experiment", color: "amber" },
  { key: "validating", label: "Validate", color: "emerald" },
  { key: "narrating", label: "Narrate", color: "indigo" },
];

const STAGE_ICONS: Record<string, React.ReactElement> = {
  Profile: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  Hypothesize: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  Experiment: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  Validate: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  Narrate: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
};

const COLOR_MAP = {
  indigo: { bg: "bg-indigo-500", text: "text-indigo-400", glow: "rgba(99, 102, 241, 0.5)" },
  purple: { bg: "bg-purple-500", text: "text-purple-400", glow: "rgba(139, 92, 246, 0.5)" },
  amber: { bg: "bg-amber-500", text: "text-amber-400", glow: "rgba(251, 191, 36, 0.5)" },
  emerald: { bg: "bg-emerald-500", text: "text-emerald-400", glow: "rgba(34, 197, 94, 0.5)" },
};

function gradeColor(grade: string): string {
  if (grade === "A") return "grade-a";
  if (grade === "B") return "grade-b";
  return "grade-c";
}

function pColor(p: number): string {
  if (p < 0.01) return "text-emerald-400";
  if (p < 0.05) return "text-amber-400";
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

  const hypothesisCharts = events
    .filter((e) => e.type === "chart" && e.data.stage === "hypothesis")
    .flatMap((e) => (Array.isArray(e.data.charts) ? (e.data.charts as ChartData[]) : []));

  const experimentCharts = events
    .filter((e) => e.type === "chart" && e.data.stage === "experiment")
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
      {/* Pipeline Progress */}
      <div className="card p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-zinc-100">Pipeline Progress</h2>
          <span className="badge badge-accent capitalize">{currentStage}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {STAGES.map((s, i) => {
            const done = completedStages.has(s.key);
            const active = s.key === currentStage;
            const colors = COLOR_MAP[s.color as keyof typeof COLOR_MAP];
            
            return (
              <React.Fragment key={s.key}>
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`
                      w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-400
                      ${done
                        ? `bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg`
                        : active
                          ? `bg-gradient-to-br ${colors.bg} to-purple-500 text-white shadow-lg animate-stage-pulse`
                          : "bg-bg-tertiary text-zinc-600"
                      }
                    `}
                    style={active ? { boxShadow: `0 0 30px ${colors.glow}, 0 0 60px ${colors.glow}30` } : {}}
                  >
                    {done ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      STAGE_ICONS[s.label]
                    )}
                  </div>
                  <span className={`mt-2 text-xs font-medium ${done ? "text-emerald-400" : active ? colors.text : "text-zinc-600"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div className={`h-0.5 flex-1 mb-6 transition-all duration-500 ${done ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-zinc-800"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Status Message */}
      {stageMessages.length > 0 && (
        <div className="flex items-center gap-3 text-sm text-zinc-400 p-4 rounded-xl bg-bg-secondary border border-zinc-800">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
          <div className="w-2 h-2 rounded-full bg-indigo-500 -ml-4 relative z-10" />
          <span>{stageMessages[stageMessages.length - 1].message}</span>
        </div>
      )}

      {/* Profile Charts */}
      {profileCharts.length > 0 && (
        <section className="animate-fade-in-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-100">Data Overview</h3>
              <p className="text-sm text-zinc-500">Profile analysis of your dataset</p>
            </div>
          </div>
          <div className="grid gap-4">
            {profileCharts.map((chart, i) => (
              <DiscoveryChart key={i} chart={chart} />
            ))}
          </div>
        </section>
      )}

      {/* Hypotheses */}
      {hypotheses.length > 0 && (
        <section className="animate-fade-in-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-zinc-100">Generated Hypotheses</h3>
              <span className="badge badge-purple">{hypotheses.length}</span>
            </div>
          </div>
          <div className="space-y-4">
            {hypotheses.map((h: Record<string, unknown>, i: number) => (
              <div key={String(h.id ?? i)} className="card p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0 text-purple-400 font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-200 leading-relaxed">{String(h.text ?? "")}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
                      <span className="badge badge-purple">
                        surprise: {String(h.surprise_prior ?? "?")}
                      </span>
                      <span className="text-zinc-500 italic">{String(h.test_strategy ?? "")}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {hypothesisCharts.length > 0 && (
            <div className="grid gap-4 mt-4">
              {hypothesisCharts.map((chart, i) => (
                <DiscoveryChart key={i} chart={chart} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Experiments */}
      {experiments.length > 0 && (
        <section className="animate-fade-in-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-zinc-100">Experiment Results</h3>
              <span className="badge badge-amber">{experiments.length}</span>
            </div>
          </div>
          <div className="space-y-4">
            {experiments.map((exp, i) => (
              <div key={i} className="card p-5">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${exp.supports ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                    {exp.supports ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-zinc-200 font-medium mb-3">
                      {String(exp.hypothesis ?? "").slice(0, 150)}
                      {(String(exp.hypothesis ?? "").length > 150) && "..."}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge">{String(exp.test_name ?? "")}</span>
                      <span className={`badge ${pColor(Number(exp.p_value ?? 1)) === "text-emerald-400" ? "badge-emerald" : pColor(Number(exp.p_value ?? 1)) === "text-amber-400" ? "badge-amber" : "badge-red"}`}>
                        p = {Number(exp.p_value ?? 1).toFixed(4)}
                      </span>
                      <span className="badge">d = {Number(exp.effect_size ?? 0).toFixed(2)}</span>
                      <span className={`badge ${exp.supports ? "badge-emerald" : "badge-red"}`}>
                        {exp.supports ? "Supports" : "Refutes"}
                      </span>
                    </div>
                    {String(exp.interpretation ?? "") && (
                      <p className="text-sm text-zinc-500 mt-3 italic leading-relaxed">
                        {String(exp.interpretation ?? "").slice(0, 200)}
                        {(String(exp.interpretation ?? "").length > 200) && "..."}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {experimentCharts.length > 0 && (
            <div className="grid gap-4 mt-4">
              {experimentCharts.map((chart, i) => (
                <DiscoveryChart key={i} chart={chart} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Validations */}
      {validations.length > 0 && (
        <section className="animate-fade-in-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-zinc-100">Validation Results</h3>
              <span className="badge badge-emerald">{validations.length}</span>
            </div>
          </div>
          <div className="space-y-4">
            {validations.map((v, i) => {
              const checks = (v.checks ?? []) as Array<{ name: string; result: string; reason: string }>;
              return (
                <div key={i} className="card p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-zinc-200 font-medium mb-4">
                        {String(v.hypothesis ?? "").slice(0, 120)}
                        {(String(v.hypothesis ?? "").length > 120) && "..."}
                      </p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {checks.map((c, j) => (
                          <span
                            key={j}
                            className={`badge ${c.result === "PASS" ? "badge-emerald" : "badge-red"}`}
                            title={c.reason}
                          >
                            {c.name}: {c.result}
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
                        <span className="text-purple-400">surprise: {String(v.surprise_score ?? "?")}</span>
                        <span className="text-zinc-700">|</span>
                        <span className={pColor(Number(v.p_value ?? 1))}>p = {Number(v.p_value ?? 1).toFixed(4)}</span>
                        <span className="text-zinc-700">|</span>
                        <span>d = {Number(v.effect_size ?? 0).toFixed(2)}</span>
                      </div>
                    </div>
                    <div className={`grade-badge ${gradeColor(String(v.grade ?? "C"))}`}>
                      {String(v.grade ?? "?")}
                    </div>
                  </div>
                </div>
              );
            })}
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
                  <p className="text-sm text-zinc-500">Generated insights and findings</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
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
