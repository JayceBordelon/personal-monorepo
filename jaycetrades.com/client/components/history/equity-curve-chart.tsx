"use client";

import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { formatMonthDay } from "@/lib/date-utils";
import { fmtPnlInt } from "@/lib/format";

export function EquityCurveChart({
	data,
}: {
	data: { date: string; cumPnl: number }[];
}) {
	const final = data.length > 0 ? data[data.length - 1].cumPnl : 0;
	const positive = final >= 0;
	const strokeColor = positive
		? "var(--color-green, #22c55e)"
		: "var(--color-red, #ef4444)";
	const gradientId = "equityGradient";

	const chartConfig: ChartConfig = {
		cumPnl: {
			label: "Cumulative P&L",
			color: strokeColor,
		},
	};

	return (
		<ChartContainer config={chartConfig} className="min-h-[240px] w-full">
			<AreaChart data={data} accessibilityLayer>
				<defs>
					<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
						<stop offset="100%" stopColor={strokeColor} stopOpacity={0.02} />
					</linearGradient>
				</defs>
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
				<Area
					dataKey="cumPnl"
					type="monotone"
					stroke={strokeColor}
					strokeWidth={2}
					fill={`url(#${gradientId})`}
				/>
			</AreaChart>
		</ChartContainer>
	);
}
