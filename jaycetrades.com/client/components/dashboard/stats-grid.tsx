import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtPnlInt, pnlColor } from "@/lib/format";

interface StatCardProps {
	label: string;
	value: string;
	sub?: string;
	colorClass?: string;
	accent?: "green" | "red" | "neutral";
}

function StatCard({ label, value, sub, colorClass, accent = "neutral" }: StatCardProps) {
	const borderColor =
		accent === "green"
			? "border-l-green"
			: accent === "red"
				? "border-l-red"
				: "border-l-primary";

	return (
		<Card className={cn("border-l-3 text-center transition-transform hover:-translate-y-0.5", borderColor)}>
			<CardContent className="p-3.5">
				<div className={cn("font-mono text-2xl font-extrabold leading-tight", colorClass)}>
					{value}
				</div>
				<div className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
					{label}
				</div>
				{sub && (
					<div className="mt-0.5 text-[10px] text-muted-foreground">
						{sub}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export function StatsGrid({
	totalPnl,
	winRate,
	profitFactor,
	bestPnl,
	bestSym,
}: {
	totalPnl: number;
	winRate: number;
	profitFactor: number;
	bestPnl: number;
	bestSym: string;
}) {
	const pnlAccent = totalPnl > 0 ? "green" : totalPnl < 0 ? "red" : "neutral";

	return (
		<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
			<StatCard
				label="Net P&L"
				value={fmtPnlInt(totalPnl)}
				colorClass={pnlColor(totalPnl)}
				accent={pnlAccent}
			/>
			<StatCard
				label="Win Rate"
				value={`${winRate.toFixed(0)}%`}
				accent="neutral"
			/>
			<StatCard
				label="Profit Factor"
				value={profitFactor === Number.POSITIVE_INFINITY ? "\u221E" : `${profitFactor.toFixed(2)}x`}
				sub="gross wins / losses"
				accent="neutral"
			/>
			<StatCard
				label="Best Trade"
				value={fmtPnlInt(bestPnl)}
				sub={`$${bestSym}`}
				colorClass="text-green"
				accent="green"
			/>
		</div>
	);
}
