"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { fmtMoney, fmtPnlInt, fmtPctDec, pnlColor } from "@/lib/format";
import {
	calcMoneyness,
	calcBreakeven,
	calcMaxLoss,
	calcRiskReward,
	sentimentLabel,
	sentimentColor,
} from "@/lib/calculations";
import type { DashboardTrade } from "@/types/trade";

interface TradeTableProps {
	trades: DashboardTrade[];
}

export function TradeTable({ trades }: TradeTableProps) {
	const [expanded, setExpanded] = useState<number | null>(null);

	function toggle(rank: number) {
		setExpanded((prev) => (prev === rank ? null : rank));
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className="w-10 text-center">#</TableHead>
					<TableHead>Trade</TableHead>
					<TableHead className="text-right">Entry</TableHead>
					<TableHead className="text-right">Close</TableHead>
					<TableHead className="text-right">Stock</TableHead>
					<TableHead className="text-right">P&L</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{trades.map((dt) => {
					const { trade, summary } = dt;
					const moneyness = calcMoneyness(trade);
					const hasSummary = !!summary;
					const pnl = hasSummary
						? (summary.closing_price - summary.entry_price) * 100
						: 0;
					const isExpanded = expanded === trade.rank;

					const resultLabel = hasSummary
						? pnl > 0
							? "WIN"
							: pnl < 0
								? "LOSS"
								: "FLAT"
						: "OPEN";
					const resultVariant = hasSummary
						? pnl > 0
							? "default"
							: pnl < 0
								? "destructive"
								: "outline"
						: ("secondary" as const);

					const stockMove = hasSummary
						? ((summary.stock_close - summary.stock_open) /
								summary.stock_open) *
							100
						: 0;

					return (
						<>
							<TableRow
								key={trade.rank}
								className="cursor-pointer"
								onClick={() => toggle(trade.rank)}
								aria-expanded={isExpanded}
							>
								<TableCell className="text-center font-mono text-xs text-muted-foreground">
									{trade.rank}
								</TableCell>
								<TableCell>
									<div className="flex flex-wrap items-center gap-1.5">
										<span className="font-semibold">
											${trade.symbol}
										</span>
										<Badge
											variant="outline"
											className={cn(
												"text-[10px]",
												trade.contract_type === "CALL"
													? "border-green/30 text-green"
													: "border-red/30 text-red",
											)}
										>
											{trade.contract_type}
										</Badge>
										<Badge
											variant={resultVariant}
											className="text-[10px]"
										>
											{resultLabel}
										</Badge>
										<Badge
											variant={moneyness.variant}
											className="text-[10px]"
										>
											{moneyness.label}
										</Badge>
									</div>
								</TableCell>
								<TableCell className="text-right font-mono text-sm">
									{hasSummary
										? fmtMoney(summary.entry_price)
										: fmtMoney(trade.estimated_price)}
								</TableCell>
								<TableCell className="text-right font-mono text-sm">
									{hasSummary
										? fmtMoney(summary.closing_price)
										: "—"}
								</TableCell>
								<TableCell
									className={cn(
										"text-right font-mono text-sm",
										hasSummary
											? stockMove >= 0
												? "text-green"
												: "text-red"
											: "text-muted-foreground",
									)}
								>
									{hasSummary
										? fmtPctDec(stockMove)
										: "—"}
								</TableCell>
								<TableCell
									className={cn(
										"text-right font-mono text-sm font-semibold",
										hasSummary
											? pnlColor(pnl)
											: "text-muted-foreground",
									)}
								>
									{hasSummary ? fmtPnlInt(pnl) : "—"}
								</TableCell>
							</TableRow>

							{isExpanded && (
								<TableRow key={`${trade.rank}-detail`}>
									<TableCell colSpan={6} className="bg-muted/30 p-0">
										<TradeDetail dt={dt} />
									</TableCell>
								</TableRow>
							)}
						</>
					);
				})}
			</TableBody>
		</Table>
	);
}

function TradeDetail({ dt }: { dt: DashboardTrade }) {
	const { trade, summary } = dt;
	const moneyness = calcMoneyness(trade);
	const breakeven = calcBreakeven(trade);
	const maxLoss = calcMaxLoss(trade);
	const riskReward = calcRiskReward(trade);

	return (
		<div className="space-y-3 px-6 py-4">
			<div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 md:grid-cols-4">
				<DetailItem
					label="Strike"
					value={fmtMoney(trade.strike_price)}
				/>
				<DetailItem label="Expiration" value={trade.expiration} />
				<DetailItem label="DTE" value={`${trade.dte}d`} />
				<DetailItem
					label="Stock at Entry"
					value={fmtMoney(trade.current_price)}
				/>
				<DetailItem label="Moneyness" value={moneyness.label} />
				<DetailItem label="Breakeven" value={fmtMoney(breakeven)} />
				<DetailItem label="Max Loss" value={fmtPnlInt(-maxLoss)} />
				<DetailItem
					label="Risk / Reward"
					value={
						riskReward
							? `1:${riskReward.toFixed(1)}`
							: "N/A"
					}
				/>
				<DetailItem label="Risk Level">
					<Badge
						variant={
							trade.risk_level === "HIGH"
								? "destructive"
								: trade.risk_level === "MEDIUM"
									? "outline"
									: "secondary"
						}
						className="text-[10px]"
					>
						{trade.risk_level}
					</Badge>
				</DetailItem>
				<DetailItem label="Sentiment">
					<span
						className={cn(
							"font-semibold",
							sentimentColor(trade.sentiment_score),
						)}
					>
						{sentimentLabel(trade.sentiment_score)} (
						{trade.sentiment_score.toFixed(2)})
					</span>
				</DetailItem>
			</div>

			{trade.catalyst && (
				<div className="rounded-md bg-amber-bg px-3 py-2 text-xs">
					<span className="font-semibold text-amber">Catalyst: </span>
					{trade.catalyst}
				</div>
			)}

			{summary && (
				<div className="rounded-md bg-muted/50 px-3 py-2 text-xs">
					<span className="font-semibold">EOD Results: </span>
					Entry {fmtMoney(summary.entry_price)} → Close{" "}
					{fmtMoney(summary.closing_price)} | Stock{" "}
					{fmtMoney(summary.stock_open)} → {fmtMoney(summary.stock_close)}
					{summary.notes && (
						<span className="ml-1 text-muted-foreground">
							— {summary.notes}
						</span>
					)}
				</div>
			)}

			{trade.thesis && (
				<div className="text-xs leading-relaxed text-muted-foreground">
					<span className="font-semibold text-foreground">
						Thesis:{" "}
					</span>
					{trade.thesis}
				</div>
			)}
		</div>
	);
}

function DetailItem({
	label,
	value,
	children,
}: {
	label: string;
	value?: string;
	children?: React.ReactNode;
}) {
	return (
		<div>
			<div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
				{label}
			</div>
			{children ?? (
				<div className="font-mono text-sm font-medium">{value}</div>
			)}
		</div>
	);
}
