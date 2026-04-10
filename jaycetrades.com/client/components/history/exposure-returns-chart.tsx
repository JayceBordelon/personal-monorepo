"use client";

import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	ChartLegend,
	ChartLegendContent,
	type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { formatMonthDay } from "@/lib/date-utils";
import { fmtMoneyInt } from "@/lib/format";

export function ExposureReturnsChart({
	data,
}: {
	data: { date: string; invested: number; returned: number }[];
}) {
	const chartConfig: ChartConfig = {
		invested: {
			label: "Invested",
			color: "var(--color-chart-1, hsl(220 70% 50%))",
		},
		returned: {
			label: "Returned",
			color: "var(--color-green, #22c55e)",
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
					tickFormatter={(v: number) => fmtMoneyInt(v)}
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
							formatter={(value) => fmtMoneyInt(value as number)}
						/>
					}
				/>
				<ChartLegend content={<ChartLegendContent />} />
				<Bar
					dataKey="invested"
					fill="var(--color-invested)"
					radius={[3, 3, 0, 0]}
				/>
				<Bar
					dataKey="returned"
					fill="var(--color-returned)"
					radius={[3, 3, 0, 0]}
				/>
			</BarChart>
		</ChartContainer>
	);
}
