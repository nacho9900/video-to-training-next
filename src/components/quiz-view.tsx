"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, CircleCheck, FileText, RotateCcw } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { GeneratedQuestion } from "@/lib/types";
import { cn } from "@/lib/utils";

interface QuizViewProps {
  videoUrl: string;
  markdown: string;
  questions: GeneratedQuestion[];
  onReset: () => void;
}

const OPTION_LETTERS = ["A", "B", "C", "D"];

function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

/** Minimal markdown-to-JSX renderer: headings, bullet lists, and paragraphs. */
function renderMarkdown(markdown: string): ReactNode[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push(
        <p key={blocks.length} className="text-sm leading-relaxed text-foreground/90">
          {paragraph.join(" ")}
        </p>,
      );
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={blocks.length} className="list-disc space-y-1 pl-5 text-sm text-foreground/90">
          {list.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const h3 = line.match(/^###\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h1 = line.match(/^#\s+(.*)/);
    const bullet = line.match(/^[-*]\s+(.*)/);

    if (h3) {
      flushParagraph();
      flushList();
      blocks.push(
        <h3 key={blocks.length} className="mt-4 text-sm font-semibold first:mt-0">
          {h3[1]}
        </h3>,
      );
    } else if (h2) {
      flushParagraph();
      flushList();
      blocks.push(
        <h2 key={blocks.length} className="mt-5 text-base font-semibold first:mt-0">
          {h2[1]}
        </h2>,
      );
    } else if (h1) {
      flushParagraph();
      flushList();
      blocks.push(
        <h1 key={blocks.length} className="mt-5 text-lg font-semibold first:mt-0">
          {h1[1]}
        </h1>,
      );
    } else if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

export function QuizView({ videoUrl, markdown, questions, onReset }: QuizViewProps) {
  const [docsOpen, setDocsOpen] = useState(false);

  return (
    <div className="flex w-full flex-col gap-8 py-10">
      <video
        src={videoUrl}
        controls
        className="w-full rounded-xl bg-black shadow-sm"
      />

      <Collapsible open={docsOpen} onOpenChange={setDocsOpen}>
        <Card>
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
            <span className="flex items-center gap-2 text-sm font-medium">
              <FileText className="size-4 text-muted-foreground" />
              Documentation
            </span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                docsOpen && "rotate-180",
              )}
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Separator />
            <CardContent className="pt-4">{renderMarkdown(markdown)}</CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            {questions.length} questions
          </h2>
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw />
            Start over
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          {questions.map((q) => {
            const options = [...q.options].sort((a, b) => a.order - b.order);
            return (
              <Card key={q.order}>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-start gap-2">
                    <Badge variant="secondary" className="mt-0.5 shrink-0">
                      {q.order}
                    </Badge>
                    <p className="text-sm font-medium leading-relaxed">
                      {q.question}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    {options.map((option, idx) => (
                      <div key={idx} className="flex flex-col gap-2">
                        <div
                          className={cn(
                            "flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm",
                            option.isCorrect
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-300"
                              : "border-border text-foreground/80",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                              option.isCorrect
                                ? "bg-emerald-500 text-white"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {option.isCorrect ? (
                              <CircleCheck className="size-3.5" />
                            ) : (
                              OPTION_LETTERS[idx] ?? "?"
                            )}
                          </span>
                          <span className="pt-0.5">{option.text}</span>
                        </div>
                        {option.isCorrect && (
                          <div className="ml-7 flex flex-col gap-1.5 rounded-lg bg-muted/50 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-[0.7rem]">
                                {formatTimestamp(q.timestamp)}
                              </Badge>
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                              {q.correctReason}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
