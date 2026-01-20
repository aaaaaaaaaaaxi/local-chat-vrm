import { useCallback } from "react";
import { Message } from "../messages/messages";
import { useOpenAiChat } from "./openAiChat";
import { useZhipuGlmChat } from "./zhipuGlmChat";

export const CHAT_ENGINES = ["Zhipu GLM", "OpenAI"] as const;

export type ChatEngine = (typeof CHAT_ENGINES)[number];

export const DEFAULT_CHAT_ENGINE: ChatEngine = "Zhipu GLM";

export const useChat = () => {
  const {
    load: zhipuGlmLoad,
    getChatResponseStream: zhipuGlmGetChatResponseStream,
  } = useZhipuGlmChat();
  const {
    load: openAiLoad,
    getChatResponseStream: openAiGetChatResponseStream,
  } = useOpenAiChat();

  const load = useCallback(
    async (chatEngine: ChatEngine, systemPrompt: string) => {
      switch (chatEngine) {
        case "Zhipu GLM":
          return await zhipuGlmLoad(systemPrompt);
        case "OpenAI":
          return await openAiLoad(systemPrompt);
        default:
          throw Error("Selected chat engine is not supported");
      }
    },
    [zhipuGlmLoad, openAiLoad]
  );

  const getChatResponseStream = useCallback(
    async (
      chatEngine: ChatEngine,
      messageLog: Message[],
      openAiApiKey: string,
      zhipuApiKey: string
    ) => {
      switch (chatEngine) {
        case "Zhipu GLM":
          return await zhipuGlmGetChatResponseStream(messageLog, zhipuApiKey);
        case "OpenAI":
          return await openAiGetChatResponseStream(messageLog, openAiApiKey);
        default:
          throw Error("Selected chat engine is not supported");
      }
    },
    [zhipuGlmGetChatResponseStream, openAiGetChatResponseStream]
  );

  return { load, getChatResponseStream };
};
