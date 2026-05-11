import React, { useState } from "react";
import {
  Settings, Mic, Volume2, Shield, Brain, Key,
  ToggleLeft, ToggleRight, Save, ChevronDown, ExternalLink
} from "lucide-react";
import useJarvisStore from "../store/jarvisStore.js";

const Section = ({ title, icon: Icon, children, accent }) => (
  <div style={{
    background: "var(--bg-card)", border: `1px solid ${accent || "var(--border-subtle)"}`,
    borderRadius: 12, overflow: "hidden", marginBottom: 16,
  }}>
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "14px 18px", borderBottom: "1px solid var(--border-subtle)",
      background: accent ? `${accent}08` : "var(--bg-panel)",
    }}>
      <Icon size={13} color={accent || "var(--accent-cyan)"} />
      <span style={{ fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.15em", color: accent || "var(--text-secondary)" }}>
        {title}
      </span>
    </div>
    <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
      {children}
    </div>
  </div>
);

const Toggle = ({ label, description, value, onChange }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
    <div>
      <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-primary)", marginBottom: 2 }}>{label}</p>
      {description && <p style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--text-muted)" }}>{description}</p>}
    </div>
    <button onClick={() => onChange(!value)} style={{
      background: "none", border: "none", cursor: "pointer",
      color: value ? "var(--accent-green)" : "var(--text-muted)", flexShrink: 0,
    }}>
      {value ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
    </button>
  </div>
);

const SelectField = ({ label, value, options, onChange }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
    <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-primary)" }}>{label}</p>
    <div style={{ position: "relative" }}>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        background: "var(--bg-secondary)", border: "1px solid var(--border-medium)",
        borderRadius: 6, color: "var(--text-primary)", fontFamily: "var(--font-mono)",
        fontSize: 12, padding: "6px 28px 6px 10px", cursor: "pointer", outline: "none", appearance: "none",
      }}>
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      <ChevronDown size={12} color="var(--text-muted)" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
    </div>
  </div>
);

const TextField = ({ label, value, onChange, placeholder, type = "text", hint }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <label style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-secondary)" }}>{label}</label>
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{
        background: "var(--bg-secondary)", border: "1px solid var(--border-medium)", borderRadius: 6,
        color: "var(--text-primary)", fontFamily: "var(--font-mono)", fontSize: 12,
        padding: "8px 12px", outline: "none", width: "100%",
      }}
      onFocus={e => e.target.style.borderColor = "var(--accent-cyan)"}
      onBlur={e => e.target.style.borderColor = "var(--border-medium)"}
    />
    {hint && <p style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--text-muted)" }}>{hint}</p>}
  </div>
);

const InfoBox = ({ children, color }) => (
  <div style={{
    background: `${color || "rgba(0,212,255"}0.05)`, border: "1px solid var(--border-subtle)",
    borderRadius: 8, padding: "10px 12px",
  }}>
    <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.7 }}>
      {children}
    </p>
  </div>
);

