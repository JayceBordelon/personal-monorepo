"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const OPTIONS = [
	{ value: "week", label: "Week" },
	{ value: "month", label: "Month" },
	{ value: "year", label: "Year" },
	{ value: "all", label: "All" },
] as const;

export function ModeToggle({
	mode,
	onChange,
}: {
	mode: string;
	onChange: (mode: string) => void;
}) {
	return (
		<Tabs value={mode} onValueChange={onChange}>
			<TabsList>
				{OPTIONS.map((o) => (
					<TabsTrigger key={o.value} value={o.value}>
						{o.label}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}
