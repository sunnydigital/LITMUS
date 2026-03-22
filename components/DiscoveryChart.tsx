"use client";

/**
 * DiscoveryChart
 *
 * Renders inline charts for LITMUS discoveries using Recharts.
 * Supports: grouped-bar, line (with changepoints/anomalies), forest (horizontal bar).
 *
 * Dark theme matching the app:
 *   - Axis text: #a1a1aa (zinc-400)
 *   - Grid lines: #27272a (zinc-800)
 *   - Bar colors: indigo, green, red, amber
 *   - Tooltip: dark bg, light text
 */

import React from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";

// ---- Types ----

export interface ChartData {
  type: "bar" | "grouped-bar" | "line" | "multi-line" | "forest";
  title: string;
  data: Record<string, unknown>[];
  config: Record<string, unknown>;
}

interface DiscoveryChartProps {
  chart: ChartData;
}

// ---- Theme ----

const COLORS = {
  indigo: "#6366f1",
  green: "#34d399",
  red: "#f87171",
  amber: "#fbbf24",
  gray: "#71717a",
  zinc400: "#a1a1aa",
  zinc800: "#27272a",
  zinc900: "#18181b",
};

const BAR_COLORS = [COLORS.indigo, COLORS.green, COLORS.red, COLORS.amber];

const DARK_TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "#1c1c1e",
  border: "1px solid #3f3f46",
  borderRadius: "6px",
  color: "#e4e4e7",
  fontSize: "12px",
};

// ---- Sub-components ----

