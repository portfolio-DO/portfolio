import React from "react";

export default function WaveformBars() {
  const bars = Array.from({ length: 20 });

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 3,
      height: 40,
    }}>
      {bars.map((_, i) => (
        <div
          key={i}
          style={{
            width: 3,
            borderRadius: 2,
            background: `linear-gradient(to top, var(--accent-green), var(--accent-cyan))`,
            animation: `wave ${0.6 + (i % 5) * 0.15}s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.05}s`,
            minHeight: 4,
            maxHeight: 36,
            height: `${20 + Math.sin(i * 0.8) * 15}px`,
            opacity: 0.8,
          }}
        />
      ))}
    </div>
  );
}
