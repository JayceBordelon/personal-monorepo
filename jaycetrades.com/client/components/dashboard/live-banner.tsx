"use client";

import { Badge } from "@/components/ui/badge";
import type { LiveQuotesResponse } from "@/types/trade";

interface LiveBannerProps {
	quotes: LiveQuotesResponse | null;
}

export function LiveBanner({ quotes }: LiveBannerProps) {
	if (!quotes?.connected) return null;

	const asOf = quotes.as_of
		? new Date(quotes.as_of).toLocaleTimeString("en-US", {
				hour: "numeric",
				minute: "2-digit",
				second: "2-digit",
				timeZone: "America/New_York",
			})
		: null;

	return (
		<div className="flex items-center gap-3 rounded-lg border border-green/30 bg-green-bg px-4 py-2">
			<span className="relative flex h-2.5 w-2.5">
				<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green opacity-75" />
				<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green" />
			</span>

			<span className="text-xs font-bold tracking-wider text-green">
				LIVE
			</span>

			{asOf && (
				<span className="text-xs text-muted-foreground">
					Last updated {asOf} ET
				</span>
			)}

			{!quotes.market_open && (
				<Badge variant="outline" className="ml-auto text-[10px]">
					Market Closed
				</Badge>
			)}
		</div>
	);
}
