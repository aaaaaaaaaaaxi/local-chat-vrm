import { useState, useRef, useEffect, useCallback, useContext } from "react";
import VrmViewer from "@/components/vrmViewer";
import { ViewerContext } from "@/features/vrmViewer/viewerContext";
import { playRound, preloadAll } from "@/features/testPlayback";
import { Meta } from "@/components/meta";

type Phase = "preloading" | "waiting" | "loading" | "playing" | "complete";
type ChatMsg = { role: "user" | "assistant"; content: string };

export default function TestPage() {
  const { viewer } = useContext(ViewerContext);
  const [round, setRound] = useState<1 | 2 | 3>(1);
  const [phase, setPhase] = useState<Phase>("preloading");
  const [chatLog, setChatLog] = useState<ChatMsg[]>([]);
  const [userMessage, setUserMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Preload all assets on mount
  useEffect(() => {
    preloadAll()
      .then(() => { console.log("All assets preloaded"); setPhase("waiting"); })
      .catch((e) => { console.error("Preload failed:", e); setPhase("waiting"); });
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(Math.max(textareaRef.current.scrollHeight, 60), 300) + "px";
    }
  }, [userMessage]);

  const handleSend = useCallback(async () => {
    if (!userMessage.trim() || phase !== "waiting") return;
    const text = userMessage.trim();

    // Add user message
    setChatLog(prev => [...prev, { role: "user", content: text }]);
    setUserMessage("");
    setPhase("loading");

    const model = viewer.model;
    if (!model?.vrm) {
      setPhase("waiting");
      return;
    }

    try {
      setPhase("playing");
      await playRound(round, model, viewer.idleAction ?? null, (responseText) => {
        setChatLog(prev => [...prev, { role: "assistant", content: responseText }]);
      });
    } catch (e) {
      console.error("Playback error:", e);
    }

    // Advance round
    if (round < 3) {
      setRound((round + 1) as 1 | 2 | 3);
      setPhase("waiting");
    } else {
      setPhase("complete");
    }
  }, [userMessage, phase, round, viewer]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const roundLabels = ["Round 1 of 3", "Round 2 of 3", "Round 3 of 3"];
  const disabled = phase !== "waiting";

  const statusText = phase === "preloading"
    ? "Loading assets..."
    : phase === "complete"
      ? "Test Complete"
      : roundLabels[round - 1];

  return (
    <div className="relative h-screen w-screen overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Meta />
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
          Suzaku Simulation Test
        </div>
        <div
          className="px-4 py-2 rounded-xl text-sm font-semibold shadow-sm"
          style={{
            background: phase === "preloading" ? "#f1f5f9" : phase === "playing" ? "#0ea5e9" : phase === "complete" ? "#22c55e" : "white",
            color: phase === "playing" || phase === "complete" ? "white" : "#334155",
          }}
        >
          {phase === "preloading" && (
            <span className="inline-flex items-center gap-2">
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              {statusText}
            </span>
          ) || statusText}
        </div>
      </header>

      {/* Main Grid Layout */}
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
          <div className="flex flex-col h-full">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 chat-scroll">
              {chatLog.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm" style={{ color: "#94a3b8" }}>
                    {phase === "preloading" ? "Loading assets, please wait..." : "Type a question to start Round 1"}
                  </p>
                </div>
              )}

              {chatLog.map((msg, i) => {
                const isUser = msg.role === "user";
                return (
                  <div key={i} className={`msg-in flex ${isUser ? "flex-row-reverse" : ""}`}>
                    <div style={{ maxWidth: "90%" }}>
                      <div style={{
                        fontWeight: 600, fontSize: "12px", marginBottom: "4px",
                        color: isUser ? "#94a3b8" : "#0ea5e9",
                        textAlign: isUser ? "right" : "left",
                      }}>
                        {isUser ? "你" : "Suzaku"}
                      </div>
                      <div className="break-words" style={{
                        padding: "12px 16px", borderRadius: "12px",
                        fontSize: "14px", lineHeight: 1.6,
                        color: isUser ? "#334155" : "#0369a1",
                        background: isUser ? "#f1f5f9" : "transparent",
                        borderTopRightRadius: isUser ? "2px" : undefined,
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              })}

              {phase === "loading" && (
                <div className="msg-in flex">
                  <div className="flex items-center gap-1.5 px-4 py-3" style={{ borderRadius: "12px", background: "rgba(224,242,254,0.5)" }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} className="typing-dot inline-block w-2 h-2 rounded-full" style={{ background: "#0ea5e9" }} />
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{ padding: "20px", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
              <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
                <textarea
                  ref={textareaRef}
                  placeholder={disabled ? (phase === "preloading" ? "Loading assets..." : phase === "complete" ? "All rounds complete" : "Playing...") : `Type your question for Round ${round}...`}
                  value={userMessage}
                  onChange={e => setUserMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={disabled}
                  style={{
                    background: "transparent", border: "none", resize: "none", outline: "none",
                    width: "100%", minHeight: "60px", fontSize: "14px",
                    color: "#0ea5e9", fontFamily: "inherit",
                    opacity: disabled ? 0.4 : 1,
                  }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                  <button
                    onClick={handleSend}
                    disabled={disabled || !userMessage.trim()}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer"
                    style={{
                      background: disabled || !userMessage.trim() ? "#e2e8f0" : "#0ea5e9",
                      color: disabled || !userMessage.trim() ? "#94a3b8" : "white",
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile responsive */}
      <style>{`
        @media (max-width: 1024px) {
          main { grid-template-columns: 1fr !important; }
          section:first-child { display: none; }
        }
      `}</style>
    </div>
  );
}
