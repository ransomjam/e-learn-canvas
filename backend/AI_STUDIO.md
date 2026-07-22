# AI Course Studio — Architecture

The AI layer that powers Cradema's "Create Lesson" flow. Instructors start
from **any** source (idea, pasted text, PDF, Word, PowerPoint, voice
recording, lecture video, or an existing lesson) and get a complete lesson
pack: article, quiz, flashcards, slides, assignment and a whiteboard video.

## Setup

```
# backend/.env
GEMINI_API_KEY=...        # https://aistudio.google.com/apikey  (recommended)
# DEEPSEEK_API_KEY=...    # optional text-only fallback provider
```

Run the migration once: `node src/database/migrate-ai-studio.js`
(it is also registered in `migrate-all.js` for deploys).

Without `GEMINI_API_KEY` the studio falls back to DeepSeek (text sources
only — no PDF/audio/video understanding).

## Pipeline

```
any source ──► extraction.service ──► Structured Content (JSON, source of truth)
                                          │
                 ┌────────────┬───────────┼───────────┬──────────────┐
                 ▼            ▼           ▼           ▼              ▼
              lesson        quiz     flashcards    slides       storyboard
              article                                               │
                                                       whiteboard.service (deterministic)
                                                                    ▼
                                                             scene graph ──► WhiteboardPlayer (frontend)
```

- **Models only reason** (understand, structure, describe scenes). The
  whiteboard video is produced deterministically from the storyboard:
  `whiteboard.service.js` compiles positioned/timed scene graphs, then
  `whiteboard-renderer.service.js` rasterizes them (canvas → ffmpeg) into a
  real MP4 with Gemini-TTS narration, uploaded to the same video storage as
  instructor uploads (Bunny Stream → R2 → local uploads). The MP4 becomes
  the lesson's `video_url`, so it streams exactly like any other course
  video. Same input, same output, no AI-rendered pixels.
- Layers (never skip one):
  - `config/ai.js` — every AI setting/knob.
  - `services/ai/providers/` — vendor adapters (Gemini, DeepSeek). Common
    contract: `generateText`, `generateJSON`, `prepareMediaFromUrl/Buffer`.
    Add a vendor here + one line in `providers/index.js`; nothing else changes.
  - `services/ai/prompts.js` — every prompt, in one place.
  - `services/ai/courseAI.service.js` — the only facade the app calls.
  - `services/jobs/` — DB-backed background queue (`ai_jobs` table) with
    progress labels, retries, restart recovery and a content-hash cache.
  - `controllers/ai-studio.controller.js` + `routes/ai-studio.routes.js` —
    HTTP surface under `/api/v1/ai` (instructor/admin only, rate limited).

## Key endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/ai/lessons/generate` | Start the full pipeline (async job) |
| GET | `/api/v1/ai/jobs/:id` | Poll progress / fetch result |
| POST | `/api/v1/ai/jobs/:id/apply` | Persist the pack into a course section |
| POST | `/api/v1/ai/assist` | One-click rewrites (improve/shorten/…) |
| POST | `/api/v1/ai/storyboards` | Whiteboard video for an existing lesson |
| POST | `/api/v1/ai/storyboards/:id/scenes/:i/regenerate` | Regenerate ONE scene |

## Data model

`ai_jobs` (queue + progress), `ai_artifacts` (every intermediate output),
`storyboards` + `storyboard_scenes` (scene description + compiled graph per
row → single-scene regeneration), `flashcard_decks`/`flashcards`,
`slide_decks`, `ai_generation_history` (audit + extraction cache).

## Frontend

- `src/pages/CreateLesson.tsx` — the wizard ("What would you like to start
  with?" → input → progress → review/save). The old manual editor lives on
  at `/instructor/courses/:courseId/lessons/manual`.
- `src/components/ai-studio/WhiteboardPlayer.tsx` — plays scene graphs
  (typewriter text + stroke-drawn SVG paths on the compiler's timeline).
- `src/components/ai-studio/AIAssistantPanel.tsx` — rewrite actions +
  translate, reusable next to any content editor.
- `src/services/aiStudio.service.ts`, `src/types/aiStudio.ts` — API client
  and shared types.
