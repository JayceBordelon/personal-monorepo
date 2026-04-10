"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatDayName, formatMonthDay } from "@/lib/date-utils";
import { fmtPnlInt, fmtMoney, fmtPctDec, pnlColor } from "@/lib/format";
import { ChevronDown } from "lucide-react";

interface TradeDetail {
	symbol: string;
	type: string;
	strike: number;
	entry: number;
	close: number;
	pnl: number;
	pct: number;
	result: string;
}

interface DayStat {
	date: string;
	pnl: number;
	winners: number;
	losers: number;
	trades: number;
	hasSummaries: boolean;
	invested: number;
	returned: number;
	details: TradeDetail[];
}

export function DailyBreakdown({ dayStats }: { dayStats: DayStat[] }) {
	const [expanded, setExpanded] = useState<Record<string, boolean>>({});

	function toggle(date: string) {
		setExpanded((prev) => ({ ...prev, [date]: !prev[date] }));
	}

	const maxAbsPnl = Math.max(
		...dayStats.map((d) => Math.abs(d.pnl)),
		1,
	);

	return (
		<div className="overflow-hidden rounded-lg border">
			{dayStats.map((day, i) => {
				const open = expanded[day.date] ?? false;
				const barWidth = Math.round(
					(Math.abs(day.pnl) / maxAbsPnl) * 100,
				);

				return (
					<div key={day.date}>
						{/* Day header row */}
						<button
							type="button"
							onClick={() => toggle(day.date)}
							className={cn(
								"flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/50",
								i % 2 === 0 ? "bg-card" : "bg-muted/30",
							)}
						>
							{/* Day name */}
							<span className="w-8 shrink-0 text-xs font-semibold text-muted-foreground">
								{formatDayName(day.date)}
							</span>

							{/* Date */}
							<span className="w-16 shrink-0 text-xs">
								{formatMonthDay(day.date)}
							</span>

							{/* Trade count */}
							<span className="w-6 shrink-0 text-center text-xs text-muted-foreground">
								{day.trades}
							</span>

							{/* W/L record */}
							<span className="w-12 shrink-0 text-xs">
								<span className="text-green">{day.winners}</span>
								<span className="text-muted-foreground">/</span>
								<span className="text-red">{day.losers}</span>
							</span>

							{/* P&L bar */}
							<span className="relative flex flex-1 items-center">
								<span
									className={cn(
										"block h-2.5 rounded-sm",
										day.pnl >= 0 ? "bg-green-bg" : "bg-red-bg",
									)}
									style={{ width: `${barWidth}%` }}
								/>
							</span>

							{/* P&L amount */}
							<span
								className={cn(
									"w-20 shrink-0 text-right font-mono text-xs font-bold",
									pnlColor(day.pnl),
								)}
							>
								{fmtPnlInt(day.pnl)}
							</span>

							{/* Expand indicator */}
							<ChevronDown
								className={cn(
									"h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
									open && "rotate-180",
								)}
							/>
						</button>

						{/* Expanded trade details */}
						{open && day.details.length > 0 && (
							<div className="border-t bg-muted/20 px-6 py-2">
								<div className="space-y-1.5">
									{day.details.map((t, j) => (
										<div
											key={`${day.date}-${j}`}
											className="flex items-center gap-3 text-xs"
										>
											{/* Symbol */}
											<span className="w-14 shrink-0 font-semibold">
												${t.symbol}
											</span>

											{/* Type badge */}
											<Badge
												variant="outline"
												className={cn(
													"w-11 justify-center text-[10px]",
													t.type === "CALL"
														? "border-green/30 text-green"
														: "border-red/30 text-red",
												)}
											>
												{t.type}
											</Badge>

											{/* Strike */}
											<span className="w-12 shrink-0 text-muted-foreground">
												${t.strike}
											</span>

											{/* Entry -> Close */}
											<span className="w-28 shrink-0 text-muted-foreground">
												{fmtMoney(t.entry)}{" "}
												<span className="text-muted-foreground/60">
													&rarr;
												</span>{" "}
												{fmtMoney(t.close)}
											</span>

											{/* % change */}
											<span
												className={cn(
													"w-14 shrink-0 text-right font-mono",
													pnlColor(t.pnl),
												)}
											>
												{fmtPctDec(t.pct)}
											</span>

											{/* P&L */}
											<span
												className={cn(
													"w-16 shrink-0 text-right font-mono font-bold",
													pnlColor(t.pnl),
												)}
											>
												{fmtPnlInt(t.pnl)}
											</span>

											{/* Result badge */}
											<Badge
												variant="secondary"
												className={cn(
													"text-[10px]",
													t.result === "WIN"
														? "bg-green-bg text-green"
														: "bg-red-bg text-red",
												)}
											>
												{t.result}
											</Badge>
										</div>
									))}
								</div>
							</div>
						)}

						{open && day.details.length === 0 && (
							<div className="border-t bg-muted/20 px-6 py-3 text-center text-xs text-muted-foreground">
								No trade details available for this day.
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
