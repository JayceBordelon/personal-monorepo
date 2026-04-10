"use client";

import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	CartesianGrid,
	ReferenceLine,
	Cell,
} from "recharts";
import { formatMonthDay } from "@/lib/date-utils";
import { fmtPnlInt } from "@/lib/format";

const GREEN = "var(--color-green, #22c55e)";
const RED = "var(--color-red, #ef4444)";

export function DailyPnlChart({
	data,
}: {
	data: { date: string; pnl: number }[];
}) {
	const chartConfig: ChartConfig = {
		pnl: {
			label: "Daily P&L",
			color: GREEN,
		},
	};

	return (
		<ChartContainer config={chartConfig} className="min-h-[240px] w-full">
			<BarChart data={data} accessibilityLayer>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="date"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					tickFormatter={(v: string) => formatMonthDay(v)}
				/>
				<YAxis
					tickLine={false}
					axisLine={false}
					tickMargin={8}
					tickFormatter={(v: number) => fmtPnlInt(v)}
				/>
				<ReferenceLine y={0} stroke="hsl(var(--border))" />
				<ChartTooltip
					content={
						<ChartTooltipContent
							labelFormatter={(_, payload) => {
								const item = payload?.[0]?.payload as
									| { date: string }
									| undefined;
								return item ? formatMonthDay(item.date) : "";
							}}
							formatter={(value) => fmtPnlInt(value as number)}
						/>
					}
				/>
				<Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
					{data.map((entry, index) => (
						<Cell
							key={`cell-${index}`}
							fill={entry.pnl >= 0 ? GREEN : RED}
						/>
					))}
				</Bar>
			</BarChart>
		</ChartContainer>
	);
}
