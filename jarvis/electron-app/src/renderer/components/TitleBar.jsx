import React from "react";
import { Minus, Square, X, Bot } from "lucide-react";
import useJarvisStore from "../store/jarvisStore.js";

const NAV_ITEMS = [
  { id: "main", label: "MAIN" },
  { id: "history", label: "HISTORY" },
  { id: "settings", label: "SETTINGS" },
];

export default function TitleBar() {
  const { activePage, setActivePage, wsConnected, status } = useJarvisStore();

  const statusColor = {
    idle: "#4a5568",
    listening: "#00ff88",
    thinking: "#ffaa00",
    executing: "#00d4ff",
  }[status] || "#4a5568";

  return (
    <div
      style={{
        height: 48,
        background: "var(--bg-panel)",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        WebkitAppRegion: "drag",
        flexShrink: 0,
        position: "relative",
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 16px",
        WebkitAppRegion: "no-drag",
      }}>
        <div style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: `2px solid ${statusColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 12px ${statusColor}60`,
          transition: "all 0.3s ease",
        }}>
          <Bot size={14} color={statusColor} />
        </div>
        <span style={{
          fontFamily: "var(--font-display)",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: "0.15em",
          color: "var(--accent-cyan)",
        }}>
          J·A·R·V·I·S
        </span>
      </div>

      {/* Nav */}
      <div style={{
        display: "flex",
        gap: 2,
        flex: 1,
        justifyContent: "center",
        WebkitAppRegion: "no-drag",
      }}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            style={{
              background: activePage === item.id ? "rgba(0, 212, 255, 0.1)" : "transparent",
              border: activePage === item.id ? "1px solid var(--border-medium)" : "1px solid transparent",
              borderRadius: 4,
              color: activePage === item.id ? "var(--accent-cyan)" : "var(--text-muted)",
              fontFamily: "var(--font-display)",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.12em",
              padding: "4px 14px",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Connection status + Window controls */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 12px",
        WebkitAppRegion: "no-drag",
      }}>
        {/* Connection dot */}
        <div style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: wsConnected ? "#00ff88" : "#ff3355",
          boxShadow: wsConnected ? "0 0 6px #00ff88" : "0 0 6px #ff3355",
        }} />

        {/* Window controls */}
        {["minimize", "maximize", "close"].map((action) => (
          <button
            key={action}
            onClick={() => window.electron?.[action]?.()}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: "none",
              background: "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = action === "close" ? "rgba(255,51,85,0.2)" : "var(--bg-hover)";
              e.currentTarget.style.color = action === "close" ? "#ff3355" : "var(--text-primary)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            {action === "minimize" && <Minus size={12} />}
            {action === "maximize" && <Square size={11} />}
            {action === "close" && <X size={13} />}
          </button>
        ))}
      </div>
    </div>
  );
}
