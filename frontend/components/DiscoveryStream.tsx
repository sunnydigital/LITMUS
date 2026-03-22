"use client";

import { useMemo, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import type { SSEEvent } from "@/app/page";
import KnowledgeGraph from "./KnowledgeGraph";
import type { ChartData } from "./DiscoveryChart";

const DiscoveryChart = dynamic(() => import("./DiscoveryChart"), { ssr: false });

interface DiscoveryStreamProps {
  events: SSEEvent[];
  currentStage: string;
  report: string | null;
}

interface Finding {
  hypothesis: string;
  grade: string;
  surprise_score: number;
  p_value: number;
  effect_size: number;
  checks: Array<{ name: string; result: string; reason: string }>;
  interpretation: string;
}

const STAGES = [
  { key: "profiling",     label: "Profile" },
  { key: "hypothesizing", label: "Hypothesize" },
  { key: "experimenting", label: "Experiment" },
  { key: "validating",    label: "Validate" },
  { key: "narrating",     label: "Narrate" },
];

const GRADE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  A: { bg: "rgba(34,197,94,0.08)",  color: "#4ade80", border: "rgba(34,197,94,0.25)" },
  B: { bg: "rgba(250,204,21,0.08)", color: "#facc15", border: "rgba(250,204,21,0.25)" },
  C: { bg: "rgba(248,113,113,0.08)",color: "#f87171", border: "rgba(248,113,113,0.25)" },
};

function gradeColors(g: string) {
  return GRADE_COLORS[g] ?? GRADE_COLORS["C"];
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : Number(v) || fallback;
}
function str(v: unknown, fallback = ""): string {
  return v == null ? fallback : String(v);
}

