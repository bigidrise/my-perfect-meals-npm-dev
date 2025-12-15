import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export type StepsPoint = {
  date: string;
  steps: number;
};

interface StepsTrendGraphProps {
  data: StepsPoint[];
}

export default function StepsTrendGraph({ data }: StepsTrendGraphProps) {
  // Handle empty or invalid data
  const safeData = data && data.length > 0 ? data : [];
  const hasData = safeData.length > 0;

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-white mb-4">
        30-Day Steps Trend
      </h3>
      {!hasData ? (
        <div className="h-[300px] flex items-center justify-center bg-black/20 rounded-lg border border-white/10">
          <div className="text-center text-white/60">
            <div className="text-4xl mb-2">👟</div>
            <p>No steps data available</p>
            <p className="text-sm">Connect a fitness device to track steps</p>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={safeData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis 
              dataKey="date" 
              stroke="rgba(255,255,255,0.7)"
              fontSize={12}
            />
            <YAxis 
              stroke="rgba(255,255,255,0.7)"
              fontSize={12}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(0,0,0,0.8)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "8px",
                color: "white",
              }}
              labelStyle={{ color: "white" }}
            />
            <Line
              type="monotone"
              dataKey="steps"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: "#10b981", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}