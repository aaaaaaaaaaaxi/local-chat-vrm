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
import { SYSTEM_PROMPT } from "@/features/constants/systemPromptConstants";
import { KoeiroParam, DEFAULT_PARAM } from "@/features/constants/koeiroParam";
import { saveChatLog, loadChatLog } from "@/utils/chatStorage";
import { ChatPanel } from "@/components/chatPanel";
import { Settings } from "@/components/settings";
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
  const [zhipuKey, setZhipuKey] = useState(
    initialParams.zhipuKey ?? import.meta.env.VITE_ZHIPU_API_KEY ?? ""
  );
  const [koeiromapKey, setKoeiromapKey] = useState(initialParams.koeiromapKey ?? "");
  const [koeiroParam, setKoeiroParam] = useState<KoeiroParam>(DEFAULT_PARAM);
  const [chatProcessing, setChatProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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

  const handleOnLoad = useCallback(async () => {}, []);

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
    }
    loadChatLog().then((saved) => {
      if (saved.length > 0) {
        setChatLog(saved);
      }
    });
  }, []);

  // Persist settings to localStorage (without chatLog)
  useEffect(() => {
    window.localStorage.setItem(
      "chatVRMParams",
      JSON.stringify({ systemPrompt, koeiroParam, openAiKey, zhipuKey })
    );
  }, [systemPrompt, koeiroParam, openAiKey, zhipuKey]);

  // Persist chatLog to IndexedDB with debounce
  useEffect(() => {
    const timeout = setTimeout(() => {
      saveChatLog(chatLog);
    }, 500);
    return () => clearTimeout(timeout);
  }, [chatLog]);

  // Auto-handle loading when loadingRequired becomes true and component mounts
  useEffect(() => {
    if (loadingRequired && !isHandlingLoading) {
      handleLoading();
    }
  }, [loadingRequired, isHandlingLoading, handleLoading]);

  // Cleanup audio resources on unmount
  useEffect(() => {
    return () => {
      speakCharacter.destroy();
    };
  }, []);

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
          console.log("Received chunk:", value);

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

              for (let i = 0; i < receivedMessage.length; i++) {
                const char = receivedMessage[i];
                sentence += char;

                if ([ "。", "．", "！", "？", ".", "!", "?", "\n" ].includes(char)) {
                  foundEnd = true;
                  break;
                }

                if ([ "，", "、", "," ].includes(char) && sentence.length > 5) {
                  foundEnd = true;
                  break;
                }

                if (sentence.length >= 20) {
                  foundEnd = true;
                  break;
                }
              }

              if (!foundEnd) {
                break;
              }

              sentences.push(sentence);
              aiTextLog += `${tag} ${sentence}\n`;
              receivedMessage = receivedMessage
                .slice(sentence.length)
                .trimStart();

              if (
                !sentence.replace(
                  /^[\s[({「［（【『〈《〔｛«‹〘〚〛〙›»〕》〉』】）］」})\]]+$/g,
                  ""
                )
              ) {
                continue;
              }

              const aiText = `${tag} ${sentence}`;
              console.log("Processing sentence:", aiText);
              const aiTalks = textsToScreenplay(
                voiceEngine,
                [aiText],
                koeiroParam
              );

              const currentAssistantMessage = sentences.join(" ");
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

      console.log("Final received message:", receivedMessage);
      console.log("AI text log:", aiTextLog);
      console.log("Sentences array:", sentences);

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
    <div className="relative h-screen w-screen overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Meta />
      {/* Background decorations */}
      <div className="bg-pattern" />
      <div className="wave-header" />

      {/* Top Navigation */}
      <header className="absolute top-5 left-5 right-5 flex justify-between items-center z-[100]">
        <div className="flex items-center gap-2 font-bold text-lg" style={{ color: "#334155" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Suzaku
        </div>
        <div className="flex gap-3">
          {/* Upload VRM */}
          <button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".vrm";
              input.onchange = (e) => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (f && f.name.split(".").pop() === "vrm") {
                  const url = URL.createObjectURL(new Blob([f], { type: "application/octet-stream" }));
                  viewer.loadVrm(url);
                }
              };
              input.click();
            }}
            className="action-btn px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium shadow-sm cursor-pointer"
            style={{ color: "#475569" }}
            title="Upload VRM"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload VRM
          </button>
          {/* Clear Chat */}
          <button
            onClick={handleResetChatLog}
            className="action-btn px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium shadow-sm cursor-pointer"
            style={{ color: "#475569" }}
            title="Clear chat"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" />
            </svg>
            Clear
          </button>
          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            className="action-btn px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium shadow-sm cursor-pointer"
            style={{ color: "#475569" }}
            title="Settings"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Settings
          </button>
        </div>
      </header>

      {/* Main Grid Layout: VRM left, Chat right */}
      <main className="grid h-screen w-screen p-5 gap-5 box-border relative z-20" style={{ gridTemplateColumns: "1fr 450px" }}>
        {/* Left: VRM Character */}
        <section className="flex items-center justify-center relative overflow-hidden">
          <VrmViewer />
        </section>

        {/* Right: Chat Panel */}
        <section className="flex flex-col overflow-hidden" style={{
          background: "rgba(255, 255, 255, 0.6)",
          backdropFilter: "blur(10px)",
          borderRadius: "24px",
          border: "1px solid rgba(255, 255, 255, 0.8)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.05)",
        }}>
          <ChatPanel
            chatLog={chatLog}
            assistantMessage={assistantMessage}
            isChatProcessing={chatProcessing}
            transcribe={transcribe}
            stopTranscribing={stopTranscribing}
            onChatProcessStart={handleSendChat}
            onClearChat={handleResetChatLog}
          />
        </section>
      </main>

      {/* Settings Dialog */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center fade-in"
          style={{ background: "rgba(15, 23, 42, 0.18)", backdropFilter: "blur(6px)" }}
        >
          <div
            className="rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto m-4 chat-scroll fade-scale"
            style={{
              background: "rgba(255, 255, 255, 0.92)",
              backdropFilter: "blur(20px)",
              border: "1.5px solid rgba(148, 163, 184, 0.2)",
              boxShadow: "0 16px 48px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              className="sticky top-0 rounded-t-2xl px-6 py-4 flex items-center justify-between z-10"
              style={{ background: "rgba(255,255,255,0.95)", borderBottom: "1px solid rgba(148, 163, 184, 0.15)" }}
            >
              <h2 className="text-sm font-semibold tracking-wide" style={{ color: "#334155" }}>
                Settings
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: "#94a3b8" }}
                onMouseEnter={e => e.currentTarget.style.background = "#f1f5f9"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4">
              <Settings
                chatEngine={chatEngine}
                openAiKey={openAiKey}
                zhipuKey={zhipuKey}
                chatLog={chatLog}
                systemPrompt={systemPrompt}
                voiceEngine={voiceEngine}
                koeiroParam={koeiroParam}
                koeiromapKey={koeiromapKey}
                onClickClose={() => setShowSettings(false)}
                onChangeOpenAiKey={(e) => setOpenAiKey(e.target.value)}
                onChangeZhipuKey={(e) => setZhipuKey(e.target.value)}
                onChangeSystemPrompt={(e) => handleChangeSystemPrompt(e.target.value)}
                onChangeChatLog={handleChangeChatLog}
                onChangeKoeiroParam={(x, y) => setKoeiroParam({ speakerX: x, speakerY: y })}
                onClickOpenVrmFile={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".vrm";
                  input.onchange = (e) => {
                    const f = (e.target as HTMLInputElement).files?.[0];
                    if (f && f.name.split(".").pop() === "vrm") {
                      const url = URL.createObjectURL(new Blob([f], { type: "application/octet-stream" }));
                      viewer.loadVrm(url);
                    }
                  };
                  input.click();
                }}
                onClickResetChatLog={handleResetChatLog}
                onClickResetSystemPrompt={() => handleChangeSystemPrompt(SYSTEM_PROMPT)}
                onChangeKoeiromapKey={(e) => setKoeiromapKey(e.target.value)}
                onLoad={handleOnLoad}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile: hide VRM on small screens */}
      <style>{`
        @media (max-width: 1024px) {
          main { grid-template-columns: 1fr !important; }
          section:first-child { display: none; }
          .bottom-action { display: none; }
        }
      `}</style>
    </div>
  );
}
