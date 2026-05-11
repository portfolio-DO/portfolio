import React from "react";
import { WifiOff } from "lucide-react";

export default function ConnectionOverlay() {
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(5,5,13,0.92)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 999,
      backdropFilter: "blur(6px)",
      gap: 20,
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: "50%",
        background: "rgba(255,51,85,0.1)",
        border: "2px solid rgba(255,51,85,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <WifiOff size={28} color="var(--accent-red)" />
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{
          fontFamily: "var(--font-display)",
          fontSize: 13,
          letterSpacing: "0.15em",
          color: "var(--accent-red)",
          marginBottom: 8,
        }}>
          BACKEND OFFLINE
        </p>
        <p style={{
          fontFamily: "var(--font-body)",
          fontSize: 13,
          color: "var(--text-muted)",
          lineHeight: 1.6,
          maxWidth: 300,
          textAlign: "center",
        }}>
          Waiting for Python backend to start...
          <br />
          Check that Python is installed and dependencies are set up.
        </p>
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--accent-red)",
            animation: `blink 1s ${i * 0.3}s ease infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}
