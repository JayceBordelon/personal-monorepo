"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function DateRangeNav({
	label,
	canPrev,
	canNext,
	onPrev,
	onNext,
}: {
	label: string;
	canPrev: boolean;
	canNext: boolean;
	onPrev: () => void;
	onNext: () => void;
}) {
	return (
		<div className="flex items-center overflow-hidden rounded-md border bg-muted">
			<Button
				variant="ghost"
				size="icon"
				className="h-7 w-7 rounded-none"
				disabled={!canPrev}
				onClick={onPrev}
			>
				<ChevronLeft className="h-3.5 w-3.5" />
			</Button>
			<span className="min-w-[150px] border-x px-3 py-1 text-center text-xs font-semibold">
				{label}
			</span>
			<Button
				variant="ghost"
				size="icon"
				className="h-7 w-7 rounded-none"
				disabled={!canNext}
				onClick={onNext}
			>
				<ChevronRight className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
}
