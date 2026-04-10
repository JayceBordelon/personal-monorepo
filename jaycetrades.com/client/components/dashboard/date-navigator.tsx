"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateShort } from "@/lib/date-utils";

export function DateNavigator({
	dates,
	index,
	onChange,
}: {
	dates: string[];
	index: number;
	onChange: (i: number) => void;
}) {
	const label =
		dates.length > 0 && index < dates.length
			? formatDateShort(dates[index])
			: "No data";

	return (
		<div className="flex items-center overflow-hidden rounded-md border bg-muted">
			<Button
				variant="ghost"
				size="icon"
				className="h-7 w-7 rounded-none"
				disabled={index >= dates.length - 1}
				onClick={() => onChange(index + 1)}
			>
				<ChevronLeft className="h-3.5 w-3.5" />
			</Button>
			<span className="min-w-[130px] border-x px-3 py-1 text-center text-xs font-semibold">
				{label}
			</span>
			<Button
				variant="ghost"
				size="icon"
				className="h-7 w-7 rounded-none"
				disabled={index <= 0}
				onClick={() => onChange(index - 1)}
			>
				<ChevronRight className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
}
