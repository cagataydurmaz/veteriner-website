"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import type { WeightLog } from "@/types";

interface WeightChartProps {
  data: WeightLog[];
}

export default function WeightChart({ data }: WeightChartProps) {
  const chartData = data.map((log) => ({
    date: format(parseISO(log.recorded_at), "d MMM", { locale: tr }),
    weight: log.weight,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          unit=" kg"
        />
        <Tooltip
          contentStyle={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value) => [`${value} kg`, "Ağırlık"]}
        />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="#166534"
          strokeWidth={2}
          dot={{ fill: "#166534", r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
