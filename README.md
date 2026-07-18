# Video to Training

Turn a screen recording into training material. Upload a video and Google
Gemini analyzes it, writes documentation, and builds a 20-question
multiple-choice quiz from what actually happens on screen.

Built with **Next.js 16** (App Router), **shadcn/ui**, and the
**Google Gemini API**.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## How it works

1. You pick a video and a Gemini model.
2. The video is uploaded to **Vercel Blob** (directly from the browser, so it
   isn't limited by the serverless request body size).
3. The server hands the video to the **Gemini Files API** and waits for it to
   be processed.
4. Gemini writes **documentation** and a set of **20 questions with correct
   answers, explanations, and video timestamps**.
5. For each question, plausible-but-wrong **distractors** are generated, and
   the options are shuffled.
6. You get the video back with collapsible documentation and the full quiz.

The heavy work is split across several short API calls (orchestrated from the
client) rather than one long request — see
[Why the pipeline is split](#why-the-pipeline-is-split).

---

## Requirements

- **Node.js 20+** and **pnpm**
- A **Gemini API key** (free): https://aistudio.google.com/apikey

The app validates the key on startup — if `GEMINI_API_KEY` is missing you'll
see an instructions screen instead of the app.

---

## Getting started

```bash
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm dev
```

Open http://localhost:3000.

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | **Yes** | Your Google Gemini API key. Get one at [AI Studio](https://aistudio.google.com/apikey). |
| `BLOB_READ_WRITE_TOKEN` | For deploy / large videos | Vercel Blob token used to upload the video. Auto-provisioned on Vercel when you link a Blob store; for local dev run `vercel env pull` or paste it in `.env.local`. |
| `DISABLED_MODELS` | No | Comma-separated model ids to hide from the picker and reject server-side. Handy for a public demo, e.g. `DISABLED_MODELS=gemini-3.1-pro-preview` so visitors can't drain your quota on the expensive model. |

---

## Models

The picker (styled like Claude's model selector) exposes:

| Model | Notes |
| --- | --- |
| `gemini-3.5-flash` | Default — fast and cheap |
| `gemini-3.1-flash-lite` | Lightest / fastest |
| `gemini-3.1-pro-preview` | Recommended for the best results |

Disabled models (via `DISABLED_MODELS`) appear greyed out and are also
rejected by the API, so the restriction can't be bypassed from the client.

---

## Deploying to Vercel

1. Import the repo into Vercel.
2. Add a **Blob store** (Storage → Create → Blob) and link it to the project —
   this sets `BLOB_READ_WRITE_TOKEN` automatically.
3. Set `GEMINI_API_KEY` (and optionally `DISABLED_MODELS`) in the project's
   environment variables.
4. Deploy.

> **Tip for a public demo:** set `DISABLED_MODELS=gemini-3.1-pro-preview` so
> people trying it out use the cheaper flash model.

---

## Why the pipeline is split

Vercel Functions have a fixed maximum duration (300s on Hobby; up to 800s on
Pro). Uploading a long video, waiting for Gemini to ingest it, and generating
documentation + 20 questions + 60 distractors can easily exceed that in a
single request.

Since a Gemini-uploaded file persists (~48h) and is addressable by name, the
video is uploaded once and every later step references it by name. The client
drives a series of short calls — upload → poll for ready → docs → questions →
options (chunked, in parallel) — each comfortably under the timeout, while a
single progress stepper shows the real state of each step.

---

## Project structure

```
src/
  app/
    api/
      config/             # exposes whether a key is set + enabled models
      blob/upload/        # Vercel Blob client-upload token endpoint
      gemini/upload/      # blob URL -> Gemini Files API
      gemini/status/      # poll processing state
      generate/docs/      # documentation from the video
      generate/questions/ # 20 questions + correct answers
      generate/options/   # distractors + shuffled options
    page.tsx              # composes gate -> picker -> processing -> quiz
  components/             # UI (gate, model select, picker, stepper, quiz)
  lib/
    gemini.ts             # Google GenAI provider (upload/dedup/generate + fallback)
    prompts.ts            # generation prompts + response schemas
    use-pipeline.ts       # client orchestration of the whole flow
    types.ts, models.ts   # shared contract
```

---

## License

MIT
