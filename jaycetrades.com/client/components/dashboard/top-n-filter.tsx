"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const OPTIONS = [1, 3, 5, 10] as const;

export function TopNFilter({
	value,
	onChange,
}: {
	value: number;
	onChange: (n: number) => void;
}) {
	return (
		<ToggleGroup
			type="single"
			value={String(value)}
			onValueChange={(v) => v && onChange(Number(v))}
			variant="outline"
			size="sm"
		>
			{OPTIONS.map((n) => (
				<ToggleGroupItem key={n} value={String(n)} className="text-xs font-semibold">
					Top {n}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}
