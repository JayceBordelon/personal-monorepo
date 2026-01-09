"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@radix-ui/react-tooltip";
import { IconBrandGithub, IconBrandLinkedin } from "@tabler/icons-react";

export default function Header() {
  const router = useRouter();

  return (
    <header className="fixed top-0 z-50 w-full py-4 bg-background">
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
            className="cursor-pointer"
          />
        </button>

        <nav className="flex items-center gap-4">
           <Tooltip>
                <TooltipTrigger asChild>
                  <Button  size="icon" asChild className="cursor-pointer">
                    <Link href="https://github.com/JayceBordelon" target="_blank">
                      <IconBrandGithub className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>GitHub</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button  size="icon" asChild className="cursor-pointer">
                    <Link href="https://linkedin.com/in/JayceBordelon" target="_blank">
                      <IconBrandLinkedin className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>LinkedIn</p>
                </TooltipContent>
              </Tooltip>
        </nav>
      </div>
    </header>
  );
}