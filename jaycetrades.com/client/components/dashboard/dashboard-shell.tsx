"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type {
	DashboardResponse,
	DashboardTrade,
	LiveQuotesResponse,
} from "@/types/trade";
import { NavBar } from "@/components/layout/nav-bar";
import { TopNFilter } from "./top-n-filter";
import { DateNavigator } from "./date-navigator";
import { SymbolTabs } from "./symbol-tabs";
import { StockChart } from "./stock-chart";
import { StatsGrid } from "./stats-grid";
import { ExposurePanel } from "./exposure-panel";
import { PnlChart } from "./pnl-chart";
import { TradeTable } from "./trade-table";
import { MorningCards } from "./morning-cards";
import { LiveBanner } from "./live-banner";

const STORAGE_KEY = "jt_dash_v3";
const REFRESH_SECONDS = 60;
const LIVE_POLL_SECONDS = 15;

function filterByRank(
	data: DashboardResponse,
	topFilter: number,
): DashboardResponse {
	if (topFilter >= 10) return data;
	return {
		...data,
		trades: data.trades.filter(
			(t) => t.trade.rank >= 1 && t.trade.rank <= topFilter,
		),
	};
}

function computeStats(trades: DashboardTrade[]) {
	let winners = 0;
	let losers = 0;
	let totalPnl = 0;
	let bestPnl = -Infinity;
	let bestSym = "";
	let grossWins = 0;
	let grossLosses = 0;
	let hasSummaries = false;

	for (const { trade, summary } of trades) {
		if (summary) {
			hasSummaries = true;
			const pnl = (summary.closing_price - summary.entry_price) * 100;
			totalPnl += pnl;
			if (pnl > 0.5) {
				winners++;
				grossWins += pnl;
			} else if (pnl < -0.5) {
				losers++;
				grossLosses += Math.abs(pnl);
			}
			if (pnl > bestPnl) {
				bestPnl = pnl;
				bestSym = trade.symbol;
			}
		}
	}

	const winRate =
		winners + losers > 0 ? (winners / (winners + losers)) * 100 : 0;
	const profitFactor =
		grossLosses > 0
			? grossWins / grossLosses
			: grossWins > 0
				? Number.POSITIVE_INFINITY
				: 0;

	return { hasSummaries, totalPnl, winRate, profitFactor, bestPnl, bestSym };
}

