# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LocalChatVRM is a web-based application that enables users to converse with 3D characters (VRM models) directly in their browser. It was developed for technical demonstration purposes and showcased at Google I/O 2025. The application is currently archived but available for forking and further development.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (Vite hot reload)
npm run dev

# Build for production
npm run build

# Lint code with ESLint
npm run lint
```

**Node.js Requirement:** Node 22.14.0 is specified in package.json engines field

## Architecture Overview

### Core Architecture

The application follows a modular feature-based architecture with React hooks for state management:

```
src/
├── components/          # UI components
├── features/           # Core feature modules (business logic)
├── lib/                # Utility libraries and plugins
├── pages/              # Application pages
├── styles/             # Global styles
└── utils/              # Utility functions
```

### Key Feature Modules

1. **Chat Engine** (`src/features/chat/`)
   - Pluggable architecture supporting multiple AI providers
   - `chat.ts`: Main orchestrator with engine abstraction
   - `geminiNanoChat.ts`: Chrome's built-in AI integration
   - `openAiChat.ts`: OpenAI API fallback

2. **Speech Recognition** (`src/features/transcription/`)
   - Multiple engine support:
     - `transcriptionByGeminiNano.ts`: Chrome's multimodal APIs
     - `transcriptionBySpeechRecognition.ts`: Web Speech API fallback
   - Configure default engine via `DEFAULT_TRANSCRIPTION_ENGINE` constant

3. **3D Character Rendering** (`src/features/vrmViewer/`)
   - `viewer.ts`: Three.js/VRM model management
   - `viewerContext.ts`: React context for 3D scene state
   - Drag-and-drop VRM file replacement support

4. **Speech Synthesis** (`src/features/messages/`)
   - Kokoro.js integration for Japanese voice synthesis
   - Emotional expression parsing from AI responses
   - Sentence-by-sentence streaming playback

5. **Lip Sync & Emotions** (`src/features/lipSync/`, `src/features/emoteController/`)
   - Real-time lip synchronization with speech
   - Emotional expression control based on AI response tags
   - Auto-blinking and gaze tracking

### Application Flow

1. **Initialization**: Load VRM model, initialize AI models, setup speech synthesis
2. **User Input**: Speech transcription via Chrome APIs or Web Speech API
3. **AI Processing**: Generate response with emotional tags using selected engine
4. **Character Response**:
   - Parse emotional tags (e.g., `[smile]`, `[surprised]`)
   - Generate speech synthesis with appropriate voice parameters
   - Apply corresponding facial expressions and animations

### Technology Stack

- **Frontend**: React 19.1.0 with TypeScript strict mode
- **Build**: Vite 6.2.4 with React plugin
- **3D**: Three.js 0.176.0 with @pixiv/three-vrm 3.4.0
- **AI**: Chrome Built-in APIs (primary), OpenAI API (fallback)
- **Speech**: Kokoro.js (synthesis), Chrome Multimodal APIs/Web Speech API (transcription)
- **UI**: Tailwind CSS 3.3.1 with Charcoal UI components
- **State**: React hooks with localStorage persistence

## Important Configuration

### Path Aliases
Vite is configured with `@` alias pointing to `./src`:
```typescript
// Import from src directory
import { useChat } from "@/features/chat/chat";
```

### Environment Requirements
- **Chrome Browser**: Required for full functionality with Chrome Built-in AI APIs
- **WebGPU Support**: Recommended for optimal 3D performance
- **AI API Access**: Chrome AI configuration needed (see README.md)

### Key Dependencies
- `@pixiv/three-vrm`: VRM model rendering and animation
- `kokoro-js`: Japanese speech synthesis with emotional control
- `openai`: OpenAI API integration for fallback mode
- `three`: Core 3D rendering engine

## Development Notes

### VRM Model Support
- Models loaded via drag-and-drop or file input
- Supports standard VRM 1.0 format
- Character expressions and emotions mapped to VRM blendshapes

### Speech Processing
- **Input**: Chrome Multimodal APIs → Web Speech API (fallback)
- **Output**: Kokoro.js with Koeiro parameters for voice control
- **Emotion Tags**: Parsed from AI responses and applied to character expressions

### AI Engine Selection
- Default: Gemini Nano (Chrome's built-in AI)
- Fallback: OpenAI API (requires API key)
- Switchable via settings UI with immediate effect

### Browser Compatibility
- Chrome with Built-in AI APIs (full feature set)
- Other browsers with Web Speech API support (limited features)
- Production build available on GitHub Pages