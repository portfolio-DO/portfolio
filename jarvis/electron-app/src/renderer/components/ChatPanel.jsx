import React, { useEffect, useRef } from "react";
import { Bot, User, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function ChatPanel({ messages }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      background: "var(--bg-secondary)",
      height: "100%",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <MessageSquare size={13} color="var(--accent-cyan)" />
        <span style={{
          fontFamily: "var(--font-display)",
          fontSize: 10,
          letterSpacing: "0.15em",
          color: "var(--text-muted)",
        }}>
          CONVERSATION LOG
        </span>
        <span style={{
          marginLeft: "auto",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--text-muted)",
          background: "var(--bg-card)",
          padding: "2px 8px",
          borderRadius: 4,
        }}>
          {messages.length}
        </span>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}>
        {messages.length === 0 ? (
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            opacity: 0.3,
          }}>
            <Bot size={32} color="var(--text-muted)" />
            <p style={{
              fontFamily: "var(--font-display)",
              fontSize: 10,
              letterSpacing: "0.1em",
              color: "var(--text-muted)",
              textAlign: "center",
            }}>
              NO CONVERSATIONS YET
              <br />
              SAY "HEY JARVIS" TO START
            </p>
          </div>
        ) : (
          messages.map(msg => (
            <ChatMessage key={msg.id} message={msg} />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function ChatMessage({ message }) {
  const isUser = message.role === "user";
  const timeAgo = formatDistanceToNow(new Date(message.timestamp), { addSuffix: true });

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        animation: "fade-in-up 0.3s ease",
        flexDirection: isUser ? "row-reverse" : "row",
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: isUser ? "rgba(0,128,255,0.15)" : "rgba(0,212,255,0.1)",
        border: `1px solid ${isUser ? "#0080ff40" : "#00d4ff30"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        {isUser
          ? <User size={13} color="#0080ff" />
          : <Bot size={13} color="var(--accent-cyan)" />
        }
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{
          background: isUser ? "rgba(0,128,255,0.1)" : "rgba(0,212,255,0.06)",
          border: `1px solid ${isUser ? "#0080ff25" : "#00d4ff15"}`,
          borderRadius: isUser ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
          padding: "10px 13px",
        }}>
          <p style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            color: "var(--text-primary)",
            lineHeight: 1.55,
            wordBreak: "break-word",
          }}>
            {message.text}
          </p>
        </div>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--text-muted)",
          textAlign: isUser ? "right" : "left",
          paddingLeft: isUser ? 0 : 4,
          paddingRight: isUser ? 4 : 0,
        }}>
          {timeAgo}
        </span>
      </div>
    </div>
  );
}
