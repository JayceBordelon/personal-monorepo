import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtMoney, fmtMoneyInt, fmt } from "@/lib/format";
import {
	calcMoneyness,
	calcBreakeven,
	calcMaxLoss,
	calcMaxGain,
	calcRiskReward,
	sentimentLabel,
	sentimentColor,
} from "@/lib/calculations";
import type { DashboardTrade, LiveQuotesResponse } from "@/types/trade";

interface MorningCardsProps {
	trades: DashboardTrade[];
	liveQuotes?: LiveQuotesResponse | null;
}

export function MorningCards({ trades, liveQuotes }: MorningCardsProps) {
	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{trades.map((dt) => (
				<MorningCard
					key={dt.trade.rank}
					dt={dt}
					liveQuotes={liveQuotes}
				/>
			))}
		</div>
	);
}

function MorningCard({
	dt,
	liveQuotes,
}: {
	dt: DashboardTrade;
	liveQuotes?: LiveQuotesResponse | null;
}) {
	const { trade } = dt;
	const moneyness = calcMoneyness(trade);
	const breakeven = calcBreakeven(trade);
	const maxLoss = calcMaxLoss(trade);
	const maxGain = calcMaxGain(trade);
	const riskReward = calcRiskReward(trade);

	const liveStock = liveQuotes?.quotes?.[trade.symbol];
	const optionKey = Object.keys(liveQuotes?.options ?? {}).find((k) =>
		k.startsWith(trade.symbol),
	);
	const liveOption = optionKey ? liveQuotes?.options?.[optionKey] : null;

	return (
		<Card className="gap-3 py-4">
			<CardContent className="space-y-3 px-4">
				{/* Header */}
				<div className="flex items-start justify-between">
					<div className="flex flex-wrap items-center gap-1.5">
						<Badge variant="secondary" className="text-[10px]">
							#{trade.rank}
						</Badge>
						<span className="text-lg font-bold">${trade.symbol}</span>
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
					</div>
					<div className="flex gap-1">
						<Badge variant={moneyness.variant} className="text-[10px]">
							{moneyness.label}
						</Badge>
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
					</div>
				</div>

				{/* Estimated price */}
				<div className="text-center">
					<div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
						Est. Premium
					</div>
					<div className="font-mono text-2xl font-bold">
						{fmtMoney(trade.estimated_price)}
					</div>
				</div>

				{/* Specs grid */}
				<div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
					<SpecRow
						label="Strike"
						value={fmtMoney(trade.strike_price)}
					/>
					<SpecRow
						label="Expiration"
						value={`${trade.expiration} (${trade.dte}d)`}
					/>
					<SpecRow
						label="Stock Price"
						value={fmtMoney(trade.current_price)}
					/>
					<SpecRow
						label="Target"
						value={fmtMoney(trade.target_price)}
					/>
				</div>

				{/* Technical metrics */}
				<div className="rounded-md bg-muted/50 p-2.5">
					<div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
						<SpecRow
							label="Breakeven"
							value={fmtMoney(breakeven)}
						/>
						<SpecRow
							label="Max Loss"
							value={fmtMoneyInt(maxLoss)}
						/>
						<SpecRow
							label="Target Gain"
							value={
								maxGain !== null
									? fmtMoneyInt(maxGain)
									: "N/A"
							}
						/>
						<SpecRow
							label="Risk / Reward"
							value={
								riskReward
									? `1:${riskReward.toFixed(1)}`
									: "N/A"
							}
						/>
						<SpecRow label="Sentiment">
							<span
								className={cn(
									"font-semibold",
									sentimentColor(trade.sentiment_score),
								)}
							>
								{sentimentLabel(trade.sentiment_score)} (
								{fmt(trade.sentiment_score, 2)})
							</span>
						</SpecRow>
						<SpecRow
							label="Stop Loss"
							value={fmtMoney(trade.stop_loss)}
						/>
					</div>
				</div>

				{/* Catalyst */}
				{trade.catalyst && (
					<div className="rounded-md bg-amber-bg px-3 py-2 text-xs">
						<span className="font-semibold text-amber">
							Catalyst:{" "}
						</span>
						{trade.catalyst}
					</div>
				)}

				{/* Thesis */}
				{trade.thesis && (
					<p className="text-xs leading-relaxed text-muted-foreground">
						{trade.thesis}
					</p>
				)}

				{/* Live quotes */}
				{liveQuotes?.connected && (liveStock || liveOption) && (
					<div className="rounded-md border border-green/20 bg-green-bg p-2.5">
						<div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-green">
							Live Data
						</div>
						<div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
							{liveStock && (
								<SpecRow
									label="Stock"
									value={fmtMoney(liveStock.last_price)}
								/>
							)}
							{liveOption && (
								<SpecRow
									label="Option Mark"
									value={fmtMoney(liveOption.mark)}
								/>
							)}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function SpecRow({
	label,
	value,
	children,
}: {
	label: string;
	value?: string;
	children?: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-muted-foreground">{label}</span>
			{children ?? <span className="font-mono font-medium">{value}</span>}
		</div>
	);
}
