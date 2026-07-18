"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, KeyRound, RotateCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ConfigResponse } from "@/lib/types";
import type { ModelInfo } from "@/lib/models";

interface ApiKeyGateProps {
  children: (models: ModelInfo[]) => React.ReactNode;
}

type GateState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; config: ConfigResponse };

export function ApiKeyGate({ children }: ApiKeyGateProps) {
  const [state, setState] = useState<GateState>({ status: "loading" });

  // Fetches the config without resetting to "loading" first, so it's safe to
  // call synchronously from an effect body.
  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      const config = (await res.json()) as ConfigResponse;
      setState({ status: "ready", config });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Something went wrong.",
      });
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const recheck = useCallback(() => {
    setState({ status: "loading" });
    loadConfig();
  }, [loadConfig]);

  if (state.status === "loading") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 py-16">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-9 w-28" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 py-16 text-center">
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Couldn&apos;t load configuration</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={recheck}>
          <RotateCw />
          Retry
        </Button>
      </div>
    );
  }

  if (!state.config.hasKey) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center py-16">
        <Card className="w-full">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-muted">
              <KeyRound className="size-5 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg">Gemini API key required</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ol className="flex flex-col gap-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
                  1
                </span>
                <span>
                  Get a free key at{" "}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground underline underline-offset-3"
                  >
                    aistudio.google.com/apikey
                  </a>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
                  2
                </span>
                <span>
                  Create a <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code> file with{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">
                    GEMINI_API_KEY=your_key
                  </code>
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
                  3
                </span>
                <span>Restart the dev server</span>
              </li>
            </ol>
            <Button onClick={recheck} variant="outline" className="self-start">
              <RotateCw />
              Recheck
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children(state.config.models)}</>;
}
