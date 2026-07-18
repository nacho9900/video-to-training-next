"use client";

import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  CircleCheck,
  ExternalLink,
  FileText,
  Loader2,
  RotateCcw,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Reveal } from "@/components/reveal";
import { DISTRACTORS_MODEL_ID, modelLabel } from "@/lib/models";
import type { BuildingQuestion, QuestionOption } from "@/lib/types";
import type { PipelineStage } from "@/lib/use-pipeline";
import { cn } from "@/lib/utils";

interface TrainingViewProps {
  stage: PipelineStage;
  videoUrl: string | null;
  markdown: string | null;
  docsFailed: boolean;
  questions: BuildingQuestion[];
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
        <p
          key={blocks.length}
          className="text-sm leading-relaxed text-foreground/90"
        >
          {paragraph.join(" ")}
        </p>,
      );
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul
          key={blocks.length}
          className="list-disc space-y-1 pl-5 text-sm text-foreground/90"
        >
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
        <h3
          key={blocks.length}
          className="mt-4 text-sm font-semibold first:mt-0"
        >
          {h3[1]}
        </h3>,
      );
    } else if (h2) {
      flushParagraph();
      flushList();
      blocks.push(
        <h2
          key={blocks.length}
          className="mt-5 text-base font-semibold first:mt-0"
        >
          {h2[1]}
        </h2>,
      );
    } else if (h1) {
      flushParagraph();
      flushList();
      blocks.push(
        <h1
          key={blocks.length}
          className="mt-5 text-lg font-semibold first:mt-0"
        >
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

function OptionRow({
  option,
  letterIndex,
  correctReason,
  timestamp,
}: {
  option: QuestionOption;
  letterIndex: number;
  correctReason: string;
  timestamp: number;
}) {
  return (
    <div className="flex flex-col gap-2">
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
            (OPTION_LETTERS[letterIndex] ?? "?")
          )}
        </span>
        <span className="pt-0.5">{option.text}</span>
      </div>
      {option.isCorrect && (
        <div className="ml-7 flex flex-col gap-1.5 rounded-lg bg-muted/50 px-3 py-2">
          <Badge variant="outline" className="w-fit font-mono text-[0.7rem]">
            {formatTimestamp(timestamp)}
          </Badge>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {correctReason}
          </p>
        </div>
      )}
    </div>
  );
}

function QuestionCard({ question }: { question: BuildingQuestion }) {
  const options = question.options
    ? [...question.options].sort((a, b) => a.order - b.order)
    : null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start gap-2">
          <Badge variant="secondary" className="mt-0.5 shrink-0">
            {question.order}
          </Badge>
          <p className="text-sm font-medium leading-relaxed">
            {question.question}
          </p>
        </div>

        {options ? (
          <Reveal className="flex flex-col gap-2">
            {options.map((option, idx) => (
              <OptionRow
                key={idx}
                option={option}
                letterIndex={idx}
                correctReason={question.correctReason}
                timestamp={question.timestamp}
              />
            ))}
          </Reveal>
        ) : (
          <div className="flex flex-col gap-2" aria-hidden>
            {Array.from({ length: 4 }).map((_, idx) => (
              <Skeleton key={idx} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TrainingView({
  stage,
  videoUrl,
  markdown,
  docsFailed,
  questions,
  onReset,
}: TrainingViewProps) {
  const [docsOpen, setDocsOpen] = useState(false);
  const [videoBroken, setVideoBroken] = useState(false);

  const answered = questions.filter((q) => q.options).length;
  const total = questions.length;
  const isDone = stage === "done";

  return (
    <div className="flex w-full flex-col gap-8 py-10">
      {videoUrl && (
        <Reveal>
          {videoBroken ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border bg-muted/30 px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                This video format can&apos;t be previewed inline in your
                browser.
              </p>
              <a
                href={videoUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline underline-offset-4"
              >
                <ExternalLink className="size-3.5" />
                Open the video in a new tab
              </a>
            </div>
          ) : (
            <video
              src={videoUrl}
              controls
              playsInline
              preload="metadata"
              onError={() => setVideoBroken(true)}
              className="w-full rounded-xl bg-black shadow-sm"
            />
          )}
        </Reveal>
      )}

      {/* Documentation */}
      {markdown ? (
        <Reveal>
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
                <CardContent className="pt-4">
                  {renderMarkdown(markdown)}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </Reveal>
      ) : docsFailed ? (
        <p className="text-sm text-muted-foreground">
          Documentation couldn&apos;t be generated for this video.
        </p>
      ) : (
        <PendingRow label="Writing documentation" />
      )}

      {/* Questions */}
      {total > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-medium text-muted-foreground">
                {total} questions
                {!isDone && answered < total && (
                  <span className="ml-1.5 text-xs">
                    · building answers {answered}/{total}
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground/80">
                Answer options use {modelLabel(DISTRACTORS_MODEL_ID)}, a lighter
                and cheaper model.
              </p>
            </div>
            {isDone && (
              <Button
                variant="outline"
                size="sm"
                onClick={onReset}
                className="shrink-0"
              >
                <RotateCcw />
                Start over
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {questions.map((q, idx) => (
              <Reveal key={q.order} delayMs={Math.min(idx, 8) * 70}>
                <QuestionCard question={q} />
              </Reveal>
            ))}
          </div>
        </div>
      ) : (
        <PendingRow label="Generating questions" />
      )}
    </div>
  );
}

function PendingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}…
    </div>
  );
}
