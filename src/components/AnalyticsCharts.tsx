"use client";

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell,
} from "recharts";
import { AnalyticsDTO } from "@/types";

const CATEGORY_COLORS = ["#3ED9A3", "#F2A93B", "#E5555C", "#6FA8FF", "#C084FC", "#F472B6", "#8C99A8"];

const tooltipStyle = {
  background: "#1D2733",
  border: "1px solid #2A3541",
  borderRadius: 8,
  color: "#EDF1F4",
  fontSize: 12,
};

export function CategoryChart({ data }: { data: AnalyticsDTO["categoryDistribution"] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
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
  );
}

export function PriorityChart({ data }: { data: AnalyticsDTO["priorityDistribution"] }) {
  const colorFor: Record<string, string> = {
    Low: "#3ED9A3",
    Medium: "#F2A93B",
    High: "#F2A93B",
    Critical: "#E5555C",
  };
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="priority" innerRadius={50} outerRadius={80} paddingAngle={2}>
          {data.map((d, i) => (
            <Cell key={i} fill={colorFor[d.priority] || "#8C99A8"} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({ data }: { data: AnalyticsDTO["trend"] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
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
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={220}>
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
