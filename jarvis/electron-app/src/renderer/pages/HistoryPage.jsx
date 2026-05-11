import React, { useState } from "react";
import { Clock, CheckCircle, XCircle, Loader, Search, Trash2 } from "lucide-react";
import useJarvisStore from "../store/jarvisStore.js";
import { formatDistanceToNow } from "date-fns";

export default function HistoryPage() {
  const { commandHistory } = useJarvisStore();
  const [search, setSearch] = useState("");

  const filtered = commandHistory.filter(h =>
    h.command?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      padding: "24px 32px",
      gap: 20,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Clock size={16} color="var(--accent-cyan)" />
          <span style={{
            fontFamily: "var(--font-display)",
            fontSize: 12,
            letterSpacing: "0.15em",
            color: "var(--text-primary)",
          }}>
            COMMAND HISTORY
          </span>
          <span style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-muted)",
            background: "var(--bg-card)",
            padding: "2px 8px",
            borderRadius: 4,
            border: "1px solid var(--border-subtle)",
          }}>
            {commandHistory.length}
          </span>
        </div>

        {/* Search */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--bg-card)",
          border: "1px solid var(--border-medium)",
          borderRadius: 8,
          padding: "6px 12px",
          width: 220,
        }}>
          <Search size={12} color="var(--text-muted)" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search commands..."
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-primary)",
              width: "100%",
            }}
          />
        </div>
      </div>

      {/* List */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}>
        {filtered.length === 0 ? (
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.3,
          }}>
            <p style={{
              fontFamily: "var(--font-display)",
              fontSize: 11,
              letterSpacing: "0.12em",
              color: "var(--text-muted)",
            }}>
              {search ? "NO MATCHING COMMANDS" : "NO COMMANDS YET"}
            </p>
          </div>
        ) : (
          filtered.map((entry, i) => (
            <HistoryEntry key={entry.id || i} entry={entry} />
          ))
        )}
      </div>
    </div>
  );
}

function HistoryEntry({ entry }) {
  const statusIcon = {
    completed: <CheckCircle size={13} color="var(--accent-green)" />,
    failed: <XCircle size={13} color="var(--accent-red)" />,
    executing: <Loader size={13} color="var(--accent-cyan)" />,
  }[entry.status] || <CheckCircle size={13} color="var(--text-muted)" />;

  const timeAgo = entry.timestamp
    ? formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })
    : "";

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "12px 16px",
      background: "var(--bg-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 10,
      transition: "border-color 0.2s ease",
      animation: "fade-in-up 0.3s ease",
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = "var(--border-medium)"}
    onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border-subtle)"}
    >
      {/* Status icon */}
      <div style={{ flexShrink: 0 }}>{statusIcon}</div>

      {/* Command text */}
      <p style={{
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        color: "var(--text-primary)",
        flex: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {entry.command}
      </p>

      {/* Response preview */}
      {entry.result?.response && (
        <p style={{
          fontFamily: "var(--font-body)",
          fontSize: 11,
          color: "var(--text-muted)",
          maxWidth: 200,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}>
          {entry.result.response}
        </p>
      )}

      {/* Time */}
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        color: "var(--text-muted)",
        flexShrink: 0,
      }}>
        {timeAgo}
      </span>
    </div>
  );
}
