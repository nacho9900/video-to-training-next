"use client";

import { Check, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { StageId } from "@/lib/types";
import { STAGE_LABELS } from "@/lib/stages";
import type { PipelineStage } from "@/lib/use-pipeline";
import { cn } from "@/lib/utils";

interface Step {
  id: StageId;
  label: string;
  note?: string;
}

// Only the "getting ready" phase lives here. Once Gemini has ingested the
// video, the training builds live in TrainingView instead of a stepper.
const STEPS: Step[] = [
  { id: "uploading", label: STAGE_LABELS.uploading },
  { id: "gemini_upload", label: STAGE_LABELS.gemini_upload },
  {
    id: "processing",
    label: STAGE_LABELS.processing,
    note: "This can take a little while for longer videos.",
  },
];

function stepStatus(
  stepId: StageId,
  stage: PipelineStage,
): "done" | "current" | "pending" {
  if (stage === "idle") return "pending";
  if (stage === "done") return "done";
  const order = STEPS.map((s) => s.id);
  const currentIndex = order.indexOf(stage);
  const stepIndex = order.indexOf(stepId);
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "current";
  return "pending";
}

interface ProcessingViewProps {
  stage: PipelineStage;
  progress: number;
}

export function ProcessingView({ stage, progress }: ProcessingViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-1 py-16">
      {STEPS.map((step, idx) => {
        const status = stepStatus(step.id, stage);
        const isLast = idx === STEPS.length - 1;
        return (
          <div key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs transition-colors",
                  status === "done" &&
                    "border-transparent bg-primary text-primary-foreground",
                  status === "current" &&
                    "border-foreground/30 bg-background text-foreground",
                  status === "pending" &&
                    "border-border bg-background text-muted-foreground",
                )}
              >
                {status === "done" ? (
                  <Check className="size-3.5" />
                ) : status === "current" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <span className="size-1.5 rounded-full bg-current" />
                )}
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "my-0.5 w-px flex-1",
                    status === "done" ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </div>
            <div className={cn("flex flex-col pb-6", isLast && "pb-0")}>
              <p
                className={cn(
                  "text-sm font-medium transition-colors",
                  status === "pending" && "text-muted-foreground",
                )}
              >
                {step.label}
              </p>
              {status === "current" && step.note && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {step.note}
                </p>
              )}
              {status === "current" && step.id === "uploading" && (
                <Progress value={progress} className="mt-2 w-48" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
