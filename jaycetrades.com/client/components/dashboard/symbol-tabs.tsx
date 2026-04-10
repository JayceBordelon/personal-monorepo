import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtPnlInt, pnlColor } from "@/lib/format";
import type { DashboardTrade } from "@/types/trade";

interface SymbolTabsProps {
	trades: DashboardTrade[];
	activeSymbol: string;
	onSelect: (symbol: string) => void;
}

export function SymbolTabs({ trades, activeSymbol, onSelect }: SymbolTabsProps) {
	const symbolMap = new Map<
		string,
		{ symbol: string; pnl: number | null }
	>();

	for (const dt of trades) {
		const sym = dt.trade.symbol;
		if (symbolMap.has(sym)) continue;

		let pnl: number | null = null;
		if (dt.summary) {
			pnl = (dt.summary.closing_price - dt.summary.entry_price) * 100;
		}
		symbolMap.set(sym, { symbol: sym, pnl });
	}

	const symbols = Array.from(symbolMap.values());

	return (
		<div className="flex gap-1.5 overflow-x-auto pb-1">
			{symbols.map(({ symbol, pnl }) => {
				const isActive = symbol === activeSymbol;
				return (
					<button
						key={symbol}
						type="button"
						onClick={() => onSelect(symbol)}
						className={cn(
							"flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors",
							isActive
								? "border-primary bg-primary text-primary-foreground"
								: "border-border bg-card text-foreground hover:bg-muted",
						)}
					>
						${symbol}
						{pnl !== null && (
							<Badge
								variant="secondary"
								className={cn(
									"text-[10px] font-mono",
									pnlColor(pnl),
								)}
							>
								{fmtPnlInt(pnl)}
							</Badge>
						)}
					</button>
				);
			})}
		</div>
	);
}
