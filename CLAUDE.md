# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LocalChatVRM is a web-based 3D character chat demo (showcased at Google I/O 2025). Users converse with VRM models in-browser via text input, AI-generated responses, speech synthesis, and real-time facial animation. Originally based on [pixiv/ChatVRM](https://github.com/pixiv/ChatVRM).

The current main page (`src/pages/test.tsx`) is a **Suzaku Simulation Test** — a 3-round scripted playback system using pre-cached assets (text, ARKit blendshapes, VRMA animations, audio) rather than live AI chat.

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Production build
npm run lint         # ESLint (eslint . --ext ts,tsx)
```

Node 22.14.0 required (engines field). No test runner configured.

## Architecture

### Data Flow (Live Chat Mode)

```
User text/voice → Chat engine (Zhipu GLM / OpenAI) → AI response with emotion tags
→ textsToScreenplay() parses [emotion]text into Screenplay objects
→ speakCharacter.speak() → TTS (Kokoro.js or Koeiromap) → audio buffer
→ Model.speak() → EmoteController plays expression + LipSync plays audio
→ Model.update() per-frame: lip sync volume → mouth blendshape, emote update, VRM update
```

### Data Flow (Test Playback Mode — current default)

```
Page load → preloadAll() fetches /test/{text,arkit,vrma,audio}/test{1,2,3}.*
User sends message → playRound(round, model, idleAction, callback)
→ Loads VRMA animation + ARKit expression tracks → plays as single clip
→ Plays cached WAV audio → on complete, restores idle animation
```

### Key Modules

- **`src/features/chat/`** — Pluggable chat engine. `chat.ts` is the abstraction layer switching between `zhipuGlmChat.ts` (default, `glm-4`) and `openAiChat.ts`. Engines return a `ReadableStream<string>` for streaming responses.

- **`src/features/vrmViewer/`** — `Viewer` (Three.js scene/renderer/camera/OrbitControls), `Model` (VRM loading, animation, lip sync, emote controller). `viewerContext.ts` provides React context. Idle animation loaded from `./idle_loop.vrma`.

- **`src/features/emoteController/`** — `EmoteController` → `ExpressionController` manages VRM blendshape expressions, auto-blinking, and gaze tracking. Emotions: neutral, happy, angry, sad, relaxed, surprised.

- **`src/features/messages/`** — `messages.ts` defines `Screenplay` type (expression + talk), `textsToScreenplay()` parses `[emotion]text` format. `speakCharacter.ts` is a singleton managing sequential audio fetch-and-play with pre-fetching for smooth playback.

- **`src/features/voices/`** — Two TTS engines: `kokoroTts.ts` (local, via Web Worker) and `koeiromapSynthesizeVoice.ts` (cloud API). Default: Kokoro TTS with voice `af_heart`.

- **`src/features/lipSync/`** — `LipSync` class decodes audio ArrayBuffer, analyzes volume per frame for mouth blendshapes.

- **`src/features/testPlayback/`** — Pre-cached 3-round playback system. `preloadAll()` fetches all assets upfront, `playRound()` composes VRMA + ARKit expression tracks into a single animation clip.

- **`src/features/transcription/`** — Voice input abstraction. Web Speech API (default) or Gemini Nano (disabled).

- **`src/lib/VRMAnimation/`** — Custom `.vrma` file loader (VRMC_vrm_animation spec).

- **`src/lib/VRMLookAtSmootherLoaderPlugin/`** — Smooth gaze-following plugin for VRM lookAt.

### System Prompt & Emotion Tags

The system prompt (`src/features/constants/systemPromptConstants.ts`) instructs the AI to respond as a close friend with emotion tags. Format: `[{neutral|happy|angry|sad|relaxed|surprised}]{dialogue}`. The `textsToScreenplay()` function splits on sentence endings (`。．！？\n`) and carries forward the last emotion tag if none specified.

### Chat Engine Configuration

- Default engine: `DEFAULT_CHAT_ENGINE = "Zhipu GLM"` in `src/features/chat/chat.ts`
- Default voice engine: `DEFAULT_VOICE_ENGINE = "Kokoro TTS"` in `src/features/messages/messages.ts`
- Default transcription engine in `src/features/transcription/transcription.ts`
- Settings UI in `src/components/settings.tsx` (currently disabled in demo mode)

### State Management

No external state library. React hooks + `useState`/`useContext`. `ViewerContext` provides the 3D viewer instance. Settings stored in `localStorage`.

## Important Configuration

- **Path alias**: `@` → `./src` (configured in both `vite.config.ts` and `tsconfig.json`)
- **Build chunking**: Three.js, OpenAI, and Kokoro are split into separate vendor chunks
- **TypeScript**: Strict mode, target ES2015, moduleResolution "bundler"
- **ESLint**: React + TypeScript + Prettier config (see `eslint.config.mjs`)
