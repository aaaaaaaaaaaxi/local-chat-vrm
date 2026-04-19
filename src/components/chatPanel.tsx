import { useState, useRef, useEffect, useCallback } from "react";
import { Message } from "@/features/messages/messages";

type Props = {
  chatLog: Message[];
  assistantMessage: string;
  isChatProcessing: boolean;
  transcribe: () => Promise<string>;
  stopTranscribing: () => void;
  onChatProcessStart: (text: string) => void;
  onClearChat: () => void;
};

export const ChatPanel = ({
  chatLog, assistantMessage,
  isChatProcessing, transcribe, stopTranscribing, onChatProcessStart,
  onClearChat,
}: Props) => {
  const [userMessage, setUserMessage] = useState("");
  const [isMicRecording, setIsMicRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog, assistantMessage]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(Math.max(textareaRef.current.scrollHeight, 60), 300) + "px";
    }
  }, [userMessage]);

  const handleSend = useCallback(() => {
    if (!userMessage.trim() || isChatProcessing) return;
    onChatProcessStart(userMessage);
  }, [userMessage, isChatProcessing, onChatProcessStart]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const handleMicDown = useCallback(async () => {
    setIsMicRecording(true);
    const t = await transcribe();
    setUserMessage(t);
    onChatProcessStart(t);
  }, [transcribe, onChatProcessStart]);

  const handleMicUp = useCallback(() => {
    if (isMicRecording) { stopTranscribing(); setIsMicRecording(false); }
  }, [isMicRecording, stopTranscribing]);

  useEffect(() => {
    if (!isChatProcessing && !isMicRecording) setUserMessage("");
  }, [isChatProcessing, isMicRecording]);

  const isEmpty = chatLog.length === 0 && !assistantMessage;

  return (
    <div className="flex flex-col h-full">
      {/* Scan loading bar */}
      {isChatProcessing && (
        <div style={{ position: "relative", height: "2px", width: "100%", overflow: "hidden", background: "rgba(14, 165, 233, 0.15)", borderRadius: "24px 24px 0 0" }}>
          <div className="scan-bar" style={{ height: "100%", width: "33%", background: "#0ea5e9", transformOrigin: "left" }} />
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 chat-scroll">
        {isEmpty && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: "#94a3b8" }}>
              Say something to start the conversation
            </p>
          </div>
        )}

        {chatLog.map((msg, i) => {
          const isUser = msg.role === "user";
          const content = msg.content.replace(/\[.*?\]/g, "").trim();
          if (!content) return null;
          return (
            <div
              key={i}
              className={`msg-in flex ${isUser ? "flex-row-reverse" : ""}`}
            >
              <div style={{ maxWidth: "90%" }}>
                <div className="sender-name" style={{
                  fontWeight: 600,
                  fontSize: "12px",
                  marginBottom: "4px",
                  color: isUser ? "#94a3b8" : "#0ea5e9",
                  textAlign: isUser ? "right" : "left",
                }}>
                  {isUser ? "你" : "Suzaku"}
                </div>
                <div
                  className="break-words"
                  style={{
                    padding: "12px 16px",
                    borderRadius: "12px",
                    fontSize: "14px",
                    lineHeight: 1.6,
                    color: isUser ? "#334155" : "#0369a1",
                    background: isUser ? "#f1f5f9" : "transparent",
                    borderTopRightRadius: isUser ? "2px" : undefined,
                    boxShadow: isUser ? "none" : "none",
                  }}
                >
                  {content}
                </div>
              </div>
            </div>
          );
        })}

        {/* Streaming assistant message */}
        {assistantMessage && (
          <div className="msg-in flex">
            <div style={{ maxWidth: "90%" }}>
              <div className="sender-name" style={{
                fontWeight: 600,
                fontSize: "12px",
                marginBottom: "4px",
                color: "#0ea5e9",
              }}>
                Suzaku
              </div>
              <div
                className="break-words"
                style={{
                  padding: "12px 16px",
                  borderRadius: "12px",
                  fontSize: "14px",
                  lineHeight: 1.6,
                  color: "#0369a1",
                }}
              >
                {assistantMessage.replace(/\[.*?\]/g, "").trim()}
              </div>
            </div>
          </div>
        )}

        {/* Typing dots */}
        {isChatProcessing && !assistantMessage && (
          <div className="msg-in flex">
            <div
              className="flex items-center gap-1.5 px-4 py-3"
              style={{
                borderRadius: "12px",
                background: "rgba(224, 242, 254, 0.5)",
              }}
            >
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="typing-dot inline-block w-2 h-2 rounded-full"
                  style={{ background: "#0ea5e9" }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div
        style={{
          padding: "20px",
          borderTop: "1px solid rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
          <textarea
            ref={textareaRef}
            placeholder="说点什么..."
            value={userMessage}
            onChange={e => setUserMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isChatProcessing}
            style={{
              background: "transparent",
              border: "none",
              resize: "none",
              outline: "none",
              width: "100%",
              minHeight: "60px",
              fontSize: "14px",
              color: "#0ea5e9",
              fontFamily: "inherit",
            }}
          />
          <div style={{
            display: "flex",
            justifyContent: "flex-start",
            gap: "12px",
            marginTop: "8px",
            color: "#94a3b8",
          }}>
            {/* Mic button */}
            <button
              onPointerDown={handleMicDown}
              onPointerUp={handleMicUp}
              disabled={isChatProcessing}
              className={`w-10 h-10 flex items-center justify-center cursor-pointer outline-none transition-all duration-200 active:scale-95 ${isMicRecording ? "mic-pulse" : ""}`}
              style={{
                background: isMicRecording ? "#0ea5e9" : "transparent",
                color: isMicRecording ? "white" : "#94a3b8",
                borderRadius: "10px",
              }}
              title="Microphone"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
