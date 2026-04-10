import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtMoney, fmtMoneyInt, fmtPct, fmt } from "@/lib/format";
import { calcMaxLoss, calcMaxGain } from "@/lib/calculations";
import type { DashboardTrade } from "@/types/trade";

interface ExposurePanelProps {
	trades: DashboardTrade[];
	hasSummaries: boolean;
}

export function ExposurePanel({ trades, hasSummaries }: ExposurePanelProps) {
	const totalRisk = trades.reduce((sum, dt) => sum + calcMaxLoss(dt.trade), 0);
	const avgPremium =
		trades.length > 0
			? trades.reduce((sum, dt) => sum + dt.trade.estimated_price, 0) /
				trades.length
			: 0;
	const avgDte =
		trades.length > 0
			? trades.reduce((sum, dt) => sum + dt.trade.dte, 0) / trades.length
			: 0;

	const totalDeployed = trades.reduce(
		(sum, dt) => sum + dt.trade.estimated_price * 100,
		0,
	);

	let totalReturned = 0;
	let avgRoc: number | null = null;

	if (hasSummaries) {
		const withSummaries = trades.filter((dt) => dt.summary);
		totalReturned = withSummaries.reduce((sum, dt) => {
			if (!dt.summary) return sum;
			return sum + dt.summary.closing_price * 100;
		}, 0);

		if (withSummaries.length > 0 && totalDeployed > 0) {
			avgRoc = ((totalReturned - totalDeployed) / totalDeployed) * 100;
		}
	}

	const avgMaxGain =
		trades.length > 0
			? trades.reduce((sum, dt) => {
					const mg = calcMaxGain(dt.trade);
					return sum + (mg ?? 0);
				}, 0) / trades.length
			: 0;

	const deployedPct =
		totalDeployed + totalReturned > 0
			? (totalDeployed / (totalDeployed + totalReturned)) * 100
			: 50;

	return (
		<Card>
			<CardHeader className="pb-2">
				<div className="flex items-center gap-2">
					<CardTitle className="text-base">Exposure Analysis</CardTitle>
					<Badge variant="outline" className="text-[10px]">
						Long Options
					</Badge>
				</div>
				<p className="text-xs text-muted-foreground">
					Max loss is limited to premium paid per contract
				</p>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
					<MetricCell
						label="Capital at Risk"
						value={fmtMoneyInt(totalRisk)}
					/>
					<MetricCell
						label="Avg Premium"
						value={fmtMoney(avgPremium)}
					/>
					<MetricCell
						label="Avg DTE"
						value={`${fmt(avgDte, 0)}d`}
					/>
					{hasSummaries && avgRoc !== null ? (
						<MetricCell
							label="ROC"
							value={fmtPct(avgRoc)}
							valueClass={
								avgRoc > 0
									? "text-green"
									: avgRoc < 0
										? "text-red"
										: undefined
							}
						/>
					) : (
						<MetricCell
							label="Max Gain Potential"
							value={fmtMoneyInt(avgMaxGain)}
							sub="avg per trade"
						/>
					)}
				</div>

				{hasSummaries && totalDeployed > 0 && (
					<div className="space-y-1.5">
						<div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
							<span>Deployed vs Returned</span>
							<span>
								{fmtMoneyInt(totalDeployed)} / {fmtMoneyInt(totalReturned)}
							</span>
						</div>
						<div className="flex h-3 overflow-hidden rounded-full bg-muted">
							<div
								className="rounded-l-full bg-amber transition-all"
								style={{ width: `${deployedPct}%` }}
							/>
							<div
								className={cn(
									"transition-all",
									totalReturned >= totalDeployed ? "bg-green" : "bg-red",
									deployedPct < 100 && "rounded-r-full",
								)}
								style={{ width: `${100 - deployedPct}%` }}
							/>
						</div>
						<div className="flex justify-between text-[10px] text-muted-foreground">
							<span className="flex items-center gap-1">
								<span className="inline-block h-2 w-2 rounded-full bg-amber" />
								Deployed
							</span>
							<span className="flex items-center gap-1">
								<span
									className={cn(
										"inline-block h-2 w-2 rounded-full",
										totalReturned >= totalDeployed ? "bg-green" : "bg-red",
									)}
								/>
								Returned
							</span>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function MetricCell({
	label,
	value,
	sub,
	valueClass,
}: {
	label: string;
	value: string;
	sub?: string;
	valueClass?: string;
}) {
	return (
		<div className="rounded-lg bg-muted/50 p-2.5 text-center">
			<div
				className={cn(
					"font-mono text-lg font-bold leading-tight",
					valueClass,
				)}
			>
				{value}
			</div>
			<div className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
				{label}
			</div>
			{sub && (
				<div className="text-[10px] text-muted-foreground">{sub}</div>
			)}
		</div>
	);
}
