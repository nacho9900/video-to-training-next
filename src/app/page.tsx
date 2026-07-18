"use client";

import { ApiKeyGate } from "@/components/api-key-gate";
import { VideoPicker } from "@/components/video-picker";
import { ProcessingView } from "@/components/processing-view";
import { TrainingView } from "@/components/training-view";
import { ErrorAlert } from "@/components/error-alert";
import { usePipeline } from "@/lib/use-pipeline";

const PREPARING_STAGES = ["uploading", "gemini_upload", "processing"] as const;

export default function Home() {
  const { stage, progress, videoUrl, markdown, questions, run, reset, error } =
    usePipeline();

  const isPreparing = (PREPARING_STAGES as readonly string[]).includes(stage);
  const isBuilding =
    stage === "generating_docs" ||
    stage === "generating_questions" ||
    stage === "generating_options" ||
    stage === "done";

  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-2xl items-center px-6 py-4">
          <span className="text-sm font-semibold tracking-tight">
            Video to Training
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6">
        <ApiKeyGate>
          {(models) => {
            if (isBuilding) {
              return (
                <TrainingView
                  stage={stage}
                  videoUrl={videoUrl}
                  markdown={markdown}
                  questions={questions}
                  onReset={reset}
                />
              );
            }

            if (isPreparing) {
              return <ProcessingView stage={stage} progress={progress} />;
            }

            return (
              <div className="flex flex-1 flex-col justify-center py-16">
                {error && <ErrorAlert error={error} />}
                <div className="mb-10 flex flex-col gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Turn any explainer video into training material
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Upload a video &mdash; a walkthrough, a lesson, a demo,
                    anything explained on camera &mdash; and Gemini will write
                    the documentation and build a quiz to go with it.
                  </p>
                </div>
                <VideoPicker
                  models={models}
                  onSubmit={(file, model, count) => run(file, model, count)}
                />
              </div>
            );
          }}
        </ApiKeyGate>
      </main>
    </div>
  );
}
