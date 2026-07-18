"use client";

import { useState } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { STAGE_LABELS } from "@/lib/stages";
import type { PipelineError } from "@/lib/use-pipeline";

interface ErrorAlertProps {
  error: PipelineError;
}

export function ErrorAlert({ error }: ErrorAlertProps) {
  const [copied, setCopied] = useState(false);
  const stepLabel = STAGE_LABELS[error.step];

  const debugText = [
    "[video-to-training] error",
    `step: ${stepLabel} (${error.step})`,
    `message: ${error.message}`,
  ].join("\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(debugText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (e.g. non-secure context) — ignore.
    }
  };

  return (
    <Alert variant="destructive" className="mb-8">
      <TriangleAlert />
      <AlertTitle className="flex items-center justify-between gap-2">
        <span>Failed while: {stepLabel.toLowerCase()}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="-my-1 h-7 gap-1.5 px-2 text-xs"
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy details"}
        </Button>
      </AlertTitle>
      <AlertDescription className="break-words">
        {error.message}
      </AlertDescription>
    </Alert>
  );
}
