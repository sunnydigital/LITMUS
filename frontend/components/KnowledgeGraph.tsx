"use client";

interface KnowledgeGraphProps {
  hypotheses: Record<string, unknown>[];
  validations: Record<string, unknown>[];
}

function str(v: unknown, fallback = ""): string {
  return v == null ? fallback : String(v);
}
function num(v: unknown, fallback = 0): number {
  return typeof v === "number" ? v : Number(v) || fallback;
}

const GRADE_STYLE: Record<string, { fill: string; stroke: string; text: string; label: string }> = {
  A: { fill: "rgba(34,197,94,0.12)",  stroke: "#22c55e", text: "#4ade80", label: "Validated" },
  B: { fill: "rgba(250,204,21,0.1)",  stroke: "#ca8a04", text: "#facc15", label: "Validated" },
  C: { fill: "rgba(248,113,113,0.08)",stroke: "#7f1d1d", text: "#f87171", label: "Archived"  },
};

// Wrap text into lines of maxLen chars, up to maxLines
function wrapText(text: string, maxLen = 32, maxLines = 3): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (lines.length >= maxLines) break;
    const next = cur ? cur + " " + w : w;
    if (next.length > maxLen && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  // Truncate last line with ellipsis if text was cut
  if (lines.length === maxLines && text.length > lines.join(" ").length + 3) {
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, maxLen - 3) + "...";
  }
  return lines;
}

const CHECK_LABELS = ["FDR", "Conf", "Temp", "Hold", "Eff"];

