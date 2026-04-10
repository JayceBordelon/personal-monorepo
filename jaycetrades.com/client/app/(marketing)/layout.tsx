export default function MarketingLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="flex min-h-dvh items-center justify-center bg-background p-6">
			{children}
		</div>
	);
}
