"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
	{ href: "/", label: "Live Dashboard" },
	{ href: "/history", label: "Historical Analytics" },
];

export function NavBar({ children }: { children?: React.ReactNode }) {
	const pathname = usePathname();

	return (
		<div className="flex items-stretch justify-between border-b bg-card px-7">
			<div className="flex items-stretch">
				{tabs.map((tab) => (
					<Link
						key={tab.href}
						href={tab.href}
						className={cn(
							"flex items-center border-b-2 px-5 py-3 text-[13px] font-semibold tracking-wide transition-colors",
							pathname === tab.href
								? "border-primary font-bold text-primary"
								: "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
						)}
					>
						{tab.label}
					</Link>
				))}
			</div>
			{children && (
				<div className="flex flex-wrap items-center gap-3 py-2">
					{children}
				</div>
			)}
		</div>
	);
}
