"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink } from "lucide-react";

export default function Header() {
  const router = useRouter();

  return (
    <header className="fixed top-0 z-50 w-full py-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
        <button
          onClick={() => router.push("/")}
          className="flex items-center transition-opacity hover:opacity-80"
        >
          <Image
            src="/images/logo.png"
            alt="Jayce Bordelon"
            width={48}
            height={48}
          />
        </button>

        <nav className="flex items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="https://jayceb.blog" target="_blank" rel="noopener noreferrer">
              Blog
              <ExternalLink className="ml-1.5 h-3 w-3" />
            </Link>
          </Button>

          <Button size="sm" asChild>
            <Link href="/Resume.pdf" target="_blank" rel="noopener noreferrer">
              <FileText className="mr-1.5 h-4 w-4" />
              Resume
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}