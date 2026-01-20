import { useCallback, useState } from "react";
import { useTranscriptionBySpeechRecognition } from "./transcriptionBySpeechRecognition";

export const TRANSCRIPTION_ENGINES = [
  "SpeechSynthesis",
] as const;

export type TranscriptionEngine = (typeof TRANSCRIPTION_ENGINES)[number];

export const DEFAULT_TRANSCRIPTION_ENGINE: TranscriptionEngine = "SpeechSynthesis";

export const useTranscription = () => {
  const [transcriptionEngine] = useState<TranscriptionEngine>(DEFAULT_TRANSCRIPTION_ENGINE);

  const {
    transcribe: transcribeBySpeechRecognition,
    stopTranscribing: stopTranscribingBySpeechRecognition,
  } = useTranscriptionBySpeechRecognition();

  const load = useCallback(
    async (transcriptionEngine: TranscriptionEngine) => {
      // No loading required for SpeechSynthesis
      // Engine is always SpeechSynthesis now
    },
    []
  );

  const transcribe = useCallback(async () => {
    return await transcribeBySpeechRecognition();
  }, [
    transcribeBySpeechRecognition,
  ]);

  const stopTranscribing = useCallback(() => {
    return stopTranscribingBySpeechRecognition();
  }, [
    stopTranscribingBySpeechRecognition,
  ]);

  return { load, transcribe, stopTranscribing };
};