function MiniBar({ values, color }: { values: number[]; color: string }) {
  if (!values.length) return null;
  const max = Math.max(...values.map(Math.abs), 0.001);
  return (
    <div className="mini-bar-wrap" title="Distribution">
      {values.map((v, i) => (
        <div
          key={i}
          className="mini-bar"
          style={{
            height: `${Math.max(4, (Math.abs(v) / max) * 44)}px`,
            background: color,
            opacity: 0.6 + (i / values.length) * 0.4,
            flex: 1,
          }}
        />
      ))}
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function MarkdownReport({ text }: { text: string }) {
  const html = useMemo(() => {
    let h = text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>[\s\S]*?<\/li>)/, "<ul>$1</ul>")
      .replace(/\n{2,}/g, "<br/><br/>")
      .replace(/\n/g, "<br/>");
    return h;
  }, [text]);

  return (
    <div
      className="prose"
      style={{ lineHeight: 1.7 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function DiscoveryStream({ events, currentStage, report }: DiscoveryStreamProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [events.length]);

  // Extract data from events
  const hypotheses = events
    .filter(e => e.type === "result" && e.data.stage === "hypotheses")
    .flatMap(e => Array.isArray(e.data.data) ? e.data.data as Record<string, unknown>[] : []);

  const experiments = events
    .filter(e => e.type === "result" && e.data.stage === "experiment")
    .map(e => e.data.data as Record<string, unknown>);

  const validations = events
    .filter(e => e.type === "result" && e.data.stage === "validation")
    .map(e => e.data.data as Record<string, unknown>);

  const stageMessages = events
    .filter(e => e.type === "stage")
    .map(e => e.data as { stage: string; message: string });

  const subagentEvents = events
    .filter(e => e.type === "subagent")
    .map(e => e.data as { parent: string; action: string });

  const sheetsResult = events
    .filter(e => e.type === "result" && e.data.stage === "sheets")
    .map(e => e.data.data as { url: string })
    .at(-1);

  // Charts from profile stage
  const profileCharts = events
    .filter(e => e.type === "chart" && e.data.stage === "profile")
    .flatMap(e => Array.isArray(e.data.charts) ? e.data.charts as ChartData[] : []);

  // Profile data summary (columns, anomalies)
  const profileData = events
    .filter(e => e.type === "result" && e.data.stage === "profile")
    .map(e => e.data.data as Record<string, unknown>)
    .at(-1);

  const errors = events
    .filter(e => e.type === "error")
    .map(e => str(e.data.message, "Unknown error"));

  // Compute completed stages for tracker
  const stageOrder = STAGES.map(s => s.key);
  const currentIdx = stageOrder.indexOf(currentStage);
  const completedStages = new Set<string>();
  for (let i = 0; i < currentIdx; i++) completedStages.add(stageOrder[i]);
  if (currentStage === "done") stageOrder.forEach(s => completedStages.add(s));

  // Findings for export + knowledge graph
  const findingsFromComplete = events
    .filter(e => e.type === "complete")
    .flatMap(e => Array.isArray(e.data.findings) ? e.data.findings as Finding[] : []);

  const allFindings: Finding[] =
    findingsFromComplete.length > 0
      ? findingsFromComplete
      : (validations as unknown as Finding[]);

  // Stats for mini charts
  const surpriseVals   = allFindings.map(f => num(f.surprise_score));
  const pVals          = allFindings.map(f => num(f.p_value));
  const effectVals     = allFindings.map(f => Math.abs(num(f.effect_size)));

  async function handleExportCsv() {
    const res = await fetch("/api/export/csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ findings: allFindings }),
    });
    if (!res.ok) return alert("CSV export failed.");
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const match = cd.match(/filename="(.+)"/);
    downloadBlob(blob, match?.[1] || "litmus-findings.csv");
  }

  async function handleExportReport() {
    const res = await fetch("/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report: report || "", findings: allFindings }),
    });
    if (!res.ok) return alert("Report export failed.");
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const match = cd.match(/filename="(.+)"/);
    downloadBlob(blob, match?.[1] || "litmus-report.html");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── Pipeline tracker ── */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div className="stage-track" style={{ flexWrap: "wrap", gap: 4, rowGap: 8 }}>
          {STAGES.map((s, i) => {
            const done   = completedStages.has(s.key);
            const active = s.key === currentStage;
            return (
              <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 0 }}>
                <div className="stage-node" style={{ gap: 6 }}>
                  <div className={`stage-circle${done ? " done" : active ? " active" : ""}`}>
                    {done ? "✓" : i + 1}
                  </div>
                  <span className={`stage-label${done ? " done" : active ? " active" : ""}`}>
                    {s.label}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div className={`stage-sep${done ? " done" : ""}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Status message */}
        {stageMessages.length > 0 && (
          <p style={{ marginTop: 10, fontSize: 12, color: "#71717a", fontStyle: "italic" }}>
            {stageMessages[stageMessages.length - 1].message}
          </p>
        )}
      </div>

      {/* ── Errors ── */}
      {errors.map((msg, i) => (
        <div key={i} className="card" style={{ borderColor: "rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.05)" }}>
          <div className="row">
            <span style={{ color: "#f87171" }}>✕</span>
            <span style={{ color: "#f87171", fontSize: 13 }}>{msg}</span>
          </div>
        </div>
      ))}

      {/* ── Sub-agent feed ── */}
      {subagentEvents.length > 0 && (
        <div className="subagent-feed stack" style={{ gap: 6 }}>
          <p className="label" style={{ marginBottom: 4, color: "#6366f1" }}>Sub-agent activity</p>
          {subagentEvents.map((evt, i) => (
            <div key={i} className="row" style={{ gap: 6, fontSize: 12 }}>
              <span style={{ color: "#4f46e5", fontSize: 11 }}>⊕</span>
              <span style={{ color: "#818cf8", fontWeight: 500 }}>{evt.parent}</span>
              <span style={{ color: "#3f3f46" }}>→</span>
              <span style={{ color: "#a1a1aa" }}>{evt.action}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Profile data table ── */}
      {profileData && (
        <div>
          <p className="label" style={{ marginBottom: 10 }}>Dataset profile</p>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            {/* Summary row */}
            <div className="row" style={{ padding: "10px 14px", borderBottom: "1px solid #27272a", gap: 20, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#a1a1aa" }}>
                <span style={{ color: "#f4f4f5", fontWeight: 600, fontFamily: "monospace" }}>
                  {String(profileData.row_count ?? "?")}
                </span>{" "}rows
              </span>
              <span style={{ fontSize: 12, color: "#a1a1aa" }}>
                <span style={{ color: "#f4f4f5", fontWeight: 600, fontFamily: "monospace" }}>
                  {Array.isArray(profileData.columns) ? profileData.columns.length : "?"}
                </span>{" "}columns
              </span>
              {profileData.data_quality != null && (
                <span style={{ fontSize: 12, color: "#a1a1aa" }}>
                  missing{" "}
                  <span style={{ color: "#f4f4f5", fontWeight: 600, fontFamily: "monospace" }}>
                    {String((profileData.data_quality as Record<string, unknown>).missing_pct ?? "0")}%
                  </span>
                </span>
              )}
            </div>
            {/* Columns table */}
            {Array.isArray(profileData.columns) && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#111113" }}>
                    {["Column", "Type", "Summary"].map(h => (
                      <th key={h} style={{ padding: "8px 14px", textAlign: "left", color: "#52525b", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid #27272a" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(profileData.columns as Record<string, unknown>[]).map((col, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #1f1f22" }}>
                      <td style={{ padding: "8px 14px", color: "#818cf8", fontFamily: "monospace", whiteSpace: "nowrap" }}>{String(col.name ?? "")}</td>
                      <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                        <span className="badge badge-tag">{String(col.type ?? "")}</span>
                      </td>
                      <td style={{ padding: "8px 14px", color: "#71717a", lineHeight: 1.5 }}>{String(col.summary ?? "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {/* Anomalies */}
            {Array.isArray(profileData.anomalies) && (profileData.anomalies as Record<string, unknown>[]).length > 0 && (
              <div style={{ padding: "10px 14px", borderTop: "1px solid #27272a" }}>
                <p className="label" style={{ marginBottom: 6, color: "#f87171" }}>Anomalies detected</p>
                {(profileData.anomalies as Record<string, unknown>[]).map((a, i) => (
                  <div key={i} className="row" style={{ gap: 8, marginBottom: 4, alignItems: "flex-start" }}>
                    <span style={{ color: "#f87171", flexShrink: 0, fontSize: 11 }}>⚠</span>
                    <p style={{ fontSize: 12, color: "#a1a1aa" }}>{String(a.description ?? "")}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Profile charts ── */}
      {profileCharts.length > 0 && (
        <div>
          <div className="section-head"><span className="title">Data Visualisation</span><span className="subtitle">Charts generated from the profiled dataset</span></div>
          <div className="stack" style={{ gap: 10 }}>
            {profileCharts.map((chart, i) => (
              <DiscoveryChart key={i} chart={chart} />
            ))}
          </div>
        </div>
      )}

      {/* ── Hypotheses ── */}
      {hypotheses.length > 0 && (
        <div>
          <div className="section-head">
            <span className="title">{hypotheses.length} Hypotheses</span>
            <span className="subtitle">Generated by the research agent from data patterns</span>
          </div>
          <div className="grid-3" style={{ gap: 8 }}>
            {hypotheses.map((h, i) => (
              <div key={String(h.id ?? i)} className="card-sm">
                <div className="row" style={{ marginBottom: 6 }}>
                  <span style={{ color: "#52525b", fontSize: 11, fontFamily: "monospace" }}>H{i + 1}</span>
                  <span style={{ color: "#818cf8", fontSize: 11 }}>
                    surprise {typeof h.surprise_prior === "number" ? h.surprise_prior.toFixed(2) : str(h.surprise_prior, "?")}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "#d4d4d8", lineHeight: 1.6, marginBottom: 6 }}>
                  {str(h.text)}
                </p>
                {h.test_strategy != null && (
                  <p style={{ fontSize: 11, color: "#52525b" }}>{str(h.test_strategy)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Experiments ── */}
      {experiments.length > 0 && (
        <div>
          <div className="section-head">
            <span className="title">Experiment Results</span>
            <span className="subtitle">Statistical tests run on each hypothesis</span>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            {experiments.map((exp, i) => {
              const pval = num(exp.p_value, 1);
              const d    = num(exp.effect_size, 0);
              const sig  = pval < 0.05;
              return (
                <div key={i} className="card-sm" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{
                    width: 4, flexShrink: 0, borderRadius: 2,
                    background: sig ? "#22c55e" : "#3f3f46",
                    alignSelf: "stretch", marginTop: 2
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: "#d4d4d8", marginBottom: 6 }}>
                      {str(exp.hypothesis, str(exp.finding))}
                    </p>
                    <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: sig ? "#4ade80" : "#f87171", fontFamily: "monospace" }}>
                        p = {pval.toFixed(4)}
                      </span>
                      <span style={{ fontSize: 11, color: "#71717a", fontFamily: "monospace" }}>
                        d = {d.toFixed(2)}
                      </span>
                      {exp.statistic != null && (
                        <span style={{ fontSize: 11, color: "#52525b", fontFamily: "monospace" }}>
                          stat = {num(exp.statistic).toFixed(3)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Validations ── */}
      {validations.length > 0 && (
        <div>
          <div className="section-head">
            <span className="title">Skeptic Gauntlet</span>
            <span className="subtitle">{validations.length} finding{validations.length !== 1 ? "s" : ""} evaluated across 5 checks — FDR, Confounders, Temporal Stability, Holdout, Effect Size</span>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {validations.map((val, i) => {
              const grade = str(val.grade, "C");
              const gc    = gradeColors(grade);
              const checks = Array.isArray(val.checks) ? val.checks as Array<{ name: string; result: string; reason: string }> : [];
              const killed = grade === "C";

              return (
                <div key={i} className="card" style={{ borderColor: gc.border }}>
                  {/* Finding header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                    <p style={{ fontSize: 13, color: "#e4e4e7", lineHeight: 1.5, flex: 1 }}>
                      {str(val.hypothesis, str(val.finding, `Finding ${i + 1}`))}
                    </p>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{
                        fontSize: 22, fontWeight: 800, color: gc.color,
                        fontFamily: "monospace", lineHeight: 1
                      }}>
                        {grade}
                      </div>
                      <div style={{ fontSize: 10, color: "#52525b", marginTop: 2 }}>
                        {killed ? "archived" : "validated"}
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid-3" style={{ gap: 6, marginBottom: 12 }}>
                    {[
                      { label: "Surprise",    val: num(val.surprise_score).toFixed(2), color: "#818cf8" },
                      { label: "p-value",     val: num(val.p_value, 1).toFixed(4),     color: num(val.p_value, 1) < 0.05 ? "#4ade80" : "#f87171" },
                      { label: "Effect (d)",  val: Math.abs(num(val.effect_size)).toFixed(2), color: "#a78bfa" },
                    ].map(stat => (
                      <div key={stat.label} className="stat-box">
                        <div className="stat-val" style={{ color: stat.color, fontSize: 15 }}>{stat.val}</div>
                        <div className="stat-key">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Checks */}
                  {checks.length > 0 && (
                    <div className="row" style={{ flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                      {checks.map((chk, j) => (
                        <span
                          key={j}
                          className={`badge ${chk.result === "PASS" ? "badge-pass" : "badge-fail"}`}
                          title={chk.reason}
                          style={{ cursor: "help" }}
                        >
                          {chk.result === "PASS" ? "✓" : "✕"} {chk.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Interpretation */}
                  {val.interpretation != null && (
                    <p style={{ fontSize: 12, color: "#71717a", lineHeight: 1.6 }}>
                      {str(val.interpretation)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Stats mini charts ── */}
      {allFindings.length > 1 && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <p className="label">Findings at a glance</p>
            <span style={{ fontSize: 11, color: "#3f3f46" }}>{allFindings.length} findings evaluated</span>
          </div>
          <div className="grid-3" style={{ gap: 16 }}>
            {[
              { label: "Surprise score", desc: "How unexpected each finding is (higher = more surprising)", values: surpriseVals, color: "#6366f1" },
              { label: "p-value",        desc: "Statistical significance — below 0.05 is significant",     values: pVals,       color: "#22c55e" },
              { label: "Effect size |d|", desc: "Practical significance (Cohen's d — above 0.3 is real)",  values: effectVals,  color: "#a78bfa" },
            ].map(({ label, desc, values, color }) => (
              <div key={label}>
                <p style={{ fontSize: 12, color: "#a1a1aa", fontWeight: 600, marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: 11, color: "#3f3f46", marginBottom: 8, lineHeight: 1.4 }}>{desc}</p>
                <MiniBar values={values} color={color} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "#3f3f46" }}>
                  <span>min {Math.min(...values).toFixed(2)}</span>
                  <span>max {Math.max(...values).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Knowledge Graph ── */}
      {validations.length > 0 && hypotheses.length > 0 && (
        <KnowledgeGraph hypotheses={hypotheses} validations={validations} />
      )}

      {/* ── Google Sheets ── */}
      {sheetsResult?.url && (
        <div className="card" style={{ borderColor: "rgba(34,197,94,0.2)" }}>
          <div className="row" style={{ gap: 10 }}>
            <span style={{ fontSize: 18 }}>📊</span>
            <div>
              <p style={{ fontSize: 13, color: "#4ade80", fontWeight: 500 }}>Pushed to Google Sheets</p>
              <a
                href={sheetsResult.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: "#71717a", textDecoration: "underline" }}
              >
                Open spreadsheet →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Final report ── */}
      {report && (
        <div>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 14 }}>
            <p className="label" style={{ color: "#34d399" }}>Final report</p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-outline" onClick={handleExportCsv} style={{ fontSize: 12, padding: "5px 12px" }}>
                ↓ CSV
              </button>
              <button className="btn btn-outline" onClick={handleExportReport} style={{ fontSize: 12, padding: "5px 12px" }}>
                ↓ HTML Report
              </button>
            </div>
          </div>
          <div className="card" style={{ borderColor: "rgba(52,211,153,0.15)" }}>
            <MarkdownReport text={report} />
          </div>
        </div>
      )}

      {/* ── Loading state ── */}
      {!report && currentStage !== "error" && currentStage !== "idle" && currentStage !== "done" && (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            border: "2px solid #3f3f46", borderTopColor: "#6366f1",
            animation: "spin 0.8s linear infinite",
            margin: "0 auto 12px"
          }} />
          <p style={{ color: "#52525b", fontSize: 13 }}>
            Running {currentStage}...
          </p>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
