import React from "react";
import { AlertTriangle, Check, X, Wifi, WifiOff } from "lucide-react";
import useJarvisStore from "../store/jarvisStore.js";

// ============================================================
// Confirmation Modal
// ============================================================
export function ConfirmationModal() {
  const { pendingConfirmation, approveConfirmation, denyConfirmation } = useJarvisStore();
  if (!pendingConfirmation) return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(5,5,13,0.85)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      backdropFilter: "blur(4px)",
      animation: "fade-in 0.2s ease",
    }}>
      <div style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--accent-amber)",
        borderRadius: 16,
        padding: 28,
        maxWidth: 400,
        width: "90%",
        boxShadow: "0 0 40px rgba(255,170,0,0.15)",
        animation: "fade-in-up 0.3s ease",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "rgba(255,170,0,0.1)",
            border: "1px solid rgba(255,170,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <AlertTriangle size={18} color="var(--accent-amber)" />
          </div>
          <div>
            <p style={{
              fontFamily: "var(--font-display)",
              fontSize: 11,
              letterSpacing: "0.12em",
              color: "var(--accent-amber)",
              marginBottom: 2,
            }}>
              CONFIRMATION REQUIRED
            </p>
            <p style={{
              fontFamily: "var(--font-body)",
              fontSize: 12,
              color: "var(--text-muted)",
            }}>
              Action requires your approval
            </p>
          </div>
        </div>

        {/* Description */}
        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 10,
          padding: "14px 16px",
          marginBottom: 24,
        }}>
          <p style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            color: "var(--text-primary)",
            lineHeight: 1.6,
          }}>
            {pendingConfirmation.description}
          </p>
          {pendingConfirmation.plan_summary && (
            <p style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-muted)",
              marginTop: 8,
              lineHeight: 1.5,
            }}>
              {pendingConfirmation.plan_summary}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={denyConfirmation}
            style={{
              flex: 1,
              padding: "11px 0",
              background: "rgba(255,51,85,0.1)",
              border: "1px solid rgba(255,51,85,0.4)",
              borderRadius: 8,
              color: "var(--accent-red)",
              fontFamily: "var(--font-display)",
              fontSize: 10,
              letterSpacing: "0.1em",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              transition: "all 0.2s ease",
            }}
          >
            <X size={13} /> DENY
          </button>
          <button
            onClick={approveConfirmation}
            style={{
              flex: 1,
              padding: "11px 0",
              background: "rgba(0,255,136,0.1)",
              border: "1px solid rgba(0,255,136,0.4)",
              borderRadius: 8,
              color: "var(--accent-green)",
              fontFamily: "var(--font-display)",
              fontSize: 10,
              letterSpacing: "0.1em",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              transition: "all 0.2s ease",
            }}
          >
            <Check size={13} /> APPROVE
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationModal;