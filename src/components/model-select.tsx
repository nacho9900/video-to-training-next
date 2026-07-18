"use client";

import { Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { ModelInfo } from "@/lib/models";

interface ModelSelectProps {
  models: ModelInfo[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

export function ModelSelect({
  models,
  value,
  onChange,
  disabled,
}: ModelSelectProps) {
  const selected = models.find((m) => m.id === value);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="model-select" className="text-muted-foreground">
        Model
      </Label>
      <Select
        value={value}
        onValueChange={(next) => {
          if (typeof next === "string") onChange(next);
        }}
        disabled={disabled}
      >
        <SelectTrigger id="model-select" className="w-full">
          <SelectValue>{selected?.label ?? "Choose a model"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model.id} value={model.id} disabled={!model.enabled}>
              <div className="flex w-full flex-col gap-0.5 py-0.5">
                <span className="flex items-center gap-1.5">
                  {model.label}
                  {model.recommended && (
                    <Badge variant="secondary" className="gap-1">
                      <Sparkles className="size-3" />
                      Recommended
                    </Badge>
                  )}
                </span>
                {model.hint && (
                  <span className="text-xs text-muted-foreground">
                    {model.hint}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Picks DEFAULT_MODEL_ID if it's enabled, otherwise the first enabled model. */
export function pickDefaultModelId(
  models: ModelInfo[],
  defaultModelId: string,
): string {
  const preferred = models.find((m) => m.id === defaultModelId && m.enabled);
  if (preferred) return preferred.id;
  const firstEnabled = models.find((m) => m.enabled);
  return firstEnabled?.id ?? defaultModelId;
}