export default function KnowledgeGraph({ hypotheses, validations }: KnowledgeGraphProps) {
  const n = Math.max(hypotheses.length, validations.length);
  if (n === 0) return null;

  // ── Layout constants ──────────────────────────────────────────────────────
  const ROW_H   = 100;       // px per row — enough breathing room
  const PAD_TOP = 40;        // top padding
  const PAD_BOT = 36;        // bottom (for column labels)
  const W       = 860;       // total SVG width
  const H       = PAD_TOP + n * ROW_H + PAD_BOT;

  // Column centres
  const DS_X  = 72;          // dataset node
  const HYP_X = 280;         // hypothesis box centre
  const VAL_X = 620;         // validation card centre

  // Hypothesis box
  const HYP_W = 200;
  const HYP_H = (lines: string[]) => lines.length * 14 + 26;

  // Validation card
  const VAL_W = 200;
  const VAL_H = 72;

  const centerY = PAD_TOP + ((n - 1) * ROW_H) / 2;

  const rows = Array.from({ length: n }, (_, i) => {
    const hyp   = hypotheses[i];
    const val   = validations[i];
    const grade = val ? str(val.grade, "C") : null;
    const gs    = grade ? (GRADE_STYLE[grade] ?? GRADE_STYLE["C"]) : null;
    const y     = PAD_TOP + i * ROW_H + ROW_H / 2;
    return { i, hyp, val, grade, gs, y };
  });

  return (
    <div
      className="card"
      style={{ padding: 0, overflow: "hidden" }}
    >
      {/* Legend */}
      <div style={{
        padding: "10px 16px",
        borderBottom: "1px solid #1f1f22",
        display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 11, color: "#3f3f46", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Knowledge Graph
        </span>
        {Object.entries(GRADE_STYLE).map(([g, s]) => (
          <span key={g} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#71717a" }}>
            <span style={{
              width: 10, height: 10, borderRadius: 2,
              background: s.fill, border: `1px solid ${s.stroke}`,
              display: "inline-block",
            }} />
            Grade {g} — {s.label}
          </span>
        ))}
        <span style={{ fontSize: 11, color: "#3f3f46", marginLeft: "auto" }}>
          {CHECK_LABELS.join(" · ")} checks
        </span>
      </div>

      {/* Scrollable SVG container */}
      <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 560 }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          style={{ display: "block", minWidth: W }}
        >
          <defs>
            <filter id="kg-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <linearGradient id="kg-gr-A" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="kg-gr-B" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#facc15" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="kg-gr-C" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f87171" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {/* Subtle horizontal row separators */}
          {rows.map(({ y }) => (
            <line key={`row-${y}`}
              x1={0} y1={y + ROW_H / 2} x2={W} y2={y + ROW_H / 2}
              stroke="#1a1a1d" strokeWidth={1} />
          ))}

          {/* ── Dataset node ── */}
          <rect
            x={DS_X - 44} y={centerY - 26}
            width={88} height={52}
            rx={10}
            fill="rgba(99,102,241,0.14)"
            stroke="#6366f1" strokeWidth={1.5}
            filter="url(#kg-glow)"
          />
          <text x={DS_X} y={centerY - 8}
            textAnchor="middle" fill="#818cf8"
            fontSize={8} fontWeight="800" letterSpacing="1.2">
            DATASET
          </text>
          <text x={DS_X} y={centerY + 10}
            textAnchor="middle" fill="#6366f1"
            fontSize={16} fontWeight="800">
            ◈
          </text>

          {/* ── Edges: dataset → hypothesis ── */}
          {rows.map(({ y }) => {
            // Curved bezier from dataset right edge to hyp left edge
            const x1 = DS_X + 44;
            const x2 = HYP_X - HYP_W / 2;
            const cx1 = x1 + (x2 - x1) * 0.5;
            return (
              <path key={`de-${y}`}
                d={`M${x1},${centerY} C${cx1},${centerY} ${cx1},${y} ${x2},${y}`}
                fill="none"
                stroke="#6366f1" strokeWidth={0.8} strokeOpacity={0.25}
                className="kg-edge"
              />
            );
          })}

          {/* ── Hypothesis nodes ── */}
          {rows.map(({ i, hyp, y }) => {
            if (!hyp) return null;
            const text  = str(hyp.text, `Hypothesis ${i + 1}`);
            const lines = wrapText(text, 30, 3);
            const bH    = HYP_H(lines);
            const bX    = HYP_X - HYP_W / 2;
            const bY    = y - bH / 2;
            return (
              <g key={`hyp-${i}`}>
                <rect x={bX} y={bY} width={HYP_W} height={bH}
                  rx={7} fill="#18181b" stroke="#2e2e35" strokeWidth={1} />
                {/* H-number badge */}
                <rect x={bX + 6} y={bY + 6} width={20} height={14} rx={3}
                  fill="#27272a" />
                <text x={bX + 16} y={bY + 16}
                  textAnchor="middle" fill="#52525b" fontSize={8} fontWeight="800">
                  H{i + 1}
                </text>
                {/* Text lines */}
                {lines.map((line, li) => (
                  <text key={li}
                    x={HYP_X} y={bY + 24 + li * 15}
                    textAnchor="middle" fill="#a1a1aa" fontSize={10}>
                    {line}
                  </text>
                ))}
                {/* Surprise score */}
                {hyp.surprise_prior != null && (
                  <text x={bX + HYP_W - 6} y={bY + 15}
                    textAnchor="end" fill="#4f46e5" fontSize={8} fontWeight="600">
                    ↑{num(hyp.surprise_prior).toFixed(2)}
                  </text>
                )}
              </g>
            );
          })}

          {/* ── Edges: hypothesis → validation ── */}
          {rows.map(({ i, y, grade }) => {
            if (!grade) return null;
            const x1 = HYP_X + HYP_W / 2;
            const x2 = VAL_X - VAL_W / 2;
            const cx = x1 + (x2 - x1) * 0.5;
            return (
              <path key={`ve-${i}`}
                d={`M${x1},${y} C${cx},${y} ${cx},${y} ${x2},${y}`}
                fill="none"
                stroke={`url(#kg-gr-${grade})`} strokeWidth={1.5}
                className="kg-edge"
              />
            );
          })}

          {/* ── Validation cards ── */}
          {rows.map(({ i, val, grade, gs, y }) => {
            if (!val || !gs) return null;
            const checks  = Array.isArray(val.checks)
              ? val.checks as Array<{ name: string; result: string }>
              : [];
            const surprise = num(val.surprise_score).toFixed(2);
            const pval     = num(val.p_value, 1);
            const effect   = Math.abs(num(val.effect_size)).toFixed(2);
            const killed   = grade === "C";
            const bX       = VAL_X - VAL_W / 2;
            const bY       = y - VAL_H / 2;

            return (
              <g key={`val-${i}`}>
                {/* Card background */}
                <rect x={bX} y={bY} width={VAL_W} height={VAL_H}
                  rx={8}
                  fill={gs.fill}
                  stroke={gs.stroke}
                  strokeWidth={killed ? 0.8 : 1.5}
                  strokeDasharray={killed ? "4 3" : undefined}
                />

                {/* Grade letter */}
                <text x={bX + 18} y={bY + 26}
                  textAnchor="middle" fill={gs.text}
                  fontSize={22} fontWeight="800">
                  {grade}
                </text>

                {/* Status label */}
                <text x={bX + 18} y={bY + 40}
                  textAnchor="middle" fill={gs.text}
                  fontSize={7} opacity={0.7} fontWeight="600" letterSpacing="0.5">
                  {gs.label.toUpperCase()}
                </text>

                {/* Divider */}
                <line x1={bX + 36} y1={bY + 8} x2={bX + 36} y2={bY + VAL_H - 8}
                  stroke={gs.stroke} strokeWidth={0.5} strokeOpacity={0.3} />

                {/* Stats */}
                <text x={bX + 50} y={bY + 18} fill="#71717a" fontSize={8}>surp</text>
                <text x={bX + 74} y={bY + 18} fill={gs.text} fontSize={9} fontWeight="700"
                  textAnchor="end">{surprise}</text>

                <text x={bX + 50} y={bY + 31} fill="#71717a" fontSize={8}>p-val</text>
                <text x={bX + 74} y={bY + 31}
                  fill={pval < 0.05 ? "#4ade80" : "#f87171"} fontSize={9} fontWeight="700"
                  textAnchor="end">{pval.toFixed(4)}</text>

                <text x={bX + 50} y={bY + 44} fill="#71717a" fontSize={8}>|d|</text>
                <text x={bX + 74} y={bY + 44} fill="#a78bfa" fontSize={9} fontWeight="700"
                  textAnchor="end">{effect}</text>

                {/* Check circles with labels */}
                {checks.slice(0, 5).map((chk, ci) => {
                  const pass  = chk.result === "PASS";
                  const cx_   = bX + 88 + ci * 23;
                  const cy_   = bY + VAL_H / 2;
                  return (
                    <g key={ci}>
                      <circle
                        cx={cx_} cy={cy_ - 6} r={8}
                        fill={pass ? "rgba(34,197,94,0.15)" : "rgba(248,113,113,0.1)"}
                        stroke={pass ? "#22c55e" : "#ef4444"} strokeWidth={1}
                      />
                      <text x={cx_} y={cy_ - 3}
                        textAnchor="middle"
                        fill={pass ? "#22c55e" : "#ef4444"}
                        fontSize={9} fontWeight="700">
                        {pass ? "✓" : "✕"}
                      </text>
                      <text x={cx_} y={cy_ + 10}
                        textAnchor="middle" fill="#3f3f46" fontSize={7}>
                        {CHECK_LABELS[ci]}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* ── Column labels ── */}
          {[
            { x: DS_X,  label: "Source" },
            { x: HYP_X, label: "Hypotheses" },
            { x: VAL_X, label: "Skeptic Verdict" },
          ].map(({ x, label }) => (
            <text key={label} x={x} y={H - 10}
              textAnchor="middle" fill="#2e2e35"
              fontSize={9} fontWeight="700" letterSpacing="0.1em">
              {label.toUpperCase()}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
