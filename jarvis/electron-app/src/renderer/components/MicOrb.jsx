import React from "react";
import { Mic, Loader, Zap, Radio } from "lucide-react";

const STATUS_CONFIG = {
  idle: {
    color: "#00d4ff",
    glow: "0 0 20px rgba(0,212,255,0.2)",
    label: `CZEKA NA WAKE WORD`,
    sublabel: `powiedz "Hey Jarvis"`,
    icon: Radio,
    pulse: true,
    spin: false,
  },
  listening: {
    color: "#00ff88",
    glow: "0 0 40px rgba(0,255,136,0.4), 0 0 80px rgba(0,255,136,0.15)",
    label: "NASLUCHUJĘ",
    sublabel: "mów komendę...",
    icon: Mic,
    pulse: true,
    spin: false,
  },
  thinking: {
    color: "#ffaa00",
    glow: "0 0 40px rgba(255,170,0,0.4)",
    label: "PRZETWARZAM",
    sublabel: "Gemini AI...",
    icon: Loader,
    pulse: false,
    spin: true,
  },
  executing: {
    color: "#00d4ff",
    glow: "0 0 40px rgba(0,212,255,0.5), 0 0 100px rgba(0,212,255,0.15)",
    label: "WYKONUJĘ",
    sublabel: "proszę czekać...",
    icon: Zap,
    pulse: true,
    spin: false,
  },
};

export default function MicOrb({ status, onClick }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const Icon = cfg.icon;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
      <div style={{ position: "relative", width: 180, height: 180 }}>

        {/* Zewnetrzne obracajace pierscienie */}
        {status !== "idle" && (
          <div style={{
            position: "absolute", inset: -14, borderRadius: "50%",
            border: `1px solid ${cfg.color}40`,
            borderTopColor: cfg.color,
            animation: "rotate-ring 3s linear infinite",
          }} />
        )}
        {/* Drugi pierscien - zawsze dla idle (pokazuje ze nasluchuje) */}
        <div style={{
          position: "absolute", inset: -26, borderRadius: "50%",
          border: `1px solid ${cfg.color}20`,
          borderBottomColor: `${cfg.color}60`,
          animation: "counter-rotate 7s linear infinite",
        }} />

        {/* Pulse ring */}
        {cfg.pulse && (
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: `${cfg.color}10`,
            animation: "pulse-ring 2.5s ease-out infinite",
          }} />
        )}

        {/* Glowny orb */}
        <button
          onClick={onClick}
          title={status === "idle" ? "Kliknij aby recznie nasluchiwac" : "Kliknij aby zatrzymac"}
          style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: `radial-gradient(circle at 35% 35%, ${cfg.color}30, ${cfg.color}08 60%, transparent)`,
            border: `2px solid ${cfg.color}`,
            boxShadow: cfg.glow,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.3s ease",
            backdropFilter: "blur(8px)",
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.04)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
          onMouseUp={e => e.currentTarget.style.transform = "scale(1.04)"}
        >
          <Icon
            size={48}
            color={cfg.color}
            style={{
              filter: `drop-shadow(0 0 8px ${cfg.color})`,
              animation: cfg.spin ? "rotate-ring 1.5s linear infinite" : "none",
            }}
          />
        </button>

        {/* Punkty na orbicie */}
        {[0, 90, 180, 270].map(deg => (
          <div key={deg} style={{
            position: "absolute", width: 6, height: 6, borderRadius: "50%",
            background: cfg.color, boxShadow: `0 0 6px ${cfg.color}`,
            top: "50%", left: "50%",
            transform: `rotate(${deg}deg) translateY(-95px) translate(-50%, -50%)`,
            opacity: 0.7, transition: "opacity 0.3s ease",
          }} />
        ))}
      </div>

      {/* Etykiety */}
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{
          fontFamily: "var(--font-display)", fontSize: 11,
          letterSpacing: "0.2em", color: cfg.color,
          filter: `drop-shadow(0 0 6px ${cfg.color})`,
        }}>
          {cfg.label}
        </span>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10,
          color: "var(--text-muted)", letterSpacing: "0.05em",
        }}>
          {cfg.sublabel}
        </span>
      </div>
    </div>
  );
}
