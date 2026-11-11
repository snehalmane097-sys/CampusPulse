"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import { AnalyticsDTO } from "@/types";
import { chartLabel, chartState, chartTotal } from "@/lib/chartData";

const CATEGORY_COLORS = ["#3ED9A3", "#F2A93B", "#E5555C", "#6FA8FF", "#C084FC", "#F472B6", "#8C99A8"];

const tooltipStyle = {
  background: "#1D2733",
  border: "1px solid #2A3541",
  borderRadius: 8,
  color: "#EDF1F4",
  fontSize: 12,
};

export function CategoryChart({ data, expectedTotal }: { data: AnalyticsDTO["categoryDistribution"]; expectedTotal?: number }) {
  const state = chartState(data, expectedTotal);
  if (state !== "ready") return <ChartNotice state={state} name="grievance category"/>;
  const rows = data.map(row => ({...row, category: chartLabel(row.category, "Uncategorized")}));
  return <figure className="min-w-0 w-full" aria-label="Grievances by category">
    <ResponsiveContainer width="100%" height={220} minWidth={0}>
      <BarChart data={rows}>
        <CartesianGrid stroke="#2A3541" vertical={false} />
        <XAxis dataKey="category" stroke="#8C99A8" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="#8C99A8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
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
    Low: "#3ED9A3",
    Medium: "#F2A93B",
    High: "#F2A93B",
    Critical: "#E5555C",
  };
  return <figure className="min-w-0 w-full" aria-label="Priority distribution">
    <ResponsiveContainer width="100%" height={220} minWidth={0}>
      <PieChart>
        <Pie data={rows} dataKey="count" nameKey="priority" innerRadius={50} outerRadius={80} paddingAngle={2}>
          {data.map((d, i) => (
            <Cell key={i} fill={colorFor[d.priority] || "#8C99A8"} />
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
        <CartesianGrid stroke="#2A3541" vertical={false} />
        <XAxis dataKey="date" stroke="#8C99A8" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="#8C99A8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line type="monotone" dataKey="count" stroke="#3ED9A3" strokeWidth={2} dot={false} />
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
        <CartesianGrid stroke="#2A3541" horizontal={false} />
        <XAxis type="number" stroke="#8C99A8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="location"
          stroke="#8C99A8"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={80}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#4FC3F7" />
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