function GroupedBarChart({ chart }: { chart: ChartData }) {
  const keys = (chart.config.keys as string[]) || [];
  const xKey = (chart.config.xKey as string) || "segment";
  const yLabel = (chart.config.yLabel as string) || "";

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chart.data} margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.zinc800} />
        <XAxis
          dataKey={xKey}
          tick={{ fill: COLORS.zinc400, fontSize: 11 }}
          axisLine={{ stroke: COLORS.zinc800 }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: COLORS.zinc400, fontSize: 11 }}
          axisLine={{ stroke: COLORS.zinc800 }}
          tickLine={false}
          label={{ value: yLabel, angle: -90, position: "insideLeft", fill: COLORS.zinc400, fontSize: 11, dy: 40 }}
          tickFormatter={(v) => (typeof v === "number" ? v.toFixed(2) : String(v))}
        />
        <Tooltip contentStyle={DARK_TOOLTIP_STYLE} formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(3) : String(v))} />
        <Legend
          wrapperStyle={{ color: COLORS.zinc400, fontSize: "11px", paddingTop: "8px" }}
        />
        {keys.map((key, i) => (
          <Bar key={key} dataKey={key} fill={BAR_COLORS[i % BAR_COLORS.length]} radius={[3, 3, 0, 0]} maxBarSize={60} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function TimeSeriesLineChart({ chart }: { chart: ChartData }) {
  const xKey = (chart.config.xKey as string) || "x";
  const valueKey = (chart.config.valueKey as string) || "value";
  const xLabel = (chart.config.xLabel as string) || "";
  const yLabel = (chart.config.yLabel as string) || "";
  const changepoints = (chart.config.changepoints as number[]) || [];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={chart.data} margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.zinc800} />
        <XAxis
          dataKey={xKey}
          tick={{ fill: COLORS.zinc400, fontSize: 11 }}
          axisLine={{ stroke: COLORS.zinc800 }}
          tickLine={false}
          label={{ value: xLabel, position: "insideBottom", fill: COLORS.zinc400, fontSize: 11, dy: 20 }}
        />
        <YAxis
          tick={{ fill: COLORS.zinc400, fontSize: 11 }}
          axisLine={{ stroke: COLORS.zinc800 }}
          tickLine={false}
          label={{ value: yLabel, angle: -90, position: "insideLeft", fill: COLORS.zinc400, fontSize: 11, dy: 40 }}
          tickFormatter={(v) => (typeof v === "number" ? v.toFixed(2) : String(v))}
        />
        <Tooltip contentStyle={DARK_TOOLTIP_STYLE} formatter={(v: unknown) => (typeof v === "number" ? v.toFixed(4) : String(v))} />
        {changepoints.map((cpIdx, i) => {
          const cpPoint = chart.data[cpIdx];
          if (!cpPoint) return null;
          const xVal = cpPoint[xKey];
          return (
            <ReferenceLine
              key={i}
              x={xVal as number | string}
              stroke={COLORS.amber}
              strokeDasharray="4 2"
              label={{ value: "CP", position: "top", fill: COLORS.amber, fontSize: 9 }}
            />
          );
        })}
        <Line
          type="monotone"
          dataKey={valueKey}
          stroke={COLORS.indigo}
          strokeWidth={2}
          dot={(props: Record<string, unknown>) => {
            const { cx, cy, payload } = props as { cx: number; cy: number; payload: Record<string, unknown> };
            if (payload.isAnomaly) {
              return <circle key={`anomaly-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={COLORS.red} stroke={COLORS.red} />;
            }
            return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={0} fill="none" />;
          }}
          activeDot={{ r: 4, fill: COLORS.indigo }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function MultiLineChart({ chart }: { chart: ChartData }) {
  const xKey = (chart.config.xKey as string) || "x";
  const lineKeys = (chart.config.lineKeys as string[]) || [];
  const xLabel = (chart.config.xLabel as string) || "";
  const yLabel = (chart.config.yLabel as string) || "";
  const changepoints = (chart.config.changepoints as number[]) || [];
  const gradientSpikes = (chart.config.gradientSpikes as number[]) || [];

  const lineColors = [COLORS.indigo, COLORS.green, COLORS.amber, COLORS.red];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chart.data} margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.zinc800} />
        <XAxis
          dataKey={xKey}
          tick={{ fill: COLORS.zinc400, fontSize: 11 }}
          axisLine={{ stroke: COLORS.zinc800 }}
          tickLine={false}
          label={{ value: xLabel, position: "insideBottom", fill: COLORS.zinc400, fontSize: 11, dy: 20 }}
        />
        <YAxis
          tick={{ fill: COLORS.zinc400, fontSize: 11 }}
          axisLine={{ stroke: COLORS.zinc800 }}
          tickLine={false}
          label={{ value: yLabel, angle: -90, position: "insideLeft", fill: COLORS.zinc400, fontSize: 11, dy: 40 }}
          tickFormatter={(v) => (typeof v === "number" ? v.toFixed(1) : String(v))}
        />
        <Tooltip contentStyle={DARK_TOOLTIP_STYLE} formatter={(v: unknown, name: unknown) => [typeof v === "number" ? v.toFixed(4) : String(v), String(name ?? "")]} />
        <Legend wrapperStyle={{ color: COLORS.zinc400, fontSize: "11px", paddingTop: "8px" }} />
        {changepoints.map((cpIdx, i) => {
          const cpPoint = chart.data[cpIdx];
          if (!cpPoint) return null;
          return (
            <ReferenceLine
              key={`cp-${i}`}
              x={cpPoint[xKey] as number | string}
              stroke={COLORS.amber}
              strokeDasharray="4 2"
              label={{ value: "▲", position: "top", fill: COLORS.amber, fontSize: 9 }}
            />
          );
        })}
        {gradientSpikes.map((spIdx, i) => {
          const spPoint = chart.data[spIdx];
          if (!spPoint) return null;
          return (
            <ReferenceLine
              key={`spike-${i}`}
              x={spPoint[xKey] as number | string}
              stroke={COLORS.red}
              strokeDasharray="2 3"
              strokeOpacity={0.6}
            />
          );
        })}
        {lineKeys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={lineColors[i % lineColors.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: lineColors[i % lineColors.length] }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function ForestPlotChart({ chart }: { chart: ChartData }) {
  const xKey = (chart.config.xKey as string) || "cohensD";
  const yKey = (chart.config.yKey as string) || "endpoint";

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, chart.data.length * 36 + 60)}>
      <BarChart
        data={chart.data}
        layout="vertical"
        margin={{ top: 10, right: 60, bottom: 10, left: 130 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.zinc800} horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: COLORS.zinc400, fontSize: 11 }}
          axisLine={{ stroke: COLORS.zinc800 }}
          tickLine={false}
          label={{ value: "Cohen's d", position: "insideBottom", fill: COLORS.zinc400, fontSize: 11, dy: 16 }}
          tickFormatter={(v) => (typeof v === "number" ? v.toFixed(2) : String(v))}
        />
        <YAxis
          type="category"
          dataKey={yKey}
          tick={{ fill: COLORS.zinc400, fontSize: 10 }}
          axisLine={{ stroke: COLORS.zinc800 }}
          tickLine={false}
          width={125}
        />
        <Tooltip
          contentStyle={DARK_TOOLTIP_STYLE}
          content={(tooltipProps) => {
            if (!tooltipProps.active || !tooltipProps.payload?.length) return null;
            const entry = tooltipProps.payload[0];
            const d = typeof entry.value === "number" ? entry.value.toFixed(3) : entry.value;
            const pVal = (entry.payload as Record<string, unknown>)?.pValue;
            const p = typeof pVal === "number" ? pVal.toFixed(4) : "?";
            return (
              <div style={DARK_TOOLTIP_STYLE} className="px-3 py-2">
                <p className="font-medium">{String((entry.payload as Record<string, unknown>)?.endpoint ?? "")}</p>
                <p>d = {String(d)}, p = {p}</p>
              </div>
            );
          }}
        />
        <ReferenceLine x={0} stroke={COLORS.gray} strokeWidth={1} />
        <Bar dataKey={xKey} radius={[0, 3, 3, 0]} maxBarSize={20}>
          {chart.data.map((entry, index) => {
            const color =
              entry.color === "green"
                ? COLORS.green
                : entry.color === "red"
                  ? COLORS.red
                  : COLORS.gray;
            return <Cell key={`cell-${index}`} fill={color} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---- Main component ----

export default function DiscoveryChart({ chart }: DiscoveryChartProps) {
  return (
    <div className="card p-5">
      <h4 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
        {chart.title}
      </h4>
      {chart.type === "grouped-bar" && <GroupedBarChart chart={chart} />}
      {chart.type === "bar" && <GroupedBarChart chart={chart} />}
      {chart.type === "line" && <TimeSeriesLineChart chart={chart} />}
      {chart.type === "multi-line" && <MultiLineChart chart={chart} />}
      {chart.type === "forest" && <ForestPlotChart chart={chart} />}
    </div>
  );
}