export default function SettingsPage() {
  const { settings, updateSettings } = useJarvisStore();
  const [local, setLocal] = useState({ ...settings });
  const [saved, setSaved] = useState(false);

  const update = (key, value) => setLocal(prev => ({ ...prev, [key]: value }));

  const handleSave = () => {
    updateSettings(local);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "24px 32px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Settings size={16} color="var(--accent-cyan)" />
          <span style={{ fontFamily: "var(--font-display)", fontSize: 12, letterSpacing: "0.15em", color: "var(--text-primary)" }}>
            KONFIGURACJA
          </span>
        </div>
        <button onClick={handleSave} style={{
          background: saved ? "rgba(0,255,136,0.1)" : "rgba(0,212,255,0.1)",
          border: `1px solid ${saved ? "rgba(0,255,136,0.4)" : "var(--border-strong)"}`,
          borderRadius: 8, color: saved ? "var(--accent-green)" : "var(--accent-cyan)",
          fontFamily: "var(--font-display)", fontSize: 10, letterSpacing: "0.1em",
          padding: "8px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        }}>
          <Save size={12} /> {saved ? "ZAPISANO!" : "ZAPISZ"}
        </button>
      </div>

      {/* OLLAMA */}
      <Section title="OLLAMA — LOKALNY AI (ZALECANY, ZERO LIMITOW)" icon={Brain} accent="#00ff88">
        <InfoBox color="rgba(0,255,136,">
          Ollama dziala w 100% lokalnie — offline, zero limitow, zero klucza API.<br/>
          1. Pobierz: <strong>ollama.com/download</strong><br/>
          2. W terminalu: <strong>ollama pull llama3.2</strong><br/>
          3. Uruchom Ollama i zrestartuj JARVIS — wykryje go automatycznie.
        </InfoBox>
        <SelectField
          label="Model Ollama"
          value={local.ollamaModel || "llama3.2"}
          options={[
            { value: "llama3.2",  label: "llama3.2 — dobry, szybki (ZALECANY)" },
            { value: "llama3.1",  label: "llama3.1 — starszy ale solidny" },
            { value: "mistral",   label: "mistral — alternatywa" },
            { value: "gemma2",    label: "gemma2 — od Google, lokalnie" },
            { value: "phi3",      label: "phi3 — maly, bardzo szybki" },
            { value: "qwen2.5",   label: "qwen2.5 — dobry do zadan" },
          ]}
          onChange={v => update("ollamaModel", v)}
        />
      </Section>

      {/* GROQ */}
      <Section title="GROQ — SZYBKI DARMOWY CLOUD AI" icon={Brain} accent="#7b2fff">
        <InfoBox>
          Groq oferuje bardzo szybki inference praktycznie bez limitow dla uzytku osobistego.<br/>
          Zaloz darmowe konto: <strong>console.groq.com</strong> i wklej klucz ponizej.
        </InfoBox>
        <TextField
          label="Groq API Key"
          value={local.groqApiKey || ""}
          onChange={v => update("groqApiKey", v)}
          placeholder="gsk_..."
          type="password"
          hint="Darmowy klucz: console.groq.com — rejestracja 30 sekund"
        />
        <SelectField
          label="Model Groq"
          value={local.groqModel || "llama-3.1-8b-instant"}
          options={[
            { value: "llama-3.1-8b-instant",    label: "llama-3.1-8b-instant — najszybszy (ZALECANY)" },
            { value: "llama-3.3-70b-versatile", label: "llama-3.3-70b-versatile — madrzejszy" },
            { value: "gemma2-9b-it",            label: "gemma2-9b-it — alternatywa" },
          ]}
          onChange={v => update("groqModel", v)}
        />
      </Section>

      {/* GEMINI */}
      <Section title="GOOGLE GEMINI — OGRANICZONY DARMOWY TIER" icon={Brain}>
        <InfoBox>
          Limit: 15 zapytan/minute, 1500/dzien. Uzywaj jako fallback gdy Ollama/Groq niedostepne.<br/>
          Klucz: <strong>aistudio.google.com/app/apikey</strong>
        </InfoBox>
        <TextField
          label="Google AI Studio API Key"
          value={local.googleApiKey || ""}
          onChange={v => update("googleApiKey", v)}
          placeholder="AIza..."
          type="password"
        />
        <SelectField
          label="Model Gemini"
          value={local.geminiModel || "gemini-1.5-flash"}
          options={[
            { value: "gemini-1.5-flash",     label: "gemini-1.5-flash" },
            { value: "gemini-1.5-flash-8b",  label: "gemini-1.5-flash-8b" },
            { value: "gemini-1.5-pro",       label: "gemini-1.5-pro" },
            { value: "gemini-2.0-flash",     label: "gemini-2.0-flash" },
            { value: "gemini-2.0-flash-lite", label: "gemini-2.0-flash-lite" },
          ]}
          onChange={v => update("geminiModel", v)}
        />
      </Section>

      {/* VOICE INPUT */}
      <Section title="VOICE INPUT" icon={Mic}>
        <SelectField
          label="Wake Word"
          value={local.wakeWord || "jarvis"}
          options={[
            { value: "jarvis",      label: "Hey Jarvis (domyslny)" },
            { value: "alexa",       label: "Alexa" },
            { value: "computer",    label: "Computer (Star Trek)" },
            { value: "hey mycroft", label: "Hey Mycroft" },
          ]}
          onChange={v => update("wakeWord", v)}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <label style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-secondary)" }}>Czulosc wake word</label>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-cyan)" }}>
              {(local.wakeWordThreshold || 0.5).toFixed(1)}
            </span>
          </div>
          <input type="range" min="0.3" max="0.9" step="0.1"
            value={local.wakeWordThreshold || 0.5}
            onChange={e => update("wakeWordThreshold", parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "var(--accent-cyan)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>0.3 — bardziej czuly</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)" }}>0.9 — ostrozniejszy</span>
          </div>
        </div>
        <SelectField
          label="Whisper Model"
          value={local.sttModel || "base.en"}
          options={[
            { value: "tiny.en",   label: "Tiny — najszybszy" },
            { value: "base.en",   label: "Base — balans (ZALECANY)" },
            { value: "small.en",  label: "Small — dokladniejszy" },
            { value: "medium.en", label: "Medium — wysoka dokladnosc" },
            { value: "large-v3",  label: "Large v3 — najlepszy" },
          ]}
          onChange={v => update("sttModel", v)}
        />
      </Section>

      {/* TTS */}
      <Section title="VOICE OUTPUT" icon={Volume2}>
        <SelectField
          label="TTS Engine"
          value={local.ttsEngine || "pyttsx3"}
          options={[
            { value: "pyttsx3",    label: "pyttsx3 — offline, darmowy" },
            { value: "elevenlabs", label: "ElevenLabs — premium, realistyczny" },
            { value: "system",     label: "System TTS" },
          ]}
          onChange={v => update("ttsEngine", v)}
        />
        {local.ttsEngine === "elevenlabs" && (
          <TextField
            label="ElevenLabs API Key"
            value={local.elevenlabsApiKey || ""}
            onChange={v => update("elevenlabsApiKey", v)}
            placeholder="your-key"
            type="password"
          />
        )}
      </Section>

      {/* SAFETY */}
      <Section title="BEZPIECZENSTWO" icon={Shield}>
        <Toggle
          label="Wymagaj potwierdzenia"
          description="Pytaj przed wykonaniem ryzykownych akcji"
          value={local.requireConfirmation !== false}
          onChange={v => update("requireConfirmation", v)}
        />
        <Toggle
          label="Tryb sandbox"
          description="Loguj komendy bez wykonywania (do testow)"
          value={local.sandboxMode === true}
          onChange={v => update("sandboxMode", v)}
        />
      </Section>

      {/* PLUGINS */}
      <Section title="PLUGINY" icon={Key}>
        <TextField
          label="OpenWeatherMap API Key (opcjonalne)"
          value={local.weatherApiKey || ""}
          onChange={v => update("weatherApiKey", v)}
          placeholder="Darmowy klucz: openweathermap.org"
          type="password"
        />
      </Section>

      <div style={{ height: 32 }} />
    </div>
  );
}
