"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TrainingRecord } from "@/lib/history";
import { cn } from "@/lib/utils";

interface HistorySidebarProps {
  items: TrainingRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function HistorySidebar({
  items,
  selectedId,
  onSelect,
  onNew,
  onDelete,
}: HistorySidebarProps) {
  return (
    <div className="flex h-full flex-col gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={onNew}
        className="w-full justify-start"
      >
        <Plus />
        New training
      </Button>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Your generated trainings will show up here.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => (
              <li key={item.id} className="group/item relative">
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 rounded-md px-2.5 py-2 pr-8 text-left transition-colors hover:bg-muted",
                    selectedId === item.id && "bg-muted",
                  )}
                >
                  <span className="line-clamp-1 w-full text-sm font-medium">
                    {item.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(item.createdAt)} · {item.questions.length} questions
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  aria-label={`Delete ${item.title}`}
                  className="absolute top-2 right-1.5 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-destructive focus-visible:opacity-100 group-hover/item:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
