"use client";

import React from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";

export interface ChartData {
  type: "bar" | "grouped-bar" | "line" | "multi-line" | "forest";
  title: string;
  data: Record<string, unknown>[];
  config: Record<string, unknown>;
}

const C = {
  indigo:  "#6366f1",
  green:   "#34d399",
  red:     "#f87171",
  amber:   "#fbbf24",
  gray:    "#71717a",
  zinc400: "#a1a1aa",
  zinc800: "#27272a",
  zinc900: "#18181b",
};

const BAR_COLORS = [C.indigo, C.green, C.red, C.amber];

const TT: React.CSSProperties = {
  backgroundColor: "#1c1c1e",
  border: "1px solid #3f3f46",
  borderRadius: 6,
  color: "#e4e4e7",
  fontSize: 12,
};

function GroupedBar({ chart }: { chart: ChartData }) {
  const keys  = (chart.config.keys as string[]) || [];
  const xKey  = (chart.config.xKey as string) || "segment";
  const yLabel = (chart.config.yLabel as string) || "";
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chart.data} margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.zinc800} />
        <XAxis dataKey={xKey} tick={{ fill: C.zinc400, fontSize: 11 }} axisLine={{ stroke: C.zinc800 }} tickLine={false} />
        <YAxis tick={{ fill: C.zinc400, fontSize: 11 }} axisLine={{ stroke: C.zinc800 }} tickLine={false}
          label={{ value: yLabel, angle: -90, position: "insideLeft", fill: C.zinc400, fontSize: 11, dy: 40 }}
          tickFormatter={(v) => (typeof v === "number" ? v.toFixed(2) : String(v))} />
        <Tooltip contentStyle={TT} formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(3) : String(v))} />
        <Legend wrapperStyle={{ color: C.zinc400, fontSize: 11, paddingTop: 8 }} />
        {keys.map((k, i) => (
          <Bar key={k} dataKey={k} fill={BAR_COLORS[i % BAR_COLORS.length]} radius={[3, 3, 0, 0]} maxBarSize={60} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function TimeSeries({ chart }: { chart: ChartData }) {
  const xKey   = (chart.config.xKey as string) || "x";
  const valKey = (chart.config.valueKey as string) || "value";
  const xLabel = (chart.config.xLabel as string) || "";
  const yLabel = (chart.config.yLabel as string) || "";
  const cps    = (chart.config.changepoints as number[]) || [];
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chart.data} margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.zinc800} />
        <XAxis dataKey={xKey} tick={{ fill: C.zinc400, fontSize: 11 }} axisLine={{ stroke: C.zinc800 }} tickLine={false}
          label={{ value: xLabel, position: "insideBottom", fill: C.zinc400, fontSize: 11, dy: 20 }} />
        <YAxis tick={{ fill: C.zinc400, fontSize: 11 }} axisLine={{ stroke: C.zinc800 }} tickLine={false}
          label={{ value: yLabel, angle: -90, position: "insideLeft", fill: C.zinc400, fontSize: 11, dy: 40 }}
          tickFormatter={(v) => (typeof v === "number" ? v.toFixed(2) : String(v))} />
        <Tooltip contentStyle={TT} formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(4) : String(v))} />
        {cps.map((idx, i) => {
          const pt = chart.data[idx];
          if (!pt) return null;
          return <ReferenceLine key={i} x={pt[xKey] as number | string} stroke={C.amber} strokeDasharray="4 2"
            label={{ value: "CP", position: "top", fill: C.amber, fontSize: 9 }} />;
        })}
        <Line type="monotone" dataKey={valKey} stroke={C.indigo} strokeWidth={2}
          dot={(props: Record<string, unknown>) => {
            const { cx, cy, payload } = props as { cx: number; cy: number; payload: Record<string, unknown> };
            if (payload.isAnomaly) return <circle key={`a-${cx}`} cx={cx} cy={cy} r={4} fill={C.red} stroke={C.red} />;
            return <circle key={`d-${cx}`} cx={cx} cy={cy} r={0} fill="none" />;
          }}
          activeDot={{ r: 4, fill: C.indigo }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function MultiLine({ chart }: { chart: ChartData }) {
  const xKey    = (chart.config.xKey as string) || "x";
  const lines   = (chart.config.lineKeys as string[]) || [];
  const xLabel  = (chart.config.xLabel as string) || "";
  const yLabel  = (chart.config.yLabel as string) || "";
  const cps     = (chart.config.changepoints as number[]) || [];
  const spikes  = (chart.config.gradientSpikes as number[]) || [];
  const lColors = [C.indigo, C.green, C.amber, C.red];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chart.data} margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.zinc800} />
        <XAxis dataKey={xKey} tick={{ fill: C.zinc400, fontSize: 11 }} axisLine={{ stroke: C.zinc800 }} tickLine={false}
          label={{ value: xLabel, position: "insideBottom", fill: C.zinc400, fontSize: 11, dy: 20 }} />
        <YAxis tick={{ fill: C.zinc400, fontSize: 11 }} axisLine={{ stroke: C.zinc800 }} tickLine={false}
          label={{ value: yLabel, angle: -90, position: "insideLeft", fill: C.zinc400, fontSize: 11, dy: 40 }}
          tickFormatter={(v) => (typeof v === "number" ? v.toFixed(1) : String(v))} />
        <Tooltip contentStyle={TT}
          formatter={(v: unknown, name: unknown) => [typeof v === "number" ? v.toFixed(4) : String(v), String(name ?? "")]} />
        <Legend wrapperStyle={{ color: C.zinc400, fontSize: 11, paddingTop: 8 }} />
        {cps.map((idx, i) => { const pt = chart.data[idx]; if (!pt) return null;
          return <ReferenceLine key={`cp-${i}`} x={pt[xKey] as number | string} stroke={C.amber} strokeDasharray="4 2"
            label={{ value: "▲", position: "top", fill: C.amber, fontSize: 9 }} />; })}
        {spikes.map((idx, i) => { const pt = chart.data[idx]; if (!pt) return null;
          return <ReferenceLine key={`sp-${i}`} x={pt[xKey] as number | string} stroke={C.red} strokeDasharray="2 3" strokeOpacity={0.6} />; })}
        {lines.map((k, i) => (
          <Line key={k} type="monotone" dataKey={k} stroke={lColors[i % lColors.length]} strokeWidth={2}
            dot={false} activeDot={{ r: 3, fill: lColors[i % lColors.length] }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function ForestPlot({ chart }: { chart: ChartData }) {
  const xKey = (chart.config.xKey as string) || "cohensD";
  const yKey = (chart.config.yKey as string) || "endpoint";
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, chart.data.length * 36 + 60)}>
      <BarChart data={chart.data} layout="vertical" margin={{ top: 8, right: 56, bottom: 8, left: 130 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.zinc800} horizontal={false} />
        <XAxis type="number" tick={{ fill: C.zinc400, fontSize: 11 }} axisLine={{ stroke: C.zinc800 }} tickLine={false}
          label={{ value: "Cohen's d", position: "insideBottom", fill: C.zinc400, fontSize: 11, dy: 16 }}
          tickFormatter={(v) => (typeof v === "number" ? v.toFixed(2) : String(v))} />
        <YAxis type="category" dataKey={yKey} tick={{ fill: C.zinc400, fontSize: 10 }}
          axisLine={{ stroke: C.zinc800 }} tickLine={false} width={125} />
        <Tooltip contentStyle={TT}
          content={(tp) => {
            if (!tp.active || !tp.payload?.length) return null;
            const e = tp.payload[0];
            const d = typeof e.value === "number" ? e.value.toFixed(3) : e.value;
            const pv = (e.payload as Record<string, unknown>)?.pValue;
            const p = typeof pv === "number" ? pv.toFixed(4) : "?";
            return (
              <div style={{ ...TT, padding: "8px 12px" }}>
                <p style={{ fontWeight: 600, marginBottom: 2 }}>{String((e.payload as Record<string, unknown>)?.endpoint ?? "")}</p>
                <p>d = {String(d)}, p = {p}</p>
              </div>
            );
          }} />
        <ReferenceLine x={0} stroke={C.gray} strokeWidth={1} />
        <Bar dataKey={xKey} radius={[0, 3, 3, 0]} maxBarSize={20}>
          {chart.data.map((entry, i) => (
            <Cell key={`cell-${i}`}
              fill={entry.color === "green" ? C.green : entry.color === "red" ? C.red : C.gray} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function getCaption(chart: ChartData): string {
  const keys  = (chart.config.keys as string[]) || [];
  const xKey  = (chart.config.xKey as string) || "";
  const yKey  = (chart.config.yKey as string) || "";
  const cps   = ((chart.config.changepoints as number[]) || []).length;
  const spks  = ((chart.config.gradientSpikes as number[]) || []).length;
  const n     = chart.data.length;

  if (chart.type === "grouped-bar" || chart.type === "bar") {
    const groups = keys.length > 0 ? keys.join(", ") : "groups";
    return `Grouped bar chart comparing ${groups} across ${n} ${xKey || "categories"}. Each cluster shows the value for one category, coloured by group — useful for spotting where one group consistently out- or under-performs another.`;
  }
  if (chart.type === "line") {
    const cpNote = cps > 0 ? ` ${cps} changepoint${cps > 1 ? "s" : ""} (amber dashed lines) mark where the distribution shifts significantly.` : "";
    return `Time-series line chart of ${n} observations.${cpNote} Red dots indicate statistical anomalies (z-score outliers). The trend shows how the metric evolves over time.`;
  }
  if (chart.type === "multi-line") {
    const spkNote = spks > 0 ? ` ${spks} gradient spike${spks > 1 ? "s" : ""} highlighted in red.` : "";
    const cpNote  = cps > 0  ? ` ${cps} changepoint${cps > 1 ? "s" : ""} marked in amber.` : "";
    return `Multi-line chart showing how multiple metrics evolve together over ${n} time steps.${cpNote}${spkNote} Divergence between lines reveals phase transitions or structural breaks.`;
  }
  if (chart.type === "forest") {
    const sig   = chart.data.filter(d => d.color === "green").length;
    const total = chart.data.length;
    return `Forest plot (effect-size chart) showing Cohen's d for each of ${total} endpoints. Green bars (${sig}/${total}) are statistically significant (p < 0.05). Bars to the right of zero indicate a positive effect; bars crossing zero are non-significant. The further a bar extends, the larger the practical effect.`;
  }
  return `${chart.type} chart — ${n} data points across ${xKey || yKey || "variables"}.`;
}

export default function DiscoveryChart({ chart }: { chart: ChartData }) {
  const caption = getCaption(chart);
  return (
    <div style={{
      background: "#18181b", border: "1px solid #27272a",
      borderRadius: 10, padding: "16px 18px", marginTop: 10,
    }}>
      {/* Title */}
      <p style={{ fontSize: 11, fontWeight: 700, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
        {chart.title}
      </p>
      {(chart.type === "grouped-bar" || chart.type === "bar") && <GroupedBar chart={chart} />}
      {chart.type === "line"       && <TimeSeries chart={chart} />}
      {chart.type === "multi-line" && <MultiLine chart={chart} />}
      {chart.type === "forest"     && <ForestPlot chart={chart} />}
      {/* Caption */}
      <p style={{
        marginTop: 12, fontSize: 12, color: "#52525b", lineHeight: 1.65,
        borderTop: "1px solid #1f1f22", paddingTop: 10,
      }}>
        {caption}
      </p>
    </div>
  );
}
