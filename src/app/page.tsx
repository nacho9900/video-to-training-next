"use client";

import { ApiKeyGate } from "@/components/api-key-gate";
import { VideoPicker } from "@/components/video-picker";
import { ProcessingView } from "@/components/processing-view";
import { QuizView } from "@/components/quiz-view";
import { usePipeline } from "@/lib/use-pipeline";

export default function Home() {
  const { stage, progress, run, reset, result } = usePipeline();

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
            if (stage === "done" && result) {
              return (
                <QuizView
                  videoUrl={result.videoUrl}
                  markdown={result.markdown}
                  questions={result.questions}
                  onReset={reset}
                />
              );
            }

            if (stage !== "idle") {
              return <ProcessingView stage={stage} progress={progress} />;
            }

            return (
              <div className="flex flex-1 flex-col justify-center py-16">
                <div className="mb-10 flex flex-col gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Turn any explainer video into training material
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Upload a video &mdash; a walkthrough, a lesson, a demo,
                    anything explained on camera &mdash; and Gemini will write
                    the documentation and build a 20-question quiz to go with
                    it.
                  </p>
                </div>
                <VideoPicker
                  models={models}
                  onSubmit={(file, model) => run(file, model)}
                />
              </div>
            );
          }}
        </ApiKeyGate>
      </main>
    </div>
  );
}
