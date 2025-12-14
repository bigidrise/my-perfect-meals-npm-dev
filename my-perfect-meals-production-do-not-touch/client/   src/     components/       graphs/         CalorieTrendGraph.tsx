import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export interface CaloriePoint {
  /** Prefer ISO "YYYY-MM-DD" or a display string like "08/27" */
  date: string;
  calories: number;
}

interface Props {
  data: CaloriePoint[];
  title?: string;
  height?: number; // px
}

export default function CalorieTrendGraph({
  data,
  title = "30-Day Calorie Trend",
  height = 260,
}: Props) {
  return (
    <div className="w-full rounded-2xl bg-black/40 p-4 shadow-lg">
      <h2 className="text-white text-base md:text-lg font-semibold mb-3">
        {title}
      </h2>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.08)"
            />
            <XAxis
              dataKey="date"
              stroke="#e5e7eb"
              tick={{ fontSize: 12, fill: "#e5e7eb" }}
              tickMargin={8}
              minTickGap={20}
            />
            <YAxis
              stroke="#e5e7eb"
              tick={{ fontSize: 12, fill: "#e5e7eb" }}
              width={54}
              tickFormatter={(v) => `${Math.round(v)}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0b0b0c",
                border: "1px solid #2a2a2e",
                borderRadius: 8,
              }}
              labelStyle={{ color: "#fff" }}
              formatter={(value: any) => [
                Number(value).toLocaleString(),
                "Calories",
              ]}
            />
            <Line
              type="monotone"
              dataKey="calories"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={{ r: 2, strokeWidth: 1 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
