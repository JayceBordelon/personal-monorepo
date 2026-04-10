import type { Metadata } from "next";
import Link from "next/link";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { SubscribeForm, UnsubscribeForm } from "@/components/subscribe/subscribe-form";

export const metadata: Metadata = {
	title: "Subscribe | JayceTrades",
	description:
		"Get free AI-powered daily options picks delivered to your inbox. 10 ranked trades before market open, EOD results at close.",
};

export default function SubscribePage() {
	return (
		<Card className="w-full max-w-md">
			<CardHeader className="text-center">
				<div className="mb-4 text-[28px] font-extrabold tracking-tight">
					<span className="text-foreground">Jayce</span>
					<span className="text-primary">Trades</span>
				</div>
				<CardTitle className="text-xl">
					Free daily options picks
				</CardTitle>
				<CardDescription>
					AI-powered, ranked by conviction, delivered before market
					open.
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-5">
				<div className="flex gap-2">
					<div className="flex-1 rounded-lg border bg-muted p-3 text-center">
						<div className="font-mono text-xl font-extrabold text-primary">
							10
						</div>
						<div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
							Ranked Picks
						</div>
					</div>
					<div className="flex-1 rounded-lg border bg-muted p-3 text-center">
						<div className="font-mono text-xl font-extrabold text-primary">
							2x
						</div>
						<div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
							AM + EOD
						</div>
					</div>
					<div className="flex-1 rounded-lg border bg-muted p-3 text-center">
						<div className="font-mono text-xl font-extrabold text-primary">
							$0
						</div>
						<div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
							Always Free
						</div>
					</div>
				</div>

				<SubscribeForm />

				<div className="border-t pt-4 text-center">
					<UnsubscribeSection />
				</div>
			</CardContent>

			<CardFooter className="flex flex-col gap-2 text-center">
				<p className="text-[10px] text-muted-foreground">
					<strong>Disclaimer:</strong> Not financial advice. Options
					trading involves substantial risk. Trade responsibly.
				</p>
				<Link
					href="/dashboard"
					className="text-xs text-primary underline underline-offset-2 hover:text-foreground"
				>
					View live dashboard
				</Link>
			</CardFooter>
		</Card>
	);
}

function UnsubscribeSection() {
	return (
		<details className="group">
			<summary className="cursor-pointer text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
				Need to unsubscribe?
			</summary>
			<div className="mt-3">
				<UnsubscribeForm />
			</div>
		</details>
	);
}
