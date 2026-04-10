"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { DashboardTrade, WeekResponse } from "@/types/trade";
import {
	getRangeBounds,
	getRangeLabel,
	maxRangeOffset,
	formatDayName,
	formatMonthDay,
} from "@/lib/date-utils";
import { NavBar } from "@/components/layout/nav-bar";
import { TopNFilter } from "@/components/dashboard/top-n-filter";
import { ModeToggle } from "./mode-toggle";
import { DateRangeNav } from "./date-range-nav";
import { HistoryStats } from "./history-stats";
import { EquityCurveChart } from "./equity-curve-chart";
import { DailyPnlChart } from "./daily-pnl-chart";
import { ExposureReturnsChart } from "./exposure-returns-chart";
import { CapitalEfficiency } from "./capital-efficiency";
import { DailyBreakdown } from "./daily-breakdown";
import { MethodologySection } from "./methodology-section";

const STORAGE_KEY = "jt_hist_v2";

type DayStat = {
	date: string;
	pnl: number;
	winners: number;
	losers: number;
	trades: number;
	hasSummaries: boolean;
	invested: number;
	returned: number;
	details: {
		symbol: string;
		type: string;
		strike: number;
		entry: number;
		close: number;
		pnl: number;
		pct: number;
		result: string;
	}[];
};

function filterByRank(data: WeekResponse, topFilter: number): WeekResponse {
	if (topFilter >= 10) return data;
	return {
		...data,
		days: data.days
			.map((day) => ({
				...day,
				trades: day.trades.filter(
					(t) => t.trade.rank >= 1 && t.trade.rank <= topFilter,
				),
			}))
			.filter((day) => day.trades.length > 0),
	};
}

