"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  IconBrandGithub,
  IconBrandLinkedin,
  IconMail,
  IconWriting,
} from "@tabler/icons-react";
import { toast } from "sonner";
import TypingText from "@/components/ui/shadcn-io/typing-text";

export default function HeroSection() {
  const handleClick = async () => {
    navigator.clipboard.writeText("jayce@occupai.us");
    toast.success("Copied jayce@occupai.us to clipboard!");
  };

  return (
    <section className="flex items-center justify-center px-4 h-screen">
      <div className="max-w-4xl w-full flex flex-col md:flex-row items-center gap-6 md:gap-12">
        {/* Headshot */}
        <motion.div
          className="shrink-0"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative">
            <div className="absolute -inset-2 bg-primary/20 blur-2xl rounded-3xl" />
            <Image
              src="/images/dawg.jpg"
              alt="Jayce Bordelon"
              width={240}
              height={240}
              className="relative rounded-2xl w-40 sm:w-60 md:w-80 h-auto"
              priority
            />
          </div>
        </motion.div>

        {/* Content */}
        <div className="text-center ">
          <motion.h1
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-l from-primary to-foreground bg-clip-text text-transparent"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Jayce Bordelon
          </motion.h1>

          {/* Typing Text Role */}
          <motion.div
            className="my-2 h-7 sm:h-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <TypingText
              text={[
                "Mastercard - SWE",
                "OccupAI - Co-Founder",
                "WashU - CS Alum",
              ]}
              typingSpeed={60}
              pauseDuration={4000}
              deletingSpeed={40}
              showCursor={true}
              cursorClassName="h-10 w-1 bg-primary inline-block ml-1"
              className="text-2xl sm:text-4xl bg-gradient-to-l from-primary to-foreground bg-clip-text text-transparent"
              variableSpeed={{ min: 50, max: 80 }}
              loop={true}
            />
          </motion.div>

          {/* Links */}
          <motion.div
            className="mt-8 flex flex-wrap items-center justify-center md:justify-around gap-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleClick}
                    size="icon"
                    className="cursor-pointer"
                  >
                    <IconMail className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy email</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" asChild className="cursor-pointer">
                    <Link href="https://occupai.us" target="_blank">
                      <Image
                        width={24}
                        height={24}
                        src="/images/occy.png"
                        alt="occy"
                      />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>OccupAI</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" asChild className="cursor-pointer">
                    <Link
                      href="https://github.com/JayceBordelon"
                      target="_blank"
                    >
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
                  <Button size="icon" asChild className="cursor-pointer">
                    <Link
                      href="https://linkedin.com/in/JayceBordelon"
                      target="_blank"
                    >
                      <IconBrandLinkedin className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>LinkedIn</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" asChild className="cursor-pointer">
                    <Link href="https://jayceb.blog" target="_blank">
                      <IconWriting className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Blog</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
