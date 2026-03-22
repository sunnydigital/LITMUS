"use client";

/**
 * KnowledgeGraph
 *
 * SVG-based knowledge graph visualising the LITMUS discovery pipeline.
 * Layout: [DATASET] → [Hypothesis nodes] → [Grade badge] → [Check circles]
 *
 * Nodes appear progressively as the pipeline runs:
 *   - Hypotheses show immediately (indigo)
 *   - Grades + checks appear once validation completes
 *   - Grade A = emerald glow, B = amber, C = red + "KILLED"
 */

import React from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface Hypothesis {
  id?: string | number;
  text: string;
  surprise_prior?: string | number;
}

interface ValidationResult {
  hypothesis: string;
  grade: string;
  checks: Array<{ name: string; result: string; reason: string }>;
  surprise_score?: string | number;
  p_value?: number;
  effect_size?: number;
}

interface ExperimentResult {
  hypothesis: string;
  test_name?: string;
  p_value?: number;
  effect_size?: number;
  supports?: boolean;
}

interface KnowledgeGraphProps {
  hypotheses: Hypothesis[];
  validations: ValidationResult[];
  experiments: ExperimentResult[];
}

// ── Palette ────────────────────────────────────────────────────────────────

const C = {
  indigo: "#6366f1",
  indigoLight: "#818cf8",
  emerald: "#34d399",
  amber: "#fbbf24",
  red: "#f87171",
  zinc400: "#a1a1aa",
  zinc600: "#52525b",
  zinc700: "#3f3f46",
  zinc800: "#27272a",
  zinc900: "#18181b",
  bg: "#09090b",
};

