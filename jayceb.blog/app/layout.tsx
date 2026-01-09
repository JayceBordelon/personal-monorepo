import type { Metadata } from "next";

import "./globals.css";
import { ThemeProvider } from "next-themes";
import { BackgroundPaths } from "@/components/ui/shadcn-io/background-paths";
import { Toaster } from "sonner";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import Header from "@/components/header";


export const metadata: Metadata = {
  title: "Jayce Bordelon | Software Engineer",
  description: "Software Engineer at Mastercard specializing in microservices, distributed systems, and full-stack development. Co-Founder & CTO of OccupAI. Washington University in St. Louis CS graduate.",
  keywords: [
    "Jayce Bordelon",
    "Software Engineer",
    "Mastercard",
    "Full Stack Developer",
    "React",
    "Next.js",
    "TypeScript",
    "Java",
    "Spring Boot",
    "Microservices",
    "Kubernetes",
    "Docker",
    "Computer Vision",
    "Artificial Intelligence",
    "Machine Learning",
    "St. Louis",
    "Washington University"
  ],
  authors: [{ name: "Jayce Bordelon" }],
  creator: "Jayce Bordelon",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://jayceb.com",
    title: "Jayce Bordelon | Software Engineer",
    description: "Software Engineer at Mastercard specializing in microservices, distributed systems, and full-stack development. Co-Founder & CTO of OccupAI.",
    siteName: "Jayce Bordelon",
    images: [
      {
        url: "/headshot.jpg",
        width: 800,
        height: 800,
        alt: "Jayce Bordelon - Software Engineer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Jayce Bordelon | Software Engineer",
    description: "Software Engineer at Mastercard specializing in microservices, distributed systems, and full-stack development.",
    images: ["/headshot.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
          <TooltipProvider>
            <Header />
          {children}
          <BackgroundPaths/>
          <Toaster theme="system" richColors/>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
