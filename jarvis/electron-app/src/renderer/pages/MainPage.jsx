import React, { useState, useRef } from "react";
import { Send, AlertTriangle, Terminal, MessageSquare } from "lucide-react";
import useJarvisStore from "../store/jarvisStore.js";
import MicOrb from "../components/MicOrb.jsx";
import StatusIndicator from "../components/StatusIndicator.jsx";
import ChatPanel from "../components/ChatPanel.jsx";
import WaveformBars from "../components/WaveformBars.jsx";

export default function MainPage() {
  const {
    status, transcript, lastResponse, chatMessages,
    startListening, stopListening, sendTextCommand,
    emergencyStop, isEmergencyStopVisible, wsConnected,
  } = useJarvisStore();

  const [inputText, setInputText] = useState("");
  const inputRef = useRef(null);

  const isListening = status === "listening";
  const isIdle = status === "idle";

  const handleOrbClick = () => {
    // Recznie przelacz nasluchiwanie - tylko jesli connected
    if (!wsConnected) return;
    if (isListening) {
      stopListening();
    } else if (isIdle) {
      startListening();
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!inputText.trim() || !wsConnected) return;
    sendTextCommand(inputText.trim());
    setInputText("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={{
      height: "100%",
      display: "grid",
      gridTemplateColumns: "1fr 380px",
      background: "var(--bg-primary)",
      overflow: "hidden",
    }}>
      {/* LEWY panel - glowny */}
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "space-between",
        padding: "28px 40px",
        borderRight: "1px solid var(--border-subtle)",
        position: "relative", overflow: "hidden",
      }}>
        {/* Siatka w tle */}
        <div className="grid-bg" style={{ position: "absolute", inset: 0, opacity: 0.4, pointerEvents: "none" }} />

        {/* Status */}
        <div style={{ alignSelf: "flex-start", position: "relative", zIndex: 1 }}>
          <StatusIndicator status={status} />
        </div>

        {/* Orb + transkrypt */}
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", gap: 28,
          flex: 1, justifyContent: "center",
          position: "relative", zIndex: 1,
        }}>
          <MicOrb status={status} onClick={handleOrbClick} />

          {/* Transkrypt */}
          <div style={{ minHeight: 48, width: "100%", maxWidth: 480, textAlign: "center" }}>
            {transcript ? (
              <p style={{
                fontFamily: "var(--font-mono)", fontSize: 14,
                color: "var(--accent-cyan)", lineHeight: 1.6,
                animation: "fade-in 0.2s ease",
              }}>
                <span style={{ color: "var(--text-muted)" }}>{">> "}</span>
                {transcript}
                <span style={{
                  display: "inline-block", width: 2, height: "1em",
                  background: "var(--accent-cyan)", marginLeft: 3,
                  verticalAlign: "text-bottom",
                  animation: "blink 1s step-end infinite",
                }} />
              </p>
            ) : status === "listening" ? (
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.1em" }}>
                MOWISZ...
              </p>
            ) : status === "idle" && wsConnected ? (
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
                asystent nasluchuje w tle • powiedz "hey jarvis"
              </p>
            ) : null}
          </div>

          {/* Waveform tylko przy nasluchiwaniu */}
          {isListening && <WaveformBars />}

          {/* Ostatnia odpowiedz */}
          {lastResponse && status !== "listening" && (
            <div style={{
              background: "rgba(0,212,255,0.05)",
              border: "1px solid var(--border-medium)",
              borderRadius: 12, padding: "14px 18px",
              maxWidth: 500, width: "100%",
              animation: "fade-in-up 0.4s ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <MessageSquare size={11} color="var(--accent-cyan)" />
                <span style={{ fontFamily: "var(--font-display)", fontSize: 9, letterSpacing: "0.15em", color: "var(--text-muted)" }}>
                  ODPOWIEDZ
                </span>
              </div>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6 }}>
                {lastResponse}
              </p>
            </div>
          )}
        </div>

        {/* Emergency stop */}
        {isEmergencyStopVisible && (
          <button onClick={emergencyStop} style={{
            position: "absolute", top: 16, right: 16,
            background: "rgba(255,51,85,0.15)", border: "1px solid var(--accent-red)",
            borderRadius: 8, color: "var(--accent-red)",
            fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.1em",
            padding: "8px 14px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
            animation: "fade-in 0.3s ease",
          }}>
            <AlertTriangle size={12} /> STOP
          </button>
        )}

        {/* Input tekstowy */}
        <div style={{
          width: "100%", maxWidth: 560,
          display: "flex", gap: 8,
          position: "relative", zIndex: 1,
        }}>
          <div style={{
            flex: 1, background: "var(--bg-card)",
            border: "1px solid var(--border-medium)", borderRadius: 10,
            display: "flex", alignItems: "center", padding: "0 14px", gap: 10,
          }}>
            <Terminal size={13} color="var(--text-muted)" />
            <input
              ref={inputRef}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={wsConnected ? "Wpisz komende..." : "Laczenie z backendem..."}
              disabled={!wsConnected}
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-primary)",
                padding: "12px 0",
              }}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!inputText.trim() || !wsConnected}
            style={{
              background: (inputText.trim() && wsConnected) ? "var(--accent-cyan)" : "var(--bg-card)",
              border: "none", borderRadius: 10, width: 44, height: 44,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: (inputText.trim() && wsConnected) ? "pointer" : "default",
              transition: "all 0.2s ease",
              color: (inputText.trim() && wsConnected) ? "#000" : "var(--text-muted)",
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* PRAWY panel - chat */}
      <ChatPanel messages={chatMessages} />
    </div>
  );
}
