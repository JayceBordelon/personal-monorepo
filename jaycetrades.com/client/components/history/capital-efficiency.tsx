import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtMoneyInt, fmtPnlInt, fmtPctDec, pnlColor } from "@/lib/format";

interface CapitalEfficiencyProps {
	totalInvested: number;
	totalReturn: number;
	totalPnl: number;
	roc: number;
}

interface MetricProps {
	label: string;
	value: string;
	sub: string;
	colorClass?: string;
}

function Metric({ label, value, sub, colorClass }: MetricProps) {
	return (
		<div className="text-center">
			<div
				className={cn(
					"font-mono text-xl font-extrabold leading-tight",
					colorClass,
				)}
			>
				{value}
			</div>
			<div className="mt-1 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
				{label}
			</div>
			<div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>
		</div>
	);
}

export function CapitalEfficiency({
	totalInvested,
	totalReturn,
	totalPnl,
	roc,
}: CapitalEfficiencyProps) {
	return (
		<Card>
			<CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
				<Metric
					label="Total Deployed"
					value={fmtMoneyInt(totalInvested)}
					sub="capital at risk"
				/>
				<Metric
					label="Total Returned"
					value={fmtMoneyInt(totalReturn)}
					sub="closing proceeds"
				/>
				<Metric
					label="Net P&L"
					value={fmtPnlInt(totalPnl)}
					sub="returned - invested"
					colorClass={pnlColor(totalPnl)}
				/>
				<Metric
					label="ROC"
					value={fmtPctDec(roc)}
					sub="return on capital"
					colorClass={pnlColor(roc)}
				/>
			</CardContent>
		</Card>
	);
}
