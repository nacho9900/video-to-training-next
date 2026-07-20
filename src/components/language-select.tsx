"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { LANGUAGES } from "@/lib/languages";

interface LanguageSelectProps {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

export function LanguageSelect({
  value,
  onChange,
  disabled,
}: LanguageSelectProps) {
  const selected = LANGUAGES.find((l) => l.id === value);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="language-select" className="text-muted-foreground">
        Training language
      </Label>
      <Select
        value={value}
        onValueChange={(next) => {
          if (typeof next === "string") onChange(next);
        }}
        disabled={disabled}
      >
        <SelectTrigger id="language-select" className="w-full">
          <SelectValue>{selected?.label ?? "Choose a language"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {LANGUAGES.map((lang) => (
            <SelectItem key={lang.id} value={lang.id}>
              {lang.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
