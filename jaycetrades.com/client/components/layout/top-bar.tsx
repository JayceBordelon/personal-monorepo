import Link from "next/link";
import { Button } from "@/components/ui/button";

export function TopBar({ onSubscribe }: { onSubscribe?: () => void }) {
	return (
		<div className="flex items-center justify-between border-b bg-card px-7 py-3">
			<Link href="/" className="text-[22px] font-extrabold tracking-tight">
				<span className="text-foreground">Jayce</span>
				<span className="text-primary">Trades</span>
			</Link>
			{onSubscribe && (
				<Button variant="outline" size="sm" onClick={onSubscribe}>
					Subscribe
				</Button>
			)}
		</div>
	);
}