export function DashboardShell() {
	const [dates, setDates] = useState<string[]>([]);
	const [dayIndex, setDayIndex] = useState(0);
	const [topFilter, setTopFilter] = useState(10);
	const [rawData, setRawData] = useState<DashboardResponse | null>(null);
	const [liveQuotes, setLiveQuotes] = useState<LiveQuotesResponse | null>(
		null,
	);
	const [activeSymbol, setActiveSymbol] = useState("");
	const [chartTimeframe, setChartTimeframe] = useState({
		period: 5,
		ptype: "day",
		ftype: "minute",
		freq: 5,
	});

	// Restore state from localStorage
	useEffect(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const saved = JSON.parse(raw);
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
				JSON.stringify({
					topFilter,
					date: dates[dayIndex],
				}),
			);
		} catch {}
	}, [topFilter, dayIndex, dates]);

	// Load dates
	useEffect(() => {
		api.getTradeDates().then((res) => {
			if (res.dates?.length) {
				setDates(res.dates);
				// Restore saved date
				try {
					const raw = localStorage.getItem(STORAGE_KEY);
					if (raw) {
						const saved = JSON.parse(raw);
						if (saved.date) {
							const idx = res.dates.indexOf(saved.date);
							if (idx >= 0) setDayIndex(idx);
						}
					}
				} catch {}
			}
		});
	}, []);

	// Load day data
	const loadDay = useCallback(() => {
		const date = dates[dayIndex];
		api.getTrades(date).then(setRawData);
	}, [dates, dayIndex]);

	useEffect(() => {
		if (dates.length > 0) loadDay();
	}, [loadDay, dates]);

	// Auto-refresh
	useEffect(() => {
		const interval = setInterval(loadDay, REFRESH_SECONDS * 1000);
		return () => clearInterval(interval);
	}, [loadDay]);

	// Live quotes polling
	useEffect(() => {
		if (!rawData?.trades?.length) return;
		const hasSummaries = rawData.trades.some((t) => t.summary);
		if (hasSummaries) return;

		const poll = () => api.getLiveQuotes().then(setLiveQuotes);
		poll();
		const interval = setInterval(poll, LIVE_POLL_SECONDS * 1000);
		return () => clearInterval(interval);
	}, [rawData]);

	const filtered = rawData ? filterByRank(rawData, topFilter) : null;
	const stats = filtered?.trades ? computeStats(filtered.trades) : null;

	// Set first symbol when data loads
	useEffect(() => {
		if (filtered?.trades?.length && !activeSymbol) {
			setActiveSymbol(filtered.trades[0].trade.symbol);
		}
	}, [filtered, activeSymbol]);

	return (
		<>
			<NavBar>
				<TopNFilter value={topFilter} onChange={setTopFilter} />
				<DateNavigator
					dates={dates}
					index={dayIndex}
					onChange={setDayIndex}
				/>
			</NavBar>

			{/* Stock chart section */}
			{filtered?.trades && filtered.trades.length > 0 && (
				<div className="bg-card px-7 py-5">
					<SymbolTabs
						trades={filtered.trades}
						activeSymbol={activeSymbol}
						onSelect={setActiveSymbol}
					/>
					<div className="mt-3 h-[480px] overflow-hidden rounded-lg border bg-muted max-sm:h-[360px]">
						{activeSymbol && (
							<StockChart
								symbol={activeSymbol}
								timeframe={chartTimeframe}
							/>
						)}
					</div>
				</div>
			)}

			{/* Main content */}
			<div className="mx-auto max-w-[1200px] p-5 sm:px-7">
				{!filtered || !filtered.trades?.length ? (
					<div className="py-12 text-center">
						<div className="mb-3 text-4xl opacity-40">&#128200;</div>
						<div className="text-base font-bold">
							{rawData ? "No trades for this date" : "Loading trades..."}
						</div>
						<div className="text-sm text-muted-foreground">
							Trades are published at 9:25 AM ET on market days.
						</div>
					</div>
				) : stats?.hasSummaries ? (
					<>
						<h1 className="mb-1 text-xs font-bold uppercase tracking-widest">
							End of Day Results
						</h1>
						<p className="mb-5 text-xs text-muted-foreground">
							{filtered.trades.length} options picks
							{topFilter < 10 ? ` (Top ${topFilter})` : ""}
						</p>
						<StatsGrid
							totalPnl={stats.totalPnl}
							winRate={stats.winRate}
							profitFactor={stats.profitFactor}
							bestPnl={stats.bestPnl}
							bestSym={stats.bestSym}
						/>
						<div className="mt-5">
							<ExposurePanel
								trades={filtered.trades}
								hasSummaries
							/>
						</div>
						<div className="mt-5">
							<PnlChart trades={filtered.trades} />
						</div>
						<div className="my-5 h-px bg-border" />
						<TradeTable trades={filtered.trades} />
					</>
				) : (
					<>
						<h1 className="mb-1 text-xs font-bold uppercase tracking-widest">
							Today&apos;s Plays
						</h1>
						<p className="mb-5 text-xs text-muted-foreground">
							{filtered.trades.length} options picks
							{topFilter < 10 ? ` (Top ${topFilter})` : ""}{" "}
							&middot; 0-7 DTE &middot; Under $200/contract
						</p>
						<LiveBanner quotes={liveQuotes} />
						<div className="mb-4 flex items-center gap-2 rounded-md border bg-muted/50 p-3 text-xs">
							<span>&#9202;</span>
							<span>
								End-of-day results will be available after 4:05
								PM ET.
							</span>
						</div>
						<ExposurePanel
							trades={filtered.trades}
							hasSummaries={false}
						/>
						<div className="mt-5">
							<MorningCards
								trades={filtered.trades}
								liveQuotes={liveQuotes}
							/>
						</div>
					</>
				)}
			</div>
		</>
	);
}
