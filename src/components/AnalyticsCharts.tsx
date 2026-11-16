"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import { THEME_COLORS as UI_COLORS, CHART_COLORS } from "@/lib/designTokens";
import { AnalyticsDTO } from "@/types";
import { chartLabel, chartState, chartTotal } from "@/lib/chartData";

const CATEGORY_COLORS = CHART_COLORS;

const tooltipStyle = {
  background: UI_COLORS.surface,
  border: "1px solid " + UI_COLORS.line,
  borderRadius: 8,
  color: UI_COLORS.text,
  fontSize: 12,
};

export function CategoryChart({ data, expectedTotal }: { data: AnalyticsDTO["categoryDistribution"]; expectedTotal?: number }) {
  const state = chartState(data, expectedTotal);
  if (state !== "ready") return <ChartNotice state={state} name="grievance category"/>;
  const rows = data.map(row => ({...row, category: chartLabel(row.category, "Uncategorized")}));
  return <figure className="min-w-0 w-full" aria-label="Grievances by category">
    <ResponsiveContainer width="100%" height={220} minWidth={0}>
      <BarChart data={rows}>
        <CartesianGrid stroke={UI_COLORS.line} vertical={false} />
        <XAxis dataKey="category" stroke={UI_COLORS.muted} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke={UI_COLORS.muted} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(79,70,229,0.04)" }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    <CountLegend items={rows.map(row=>({label:row.category,count:row.count}))} total={chartTotal(rows)}/>
  </figure>;
}

export function PriorityChart({ data, expectedTotal }: { data: AnalyticsDTO["priorityDistribution"]; expectedTotal?: number }) {
  const state = chartState(data, expectedTotal);
  if (state !== "ready") return <ChartNotice state={state} name="grievance priority"/>;
  const rows = data.map(row => ({...row, priority: chartLabel(row.priority, "Unspecified priority")}));
  const colorFor: Record<string, string> = {
    Low: UI_COLORS.success,
    Medium: UI_COLORS.pending,
    High: UI_COLORS.accent,
    Critical: UI_COLORS.danger,
  };
  return <figure className="min-w-0 w-full" aria-label="Priority distribution">
    <ResponsiveContainer width="100%" height={220} minWidth={0}>
      <PieChart>
        <Pie data={rows} dataKey="count" nameKey="priority" innerRadius={50} outerRadius={80} paddingAngle={2}>
          {data.map((d, i) => (
            <Cell key={i} fill={colorFor[d.priority] || UI_COLORS.muted} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
    <CountLegend items={rows.map(row=>({label:row.priority,count:row.count}))} total={chartTotal(rows)}/>
  </figure>;
}

export function TrendChart({ data }: { data: AnalyticsDTO["trend"] }) {
  const state = chartState(data);
  if (state !== "ready") return <ChartNotice state={state} name="report trend"/>;
  return (
    <ResponsiveContainer width="100%" height={220} minWidth={0}>
      <LineChart data={data}>
        <CartesianGrid stroke={UI_COLORS.line} vertical={false} />
        <XAxis dataKey="date" stroke={UI_COLORS.muted} fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke={UI_COLORS.muted} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="count" stroke={UI_COLORS.primary} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function LocationChart({ data }: { data: AnalyticsDTO["hotspots"] }) {
  const state = chartState(data);
  if (state !== "ready") return <ChartNotice state={state} name="report location"/>;
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={220} minWidth={0}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 8 }}>
        <CartesianGrid stroke={UI_COLORS.line} horizontal={false} />
        <XAxis type="number" stroke={UI_COLORS.muted} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="location"
          stroke={UI_COLORS.muted}
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={80}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(79,70,229,0.04)" }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} fill={UI_COLORS.secondary} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ChartNotice({state,name}:{state:"empty"|"invalid"|"mismatch";name:string}) {
  return <div role={state === "empty" ? "status" : "alert"} className="h-[220px] flex items-center justify-center text-sm text-slate-soft text-center px-4">{state === "empty" ? `No ${name} data yet.` : state === "mismatch" ? "Chart totals do not match the report count. Refresh analytics." : "Chart data is invalid or unavailable. Refresh analytics."}</div>;
}
function CountLegend({items,total}:{items:{label:string;count:number}[];total:number}) {
  return <figcaption className="text-xs text-slate-soft flex flex-wrap gap-x-3 gap-y-1 mt-2">{items.map((row,i)=><span key={row.label+i}>{row.label}: {row.count}</span>)}<span className="font-medium text-ivory">Total reports: {total}</span></figcaption>;
}