const GRADE_COLOR: Record<string, string> = {
  A: C.emerald,
  B: C.amber,
  C: C.red,
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Fuzzy-match a validation to a hypothesis by comparing text prefixes */
function matchValidation(
  hyp: Hypothesis,
  validations: ValidationResult[],
): ValidationResult | undefined {
  const key = hyp.text.slice(0, 50).toLowerCase();
  return validations.find((v) =>
    v.hypothesis.toLowerCase().slice(0, 50).startsWith(key.slice(0, 40)) ||
    key.startsWith(v.hypothesis.toLowerCase().slice(0, 40)),
  );
}

function matchExperiment(
  hyp: Hypothesis,
  experiments: ExperimentResult[],
): ExperimentResult | undefined {
  const key = hyp.text.slice(0, 50).toLowerCase();
  return experiments.find((e) =>
    e.hypothesis.toLowerCase().slice(0, 50).startsWith(key.slice(0, 40)) ||
    key.startsWith(e.hypothesis.toLowerCase().slice(0, 40)),
  );
}

/** Truncate to N chars */
function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

// ── Layout constants ───────────────────────────────────────────────────────

const ROW_H = 88;         // vertical spacing per hypothesis
const PAD_TOP = 56;       // top padding
const PAD_BOT = 44;       // bottom padding (legend)
const DS_X = 60;          // dataset node centre-x
const HYP_X = 230;        // hypothesis node centre-x
const GRADE_X = 410;      // grade badge centre-x
const CHECK_START_X = 445; // first check circle centre-x
const CHECK_GAP = 20;     // gap between check circles

// ── Main component ─────────────────────────────────────────────────────────

export default function KnowledgeGraph({
  hypotheses,
  validations,
  experiments,
}: KnowledgeGraphProps) {
  if (hypotheses.length === 0) return null;

  const svgH = PAD_TOP + hypotheses.length * ROW_H + PAD_BOT;
  const svgW = 620;
  const dsY = PAD_TOP + ((hypotheses.length - 1) * ROW_H) / 2; // vertically centre dataset node

  const nodes = hypotheses.map((h, i) => {
    const validation = matchValidation(h, validations);
    const experiment = matchExperiment(h, experiments);
    return {
      idx: i,
      text: h.text,
      grade: validation?.grade,
      checks: validation?.checks ?? [],
      p_value: experiment?.p_value ?? validation?.p_value,
      effect_size: experiment?.effect_size ?? validation?.effect_size,
      supports: experiment?.supports,
      surprise: h.surprise_prior,
    };
  });

  return (
    <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950/80" style={{ backdropFilter: "blur(8px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-glow" />
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-widest">
            Discovery Graph
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-600">
          {nodes.some((n) => n.grade === "A") && (
            <span className="flex items-center gap-1 text-emerald-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Survived
            </span>
          )}
          {nodes.some((n) => n.grade === "C") && (
            <span className="flex items-center gap-1 text-red-500">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              Killed
            </span>
          )}
        </div>
      </div>

      {/* SVG graph */}
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width="100%"
          style={{ minWidth: 520, maxHeight: Math.min(svgH, 520) }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Dataset node glow */}
            <filter id="kg-glow-indigo" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>

            {/* Grade glows */}
            {(["A", "B", "C"] as const).map((g) => (
              <filter key={g} id={`kg-glow-${g}`} x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            ))}

            {/* Edge gradients */}
            <linearGradient id="kg-edge-default" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={C.indigo} stopOpacity="0.7" />
              <stop offset="100%" stopColor={C.indigo} stopOpacity="0.1" />
            </linearGradient>
            {(["A", "B", "C"] as const).map((g) => (
              <linearGradient key={g} id={`kg-edge-${g}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={C.indigo} stopOpacity="0.6" />
                <stop offset="100%" stopColor={GRADE_COLOR[g]} stopOpacity="0.7" />
              </linearGradient>
            ))}
          </defs>

          {/* ── Dataset node ── */}
          <g>
            <circle
              cx={DS_X} cy={dsY} r={28}
              fill={`${C.indigo}18`}
              stroke={C.indigo}
              strokeWidth={2}
              filter="url(#kg-glow-indigo)"
            />
            <text x={DS_X} y={dsY - 5} textAnchor="middle" fill={C.indigoLight} fontSize={8} fontWeight="700" letterSpacing="1.5">DATA</text>
            <text x={DS_X} y={dsY + 8} textAnchor="middle" fill={C.indigo} fontSize={8} fontWeight="600">SET</text>
          </g>

          {/* ── Hypothesis rows ── */}
          {nodes.map((node) => {
            const hy = PAD_TOP + node.idx * ROW_H + ROW_H / 2;
            const grade = node.grade;
            const color = grade ? GRADE_COLOR[grade] : C.indigo;
            const killed = grade === "C";
            const edgeGrad = grade ? `kg-edge-${grade}` : "kg-edge-default";

            // Cubic bezier path: dataset node → hypothesis node
            const c1x = DS_X + (HYP_X - DS_X) * 0.55;
            const c2x = HYP_X - (HYP_X - DS_X) * 0.25;
            const edgePath = `M ${DS_X + 28} ${dsY} C ${c1x} ${dsY}, ${c2x} ${hy}, ${HYP_X - 24} ${hy}`;

            return (
              <g key={node.idx}>
                {/* Edge: dataset → hypothesis */}
                <path
                  d={edgePath}
                  fill="none"
                  stroke={`url(#${edgeGrad})`}
                  strokeWidth={killed ? 1 : 1.5}
                  strokeDasharray={killed ? "5 4" : undefined}
                  opacity={killed ? 0.35 : 0.85}
                  className={!killed ? "kg-edge-animated" : undefined}
                />

                {/* Hypothesis node */}
                <circle
                  cx={HYP_X} cy={hy} r={22}
                  fill={`${color}12`}
                  stroke={color}
                  strokeWidth={killed ? 1 : 1.8}
                  opacity={killed ? 0.45 : 1}
                  filter={grade && !killed ? `url(#kg-glow-${grade})` : undefined}
                />
                <text
                  x={HYP_X} y={hy + 5}
                  textAnchor="middle"
                  fill={color}
                  fontSize={12}
                  fontWeight="700"
                  opacity={killed ? 0.5 : 1}
                >
                  H{node.idx + 1}
                </text>

                {/* Hypothesis text label */}
                <text
                  x={HYP_X + 30} y={hy - 14}
                  fill={killed ? C.zinc600 : "#d4d4d8"}
                  fontSize={9}
                  opacity={killed ? 0.55 : 1}
                >
                  {trunc(node.text, 46)}
                </text>

                {/* Stats row */}
                {(node.p_value !== undefined || node.effect_size !== undefined) && (
                  <text x={HYP_X + 30} y={hy} fill={C.zinc600} fontSize={8}>
                    {node.p_value !== undefined && `p=${node.p_value.toFixed(3)}`}
                    {node.p_value !== undefined && node.effect_size !== undefined && "  "}
                    {node.effect_size !== undefined && `d=${Number(node.effect_size).toFixed(2)}`}
                  </text>
                )}

                {/* Supports indicator */}
                {node.supports !== undefined && (
                  <text x={HYP_X + 30} y={hy + 13} fill={node.supports ? C.emerald : C.red} fontSize={8} opacity={0.8}>
                    {node.supports ? "↑ supports" : "↓ rejects"}
                  </text>
                )}

                {/* Connector: hypothesis → grade badge */}
                {grade && (
                  <line
                    x1={HYP_X + 22} y1={hy}
                    x2={GRADE_X - 18} y2={hy}
                    stroke={color}
                    strokeWidth={killed ? 0.8 : 1.2}
                    strokeDasharray={killed ? "4 3" : undefined}
                    opacity={killed ? 0.3 : 0.6}
                  />
                )}

                {/* Grade badge */}
                {grade && (
                  <g opacity={killed ? 0.4 : 1} filter={!killed ? `url(#kg-glow-${grade})` : undefined}>
                    <circle
                      cx={GRADE_X} cy={hy} r={16}
                      fill={`${color}20`}
                      stroke={color}
                      strokeWidth={1.5}
                    />
                    <text
                      x={GRADE_X} y={hy + 5}
                      textAnchor="middle"
                      fill={color}
                      fontSize={13}
                      fontWeight="800"
                    >
                      {grade}
                    </text>
                  </g>
                )}

                {/* Validation check circles */}
                {node.checks.slice(0, 5).map((check, j) => {
                  const cx = CHECK_START_X + j * CHECK_GAP;
                  const passed = check.result === "PASS";
                  return (
                    <g key={j} opacity={killed ? 0.3 : 0.9}>
                      <title>{check.name}: {check.result} — {check.reason}</title>
                      <circle
                        cx={cx} cy={hy} r={7}
                        fill={passed ? `${C.emerald}25` : `${C.red}25`}
                        stroke={passed ? C.emerald : C.red}
                        strokeWidth={1}
                      />
                      <text
                        x={cx} y={hy + 4}
                        textAnchor="middle"
                        fill={passed ? C.emerald : C.red}
                        fontSize={7}
                        fontWeight="700"
                      >
                        {passed ? "✓" : "✗"}
                      </text>
                    </g>
                  );
                })}

                {/* KILLED label */}
                {killed && (
                  <text
                    x={HYP_X} y={hy + 38}
                    textAnchor="middle"
                    fill={C.red}
                    fontSize={7}
                    fontWeight="700"
                    letterSpacing="2"
                    opacity={0.65}
                  >
                    KILLED
                  </text>
                )}

                {/* Surprise score */}
                {node.surprise !== undefined && !grade && (
                  <text x={HYP_X + 30} y={hy + 13} fill={C.indigo} fontSize={8} opacity={0.7}>
                    surprise: {String(node.surprise)}
                  </text>
                )}
              </g>
            );
          })}

          {/* ── Column labels ── */}
          <text x={DS_X} y={PAD_TOP - 20} textAnchor="middle" fill={C.zinc600} fontSize={8} fontWeight="600" letterSpacing="1">SOURCE</text>
          <text x={HYP_X} y={PAD_TOP - 20} textAnchor="middle" fill={C.zinc600} fontSize={8} fontWeight="600" letterSpacing="1">HYPOTHESES</text>
          {nodes.some((n) => n.grade) && (
            <>
              <text x={GRADE_X} y={PAD_TOP - 20} textAnchor="middle" fill={C.zinc600} fontSize={8} fontWeight="600" letterSpacing="1">GRADE</text>
              <text x={CHECK_START_X + 40} y={PAD_TOP - 20} textAnchor="middle" fill={C.zinc600} fontSize={8} fontWeight="600" letterSpacing="1">CHECKS</text>
            </>
          )}

          {/* ── Legend ── */}
          <g transform={`translate(12, ${svgH - 26})`}>
            {(["A", "B", "C"] as const).map((g, i) => (
              <g key={g} transform={`translate(${i * 150}, 0)`}>
                <circle cx={6} cy={0} r={5} fill={`${GRADE_COLOR[g]}25`} stroke={GRADE_COLOR[g]} strokeWidth={1.5} />
                <text x={16} y={4} fill={C.zinc600} fontSize={8}>
                  {g === "A" ? "Grade A — survived (5/5)" : g === "B" ? "Grade B — survived (4/5)" : "Grade C — killed by skeptic"}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
