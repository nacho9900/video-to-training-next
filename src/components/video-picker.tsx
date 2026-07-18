"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileVideo, Sparkles, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { ModelSelect, pickDefaultModelId } from "@/components/model-select";
import type { ModelInfo } from "@/lib/models";
import { DEFAULT_MODEL_ID } from "@/lib/models";
import {
  DEFAULT_NUMBER_OF_QUESTIONS,
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  QUESTIONS_STEP,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

interface VideoPickerProps {
  models: ModelInfo[];
  onSubmit: (file: File, model: string, numberOfQuestions: number) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function VideoPicker({ models, onSubmit }: VideoPickerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [model, setModel] = useState(() =>
    pickDefaultModelId(models, DEFAULT_MODEL_ID),
  );
  const [numberOfQuestions, setNumberOfQuestions] = useState(
    DEFAULT_NUMBER_OF_QUESTIONS,
  );
  const inputRef = useRef<HTMLInputElement>(null);

  // Derived, not stateful: recomputed whenever `file` changes, and revoked
  // once the resulting URL is no longer the current one.
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFiles = useCallback((files: FileList | null) => {
    const next = files?.[0];
    if (next && next.type.startsWith("video/")) {
      setFile(next);
    }
  }, []);

  return (
    <div className="flex w-full flex-col gap-6">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "group flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
          isDragging
            ? "border-foreground/40 bg-muted/60"
            : "border-border hover:border-foreground/30 hover:bg-muted/30",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {!file ? (
          <>
            <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
              <UploadCloud className="size-5" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">
                Drop a video here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                MP4, MOV, WebM &mdash; any topic, from a quick tip to a deep
                dive
              </p>
            </div>
          </>
        ) : (
          <div className="flex w-full max-w-sm flex-col items-center gap-3">
            {previewUrl && (
              <video
                src={previewUrl}
                className="aspect-video w-full rounded-lg bg-black object-contain"
                muted
              />
            )}
            <div className="flex w-full items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-left">
              <div className="flex min-w-0 items-center gap-2">
                <FileVideo className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                aria-label="Remove selected video"
              >
                <X />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ModelSelect models={models} value={model} onChange={setModel} />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="question-count">Questions</Label>
          <span className="text-sm font-medium tabular-nums text-muted-foreground">
            {numberOfQuestions}
          </span>
        </div>
        <Slider
          id="question-count"
          min={MIN_QUESTIONS}
          max={MAX_QUESTIONS}
          step={QUESTIONS_STEP}
          value={[numberOfQuestions]}
          onValueChange={(value) =>
            setNumberOfQuestions(Array.isArray(value) ? value[0] : value)
          }
          aria-label="Number of questions"
        />
      </div>

      <Button
        size="lg"
        disabled={!file}
        onClick={() => file && onSubmit(file, model, numberOfQuestions)}
        className="w-full"
      >
        <Sparkles />
        Generate training
      </Button>
    </div>
  );
}
