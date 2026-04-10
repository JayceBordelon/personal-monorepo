import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtPnlInt, fmtMoneyInt, fmtPctDec, fmt, pnlColor } from "@/lib/format";

interface HistoryStatsProps {
	totalPnl: number;
	winRate: number;
	roc: number;
	profitFactor: number;
	totalInvested: number;
	avgWin: number;
	avgLoss: number;
	expectancy: number;
	sharpe: number;
	maxDrawdown: number;
	bestPnl: number;
	bestSym: string;
	worstPnl: number;
	worstSym: string;
	totalWinners: number;
	totalLosers: number;
}

interface StatCardProps {
	label: string;
	value: string;
	sub?: string;
	colorClass?: string;
	accent?: "green" | "red" | "neutral";
	children?: React.ReactNode;
}

function StatCard({
	label,
	value,
	sub,
	colorClass,
	accent = "neutral",
	children,
}: StatCardProps) {
	const borderColor =
		accent === "green"
			? "border-l-green"
			: accent === "red"
				? "border-l-red"
				: "border-l-primary";

	return (
		<Card
			className={cn(
				"border-l-3 text-center transition-transform hover:-translate-y-0.5",
				borderColor,
			)}
		>
			<CardContent className="p-3.5">
				<div
					className={cn(
						"font-mono text-2xl font-extrabold leading-tight",
						colorClass,
					)}
				>
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
				{children}
			</CardContent>
		</Card>
	);
}

function WinRateBar({
	winRate,
	winners,
	losers,
}: {
	winRate: number;
	winners: number;
	losers: number;
}) {
	return (
		<div className="mt-2">
			<div className="flex h-1.5 overflow-hidden rounded-full">
				<div
					className="bg-green-light"
					style={{ width: `${winRate}%` }}
				/>
				<div
					className="bg-red-light"
					style={{ width: `${100 - winRate}%` }}
				/>
			</div>
			<div className="mt-0.5 flex justify-between text-[9px] text-muted-foreground">
				<span>{winners}W</span>
				<span>{losers}L</span>
			</div>
		</div>
	);
}

export function HistoryStats({
	totalPnl,
	winRate,
	roc,
	profitFactor,
	totalInvested,
	avgWin,
	avgLoss,
	expectancy,
	sharpe,
	maxDrawdown,
	bestPnl,
	bestSym,
	worstPnl,
	worstSym,
	totalWinners,
	totalLosers,
}: HistoryStatsProps) {
	const pnlAccent = totalPnl > 0 ? "green" : totalPnl < 0 ? "red" : "neutral";

	return (
		<div className="space-y-2.5">
			{/* Primary row */}
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
				>
					<WinRateBar
						winRate={winRate}
						winners={totalWinners}
						losers={totalLosers}
					/>
				</StatCard>
				<StatCard
					label="Return on Capital"
					value={fmtPctDec(roc)}
					sub="net / invested"
					colorClass={pnlColor(roc)}
					accent="neutral"
				/>
				<StatCard
					label="Profit Factor"
					value={
						profitFactor === Number.POSITIVE_INFINITY
							? "\u221E"
							: `${profitFactor.toFixed(2)}x`
					}
					sub="gross wins / losses"
					accent="neutral"
				/>
			</div>

			{/* Secondary row */}
			<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
				<StatCard
					label="Total Deployed"
					value={fmtMoneyInt(totalInvested)}
					accent="neutral"
				/>
				<StatCard
					label="Avg Win"
					value={fmtPnlInt(avgWin)}
					colorClass="text-green"
					accent="green"
				/>
				<StatCard
					label="Avg Loss"
					value={fmtPnlInt(avgLoss)}
					colorClass="text-red"
					accent="red"
				/>
				<StatCard
					label="Expectancy"
					value={fmtPnlInt(expectancy)}
					sub="per trade"
					colorClass={pnlColor(expectancy)}
					accent="neutral"
				/>
				<StatCard
					label="Sharpe Ratio"
					value={fmt(sharpe, 2)}
					accent="neutral"
				/>
				<StatCard
					label="Max Drawdown"
					value={fmtPnlInt(maxDrawdown)}
					colorClass="text-red"
					accent="red"
				/>
				<StatCard
					label="Best Trade"
					value={fmtPnlInt(bestPnl)}
					sub={`$${bestSym}`}
					colorClass="text-green"
					accent="green"
				/>
				<StatCard
					label="Worst Trade"
					value={fmtPnlInt(worstPnl)}
					sub={`$${worstSym}`}
					colorClass="text-red"
					accent="red"
				/>
			</div>
		</div>
	);
}
