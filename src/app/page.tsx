"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { ApiKeyGate } from "@/components/api-key-gate";
import { VideoPicker } from "@/components/video-picker";
import { ProcessingView } from "@/components/processing-view";
import { TrainingView } from "@/components/training-view";
import { ErrorAlert } from "@/components/error-alert";
import { HistorySidebar } from "@/components/history-sidebar";
import { GitHubIcon } from "@/components/brand-icons";
import { Button } from "@/components/ui/button";
import { deleteTraining, useHistory } from "@/lib/history";
import { usePipeline } from "@/lib/use-pipeline";
import { cn } from "@/lib/utils";

const REPO_URL = "https://github.com/nacho9900/video-to-training-next";
const PREPARING_STAGES = ["uploading", "gemini_upload", "processing"] as const;

export default function Home() {
  const {
    stage,
    progress,
    videoUrl,
    title,
    markdown,
    docsFailed,
    questions,
    run,
    reset,
    error,
  } = usePipeline();

  const history = useHistory();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  const selected = selectedId
    ? (history.find((h) => h.id === selectedId) ?? null)
    : null;

  const isPreparing = (PREPARING_STAGES as readonly string[]).includes(stage);
  const isBuilding =
    stage === "generating_docs" ||
    stage === "generating_questions" ||
    stage === "generating_options" ||
    stage === "done";

  const wide = !selected && isBuilding;

  const startNew = () => {
    setSelectedId(null);
    setMobileHistoryOpen(false);
    reset();
  };
  const openHistoryItem = (id: string) => {
    setSelectedId(id);
    setMobileHistoryOpen(false);
  };
  const handleDelete = (id: string) => {
    deleteTraining(id);
    if (selectedId === id) setSelectedId(null);
  };

  const historyPanel = (
    <HistorySidebar
      items={history}
      selectedId={selectedId}
      onSelect={openHistoryItem}
      onNew={startNew}
      onDelete={handleDelete}
    />
  );

  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="border-b">
        <div className="flex w-full items-center justify-between gap-3 px-6 py-4">
          <span className="text-sm font-semibold tracking-tight">
            Video to Training
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setMobileHistoryOpen(true)}
              aria-label="History"
            >
              <History />
            </Button>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Source code on GitHub"
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <GitHubIcon className="size-[18px]" />
            </a>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <main className="min-w-0 flex-1">
          <div
            className={cn(
              "mx-auto flex h-full w-full flex-col px-6",
              wide ? "max-w-5xl" : "max-w-2xl",
            )}
          >
            {selected ? (
              <TrainingView
                stage="done"
                videoUrl={null}
                title={selected.title}
                markdown={selected.markdown}
                docsFailed={false}
                questions={selected.questions}
                onReset={startNew}
              />
            ) : (
              <ApiKeyGate>
                {(models) => {
                  if (isBuilding) {
                    return (
                      <TrainingView
                        stage={stage}
                        videoUrl={videoUrl}
                        title={title}
                        markdown={markdown}
                        docsFailed={docsFailed}
                        questions={questions}
                        onReset={startNew}
                      />
                    );
                  }

                  if (isPreparing) {
                    return (
                      <ProcessingView stage={stage} progress={progress} />
                    );
                  }

                  return (
                    <div className="flex flex-1 flex-col justify-center py-16">
                      {error && <ErrorAlert error={error} />}
                      <div className="mb-10 flex flex-col gap-2">
                        <h1 className="text-2xl font-semibold tracking-tight">
                          Turn any explainer video into training material
                        </h1>
                        <p className="text-sm text-muted-foreground">
                          Upload a video &mdash; a walkthrough, a lesson, a
                          demo, anything explained on camera &mdash; and Gemini
                          will write the documentation and build a quiz to go
                          with it.
                        </p>
                      </div>
                      <VideoPicker
                        models={models}
                        onSubmit={(file, model, count) =>
                          run(file, model, count)
                        }
                      />
                    </div>
                  );
                }}
              </ApiKeyGate>
            )}
          </div>
        </main>

        {/* History: right sidebar on desktop */}
        <aside className="hidden w-72 shrink-0 border-l lg:block">
          <div className="sticky top-0 h-screen p-3">{historyPanel}</div>
        </aside>
      </div>

      {/* History: drawer on mobile */}
      {mobileHistoryOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileHistoryOpen(false)}
          />
          <div className="absolute top-0 right-0 h-full w-72 max-w-[80%] border-l bg-background p-3 shadow-xl">
            {historyPanel}
          </div>
        </div>
      )}
    </div>
  );
}