function computeAggregates(data: WeekResponse) {
	let totalPnl = 0;
	let totalWinners = 0;
	let totalLosers = 0;
	let totalTrades = 0;
	let totalInvested = 0;
	let totalReturn = 0;
	let grossWins = 0;
	let grossLosses = 0;
	let bestPnl = -Infinity;
	let worstPnl = Infinity;
	let bestSym = "";
	let worstSym = "";
	let peakEquity = 0;
	let maxDrawdown = 0;
	let cumPnl = 0;
	const dailyReturns: number[] = [];
	const equityPoints: { date: string; cumPnl: number }[] = [];
	const dayStats: DayStat[] = [];

	for (const day of data.days) {
		let dayPnl = 0;
		let dayW = 0;
		let dayL = 0;
		let dayHasSummaries = false;
		let dayInvested = 0;
		let dayReturned = 0;
		const details: DayStat["details"] = [];

		for (const { trade, summary } of day.trades) {
			totalTrades++;
			if (summary) {
				dayHasSummaries = true;
				const pnl = (summary.closing_price - summary.entry_price) * 100;
				const pct =
					summary.entry_price > 0
						? ((summary.closing_price - summary.entry_price) /
								summary.entry_price) *
							100
						: 0;
				dayPnl += pnl;
				totalPnl += pnl;
				dayInvested += summary.entry_price * 100;
				dayReturned += summary.closing_price * 100;
				totalInvested += summary.entry_price * 100;
				totalReturn += summary.closing_price * 100;

				if (pnl > 0.5) {
					dayW++;
					totalWinners++;
					grossWins += pnl;
				} else if (pnl < -0.5) {
					dayL++;
					totalLosers++;
					grossLosses += Math.abs(pnl);
				}
				if (pnl > bestPnl) {
					bestPnl = pnl;
					bestSym = trade.symbol;
				}
				if (pnl < worstPnl) {
					worstPnl = pnl;
					worstSym = trade.symbol;
				}

				details.push({
					symbol: trade.symbol,
					type: trade.contract_type,
					strike: trade.strike_price,
					entry: summary.entry_price,
					close: summary.closing_price,
					pnl,
					pct,
					result:
						pnl > 0.5 ? "profit" : pnl < -0.5 ? "loss" : "flat",
				});
			}
		}

		cumPnl += dayPnl;
		if (cumPnl > peakEquity) peakEquity = cumPnl;
		if (peakEquity > 0) {
			const dd = ((peakEquity - cumPnl) / peakEquity) * 100;
			if (dd > maxDrawdown) maxDrawdown = dd;
		}
		if (dayHasSummaries && dayInvested > 0)
			dailyReturns.push(dayPnl / dayInvested);

		equityPoints.push({ date: day.date, cumPnl });
		dayStats.push({
			date: day.date,
			pnl: dayPnl,
			winners: dayW,
			losers: dayL,
			trades: day.trades.length,
			hasSummaries: dayHasSummaries,
			invested: dayInvested,
			returned: dayReturned,
			details,
		});
	}

	const winRate =
		totalWinners + totalLosers > 0
			? (totalWinners / (totalWinners + totalLosers)) * 100
			: 0;
	const profitFactor =
		grossLosses > 0
			? grossWins / grossLosses
			: grossWins > 0
				? Number.POSITIVE_INFINITY
				: 0;
	const avgWin = totalWinners > 0 ? grossWins / totalWinners : 0;
	const avgLoss = totalLosers > 0 ? grossLosses / totalLosers : 0;
	const expectancy =
		(winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss;
	const roc = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

	let sharpe = 0;
	if (dailyReturns.length > 1) {
		const mean =
			dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
		const variance =
			dailyReturns.reduce((a, r) => a + (r - mean) ** 2, 0) /
			(dailyReturns.length - 1);
		const stddev = Math.sqrt(variance);
		if (stddev > 0) sharpe = (mean / stddev) * Math.sqrt(252);
	}

	return {
		totalPnl,
		totalWinners,
		totalLosers,
		totalTrades,
		totalInvested,
		totalReturn,
		winRate,
		profitFactor,
		avgWin,
		avgLoss,
		expectancy,
		roc,
		sharpe,
		maxDrawdown,
		bestPnl,
		bestSym,
		worstPnl,
		worstSym,
		equityPoints,
		dayStats,
	};
}

export function HistoryShell() {
	const [mode, setMode] = useState("week");
	const [rangeOffset, setRangeOffset] = useState(0);
	const [topFilter, setTopFilter] = useState(10);
	const [availableDates, setAvailableDates] = useState<string[]>([]);
	const [rawData, setRawData] = useState<WeekResponse | null>(null);

	// Restore state
	useEffect(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const saved = JSON.parse(raw);
				if (saved.mode) setMode(saved.mode);
				if (saved.rangeOffset != null) setRangeOffset(saved.rangeOffset);
				if (saved.topFilter && [1, 3, 5, 10].includes(saved.topFilter))
					setTopFilter(saved.topFilter);
			}
		} catch {}
	}, []);

	// Save state
	useEffect(() => {
		try {
			localStorage.setItem(
				STORAGE_KEY,
				JSON.stringify({ mode, rangeOffset, topFilter }),
			);
		} catch {}
	}, [mode, rangeOffset, topFilter]);

	// Load dates
	useEffect(() => {
		api.getTradeDates(365).then((res) => {
			if (res.dates?.length) setAvailableDates(res.dates);
		});
	}, []);

	// Load range data
	const loadRange = useCallback(() => {
		const b = getRangeBounds(mode, rangeOffset);
		api.getWeekTrades(b.start, b.end).then(setRawData);
	}, [mode, rangeOffset]);

	useEffect(() => {
		loadRange();
	}, [loadRange]);

	const filtered = rawData ? filterByRank(rawData, topFilter) : null;
	const agg = filtered?.days?.length ? computeAggregates(filtered) : null;

	const maxOffset = maxRangeOffset(mode, availableDates);
	const label = getRangeLabel(mode, rangeOffset);

	const daysWithPnl = agg?.dayStats.filter((d) => d.hasSummaries) ?? [];

	return (
		<>
			<NavBar>
				<TopNFilter value={topFilter} onChange={setTopFilter} />
				<ModeToggle
					mode={mode}
					onChange={(m) => {
						setMode(m);
						setRangeOffset(0);
					}}
				/>
				<DateRangeNav
					label={label}
					canPrev={mode !== "all" && rangeOffset < maxOffset}
					canNext={mode !== "all" && rangeOffset > 0}
					onPrev={() => setRangeOffset((o) => o + 1)}
					onNext={() => setRangeOffset((o) => o - 1)}
				/>
			</NavBar>

			<div className="mx-auto max-w-[1200px] p-5 sm:px-7">
				{!filtered || !filtered.days?.length ? (
					<div className="py-12 text-center">
						<div className="mb-3 text-5xl opacity-50">&#128200;</div>
						<div className="text-base font-bold">
							{rawData ? "No trades this period" : "Loading performance data..."}
						</div>
						<div className="text-sm text-muted-foreground">
							Navigate to a period with trading activity.
						</div>
					</div>
				) : (
					agg && (
						<>
							<h1 className="mb-0.5 text-lg font-extrabold tracking-tight">
								{mode === "week"
									? "Weekly"
									: mode === "month"
										? "Monthly"
										: mode === "year"
											? "Yearly"
											: "All-Time"}{" "}
								Performance
							</h1>
							<p className="mb-4 text-xs text-muted-foreground">
								{agg.totalTrades} trades across{" "}
								{filtered.days.length} trading days
								{topFilter < 10
									? ` (Top ${topFilter})`
									: ""}
							</p>

							{agg.totalWinners + agg.totalLosers > 0 && (
								<>
									<HistoryStats {...agg} />

									{agg.equityPoints.length > 1 && (
										<div className="mt-5">
											<EquityCurveChart
												data={agg.equityPoints}
											/>
										</div>
									)}

									{daysWithPnl.length > 1 && (
										<div className="mt-5">
											<DailyPnlChart
												data={daysWithPnl}
											/>
										</div>
									)}

									{daysWithPnl.length > 1 && (
										<div className="mt-5">
											<ExposureReturnsChart
												data={daysWithPnl}
											/>
										</div>
									)}

									<div className="mt-5">
										<CapitalEfficiency
											totalInvested={agg.totalInvested}
											totalReturn={agg.totalReturn}
											totalPnl={agg.totalPnl}
											roc={agg.roc}
										/>
									</div>
								</>
							)}

							<div className="my-5 h-px bg-border" />

							<DailyBreakdown dayStats={agg.dayStats} />

							<div className="mt-5">
								<MethodologySection />
							</div>
						</>
					)
				)}
			</div>
		</>
	);
}
