import { useCallback, useContext, useEffect, useState } from "react";
import VrmViewer from "@/components/vrmViewer";
import { ViewerContext } from "@/features/vrmViewer/viewerContext";
import {
  Message,
  textsToScreenplay,
  DEFAULT_VOICE_ENGINE,
  Screenplay,
} from "@/features/messages/messages";
import { speakCharacter } from "@/features/messages/speakCharacter";
import { MessageInputContainer } from "@/components/messageInputContainer";
import { SYSTEM_PROMPT } from "@/features/constants/systemPromptConstants";
import { KoeiroParam, DEFAULT_PARAM } from "@/features/constants/koeiroParam";
import { Introduction } from "@/components/introduction";
import { Menu } from "@/components/menu";
import { GitHubLink } from "@/components/githubLink";
import { Meta } from "@/components/meta";
import { DEFAULT_CHAT_ENGINE, useChat } from "@/features/chat/chat";
import {
  DEFAULT_TRANSCRIPTION_ENGINE,
  useTranscription,
} from "@/features/transcription/transcription";

export default function Home() {
  const { viewer } = useContext(ViewerContext);

  const [loadingRequired, setLoadingRequired] = useState(true);
  const [isHandlingLoading, setIsHandlingLoading] = useState(false);
  const [transcriptionEngine] = useState(DEFAULT_TRANSCRIPTION_ENGINE);
  const [chatEngine] = useState(DEFAULT_CHAT_ENGINE);
  const [voiceEngine] = useState(DEFAULT_VOICE_ENGINE);
  const [systemPrompt, setSystemPrompt] = useState(SYSTEM_PROMPT);
  // Initialize from localStorage
  const savedParams = window.localStorage.getItem("chatVRMParams");
  const initialParams = savedParams ? JSON.parse(savedParams) : {};

  const [openAiKey, setOpenAiKey] = useState(initialParams.openAiKey ?? "");
  const [zhipuKey, setZhipuKey] = useState(initialParams.zhipuKey ?? "");
  const [koeiromapKey, setKoeiromapKey] = useState(initialParams.koeiromapKey ?? "");
  const [koeiroParam, setKoeiroParam] = useState<KoeiroParam>(DEFAULT_PARAM);
  const [chatProcessing, setChatProcessing] = useState(false);
  const [chatLog, setChatLog] = useState<Message[]>([]);
  const [assistantMessage, setAssistantMessage] = useState("");

  const { load: loadChatModel, getChatResponseStream } = useChat();
  const {
    load: loadTranscriptionModel,
    transcribe,
    stopTranscribing,
  } = useTranscription();

  // Main loading handler
  const handleLoading = useCallback(async () => {
    if (!loadingRequired || isHandlingLoading) {
      return;
    }

    setIsHandlingLoading(true);
    try {
      await Promise.all([
        loadTranscriptionModel(transcriptionEngine),
        loadChatModel(chatEngine, systemPrompt),
        speakCharacter.load(voiceEngine),
      ]);
      setLoadingRequired(false);
    } catch (error) {
      console.error("Error during loading:", error);
      // Keep loadingRequired true if there's an error
    } finally {
      setIsHandlingLoading(false);
    }
  }, [
    chatEngine,
    voiceEngine,
    loadChatModel,
    loadingRequired,
    isHandlingLoading,
    loadTranscriptionModel,
    systemPrompt,
    transcriptionEngine,
  ]);

  // Empty onLoad handler for Introduction component
  const handleOnLoad = useCallback(async () => {
    // Loading is now handled automatically by the useEffect
  }, []);

  // Initialize other params from localStorage
  useEffect(() => {
    if (window.localStorage.getItem("chatVRMParams")) {
      const params = JSON.parse(
        window.localStorage.getItem("chatVRMParams") as string
      );
      if (systemPrompt === SYSTEM_PROMPT && params.systemPrompt) {
        setSystemPrompt(params.systemPrompt);
      }
      if (koeiroParam === DEFAULT_PARAM && params.koeiroParam) {
        setKoeiroParam(params.koeiroParam);
      }
      if (chatLog.length === 0 && params.chatLog) {
        setChatLog(params.chatLog);
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "chatVRMParams",
      JSON.stringify({ systemPrompt, koeiroParam, chatLog, openAiKey, zhipuKey })
    );
  }, [systemPrompt, koeiroParam, chatLog, openAiKey, zhipuKey]);

  // Auto-handle loading when loadingRequired becomes true and component mounts
  useEffect(() => {
    if (loadingRequired && !isHandlingLoading) {
      handleLoading();
    }
  }, [loadingRequired, isHandlingLoading, handleLoading]);

  const handleChangeSystemPrompt = useCallback(
    async (newSystemPrompt: string) => {
      if (newSystemPrompt === systemPrompt) {
        return;
      }
      setSystemPrompt(newSystemPrompt);
      setLoadingRequired(true);
    },
    [systemPrompt]
  );

  const handleChangeOpenAiKey = useCallback((openAiKey: string) => {
    setOpenAiKey(openAiKey);
    setLoadingRequired(true);
  }, []);

  const handleChangeZhipuKey = useCallback((zhipuKey: string) => {
    setZhipuKey(zhipuKey);
    setLoadingRequired(true);
  }, []);

  const handleChangeChatLog = useCallback(
    (targetIndex: number, text: string) => {
      const newChatLog = chatLog.map((v: Message, i) => {
        return i === targetIndex ? { role: v.role, content: text } : v;
      });

      setChatLog(newChatLog);
    },
    [chatLog]
  );

  const handleResetChatLog = useCallback(async () => {
    setChatLog([]);
    setLoadingRequired(true);
  }, []);

  /**
   * 文ごとに音声を直列でリクエストしながら再生する
   */
  const handleSpeakAi = useCallback(
    async (
      screenplay: Screenplay,
      onStart?: () => void,
      onEnd?: () => void
    ) => {
      speakCharacter.speak(screenplay, viewer, koeiromapKey, onStart, onEnd);
    },
    [viewer, koeiromapKey]
  );

  const handleStopTranscribing = useCallback(() => {
    stopTranscribing();
    setChatProcessing(true);
  }, [stopTranscribing]);

  /**
   * アシスタントとの会話を行う
   */
  const handleSendChat = useCallback(
    async (text: string) => {
      setChatProcessing(true);

          // Check if API key is available for current engine
      if ((chatEngine === "OpenAI" && !openAiKey) ||
          (chatEngine === "Zhipu GLM" && !zhipuKey)) {
        // Check if at least one API key is available
        if (!openAiKey && !zhipuKey) {
          setAssistantMessage("APIキーが設定されていません。設定画面でOpenAIまたはZhipu GLMのAPIキーを入力してください。");
          setChatProcessing(false);
          return;
        }

        // Try to switch to an available engine
        let newEngine = chatEngine;
        if (chatEngine === "OpenAI" && !openAiKey && zhipuKey) {
          newEngine = "Zhipu GLM";
        } else if (chatEngine === "Zhipu GLM" && !zhipuKey && openAiKey) {
          newEngine = "OpenAI";
        }

        // Update to the new engine
        const availableEngine = newEngine;
        const messageLog: Message[] = [
          ...chatLog,
          { role: "user", content: text },
        ];

        // Try to use the available engine
        try {
          const stream = await getChatResponseStream(
            availableEngine,
            messageLog,
            openAiKey,
            zhipuKey
          ).catch((e) => {
            console.error("Stream error:", e);
            return null;
          });

          if (!stream) {
            setAssistantMessage("APIキーの設定に問題があります。設定画面を確認してください。");
            setChatProcessing(false);
            return;
          }
        } catch (error) {
          console.error("Switch error:", error);
          setAssistantMessage("エンジンの切り替えに失敗しました。");
          setChatProcessing(false);
          return;
        }
      } else {
        // Clear any previous error message when validation passes
        setAssistantMessage("");
      }

      if (text === "") {
        setChatProcessing(false);
        return;
      }

      // ユーザーの発言を追加して表示
      const messageLog: Message[] = [
        ...chatLog,
        { role: "user", content: text },
      ];
      setChatLog(messageLog);

      const stream = await getChatResponseStream(
        chatEngine,
        messageLog,
        openAiKey,
        zhipuKey
      ).catch((e) => {
        console.error(e);
        return null;
      });
      if (stream == null) {
        setChatProcessing(false);
        return;
      }

      const reader = stream.getReader();
      let receivedMessage = "";
      let aiTextLog = "";
      let tag = "";
      const sentences = new Array<string>();

      // Reset AI text log for new conversation
      aiTextLog = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          receivedMessage += value;
          console.log("Received chunk:", value); // Debug: log each chunk

          // Process all available content in receivedMessage
          while (receivedMessage && receivedMessage.trim()) {
            try {
              // 返答内容のタグ部分の検出
              const tagMatch = receivedMessage.match(/^\[(.*?)\]/);
              if (tagMatch && tagMatch[0]) {
                tag = tagMatch[0];
                receivedMessage = receivedMessage.slice(tag.length);
                continue;
              }

              // 简化的句子分割逻辑
              let sentence = "";
              let foundEnd = false;

              // 寻找第一个标点符号或长文本
              for (let i = 0; i < receivedMessage.length; i++) {
                const char = receivedMessage[i];
                sentence += char;

                // 检查是否遇到标点符号
                if ([ "。", "．", "！", "？", ".", "!", "?", "\n" ].includes(char)) {
                  foundEnd = true;
                  break;
                }

                // 检查是否遇到逗号或其他分隔符
                if ([ "，", "、", "," ].includes(char) && sentence.length > 5) {
                  foundEnd = true;
                  break;
                }

                // 如果文本足够长，强制分割
                if (sentence.length >= 20) {
                  foundEnd = true;
                  break;
                }
              }

              if (!foundEnd) {
                // 没有找到完整的句子，等待更多数据
                break;
              }

              sentences.push(sentence);
              aiTextLog += `${tag} ${sentence}\n`; // Add to accumulated text
              receivedMessage = receivedMessage
                .slice(sentence.length)
                .trimStart();

              // 発話不要/不可能な文字列だった場合はスキップ
              if (
                !sentence.replace(
                  /^[\s[({「［（【『〈《〔｛«‹〘〚〛〙›»〕》〉』】）］」})\]]+$/g,
                  ""
                )
              ) {
                continue;
              }

              const aiText = `${tag} ${sentence}`;
              console.log("Processing sentence:", aiText); // Debug
              const aiTalks = textsToScreenplay(
                voiceEngine,
                [aiText],
                koeiroParam
              );

              // 文ごとに音声を生成 & 再生、返答を表示
              const currentAssistantMessage = sentences.join(" ");
              console.log("Speaking sentence:", currentAssistantMessage); // Debug
              handleSpeakAi(aiTalks[0], () => {
                setAssistantMessage(currentAssistantMessage);
              });
            } catch (e) {
              console.error("Error processing message:", e);
              break;
            }
          }
        }
      } catch (e) {
        setChatProcessing(false);
        console.error("Stream processing error:", e);
      } finally {
        reader.releaseLock();
      }

      console.log("Final received message:", receivedMessage); // Debug: log final message
      console.log("AI text log:", aiTextLog); // Debug: log accumulated text
      console.log("Sentences array:", sentences); // Debug: log sentences

      // Clean up accumulated text
      const cleanAiText = aiTextLog.trim() || receivedMessage.trim();
      console.log("Clean AI text for logging:", cleanAiText);

      // アシスタントの返答をログに追加
      const messageLogAssistant: Message[] = [
        ...chatLog,
        { role: "user", content: text },
        { role: "assistant", content: cleanAiText },
      ];

      setChatLog(messageLogAssistant);
      setChatProcessing(false);
    },
    [
      openAiKey,
      chatLog,
      getChatResponseStream,
      chatEngine,
      voiceEngine,
      koeiroParam,
      handleSpeakAi,
    ]
  );

  return (
    <div className={"font-M_PLUS_2"}>
      <Meta />
      <Introduction
        chatEngine={chatEngine}
        openAiKey={openAiKey}
        zhipuKey={zhipuKey}
        voiceEngine={voiceEngine}
        koeiroMapKey={koeiromapKey}
        onChangeOpenAiKey={handleChangeOpenAiKey}
        onChangeZhipuKey={handleChangeZhipuKey}
        onChangeKoeiromapKey={setKoeiromapKey}
        onLoad={handleOnLoad}
      />
      <VrmViewer />
      <MessageInputContainer
        transcribe={transcribe}
        stopTranscribing={handleStopTranscribing}
        isChatProcessing={chatProcessing}
        onChatProcessStart={handleSendChat}
      />
      <Menu
        chatEngine={chatEngine}
        openAiKey={openAiKey}
        zhipuKey={zhipuKey}
        systemPrompt={systemPrompt}
        chatLog={chatLog}
        koeiroParam={koeiroParam}
        assistantMessage={assistantMessage}
        voiceEngine={voiceEngine}
        koeiromapKey={koeiromapKey}
        onChangeOpenAiKey={setOpenAiKey}
        onChangeZhipuKey={setZhipuKey}
        onChangeSystemPrompt={handleChangeSystemPrompt}
        onChangeChatLog={handleChangeChatLog}
        onChangeKoeiromapParam={setKoeiroParam}
        handleClickResetChatLog={handleResetChatLog}
        handleClickResetSystemPrompt={() =>
          handleChangeSystemPrompt(SYSTEM_PROMPT)
        }
        onChangeKoeiromapKey={setKoeiromapKey}
        onLoad={handleOnLoad}
      />
      <GitHubLink />
    </div>
  );
}
