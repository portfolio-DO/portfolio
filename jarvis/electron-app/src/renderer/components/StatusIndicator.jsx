// ============================================================
// StatusIndicator.jsx
// ============================================================
import React from "react";
import { Activity, Mic, Brain, Zap, Power } from "lucide-react";

const STATUS_LABELS = {
  idle: { label: "STANDBY", icon: Power, color: "#4a5568" },
  listening: { label: "LISTENING", icon: Mic, color: "#00ff88" },
  thinking: { label: "PROCESSING", icon: Brain, color: "#ffaa00" },
  executing: { label: "EXECUTING", icon: Zap, color: "#00d4ff" },
};

export function StatusIndicator({ status }) {
  const cfg = STATUS_LABELS[status] || STATUS_LABELS.idle;
  const Icon = cfg.icon;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 14px",
      background: `${cfg.color}10`,
      border: `1px solid ${cfg.color}30`,
      borderRadius: 100,
      alignSelf: "flex-start",
    }}>
      <div style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: cfg.color,
        boxShadow: `0 0 6px ${cfg.color}`,
        animation: status !== "idle" ? "blink 1.5s ease infinite" : "none",
      }} />
      <Icon size={11} color={cfg.color} />
      <span style={{
        fontFamily: "var(--font-display)",
        fontSize: 9,
        letterSpacing: "0.15em",
        color: cfg.color,
      }}>
        {cfg.label}
      </span>
    </div>
  );
}

export default StatusIndicator;
