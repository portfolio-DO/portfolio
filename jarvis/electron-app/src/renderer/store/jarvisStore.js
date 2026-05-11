import { create } from "zustand";

const WS_URL = "ws://localhost:8765";

const useJarvisStore = create((set, get) => ({
  wsConnected: false,
  ws: null,
  status: "idle",
  transcript: "",
  lastResponse: "",
  chatMessages: [],
  commandHistory: [],
  pendingConfirmation: null,
  isEmergencyStopVisible: false,
  activePage: "main",
  settings: {
    requireConfirmation: true,
    sandboxMode: false,
    ttsEngine: "pyttsx3",
    sttModel: "base.en",
    wakeWord: "jarvis",
    geminiModel: "gemini-1.5-flash",
  },

  connect: () => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log("Backend polaczony");
      set({ wsConnected: true, ws });
      // Backend auto-startuje nasluchiwanie - pobierz tylko ustawienia i historie
      ws.send(JSON.stringify({ type: "get_settings" }));
      ws.send(JSON.stringify({ type: "get_history" }));
    };

    ws.onclose = () => {
      set({ wsConnected: false, ws: null, status: "idle" });
      setTimeout(() => get().connect(), 3000);
    };

    ws.onerror = () => {};

    ws.onmessage = (event) => {
      try {
        get().handleMessage(JSON.parse(event.data));
      } catch (e) {}
    };

    set({ ws });
  },

  handleMessage: (msg) => {
    switch (msg.type) {
      case "status":
        set({ status: msg.value });
        set({ isEmergencyStopVisible: msg.value === "executing" });
        break;

      case "transcript":
        set({ transcript: msg.text });
        if (msg.final && msg.text) {
          set({ transcript: "" });
          get().addChatMessage("user", msg.text);
        }
        break;

      case "response":
        set({ lastResponse: msg.text });
        get().addChatMessage("assistant", msg.text);
        break;

      case "command_log":
        get().addCommandLog(msg.command);
        break;

      case "confirmation_request":
        set({ pendingConfirmation: msg.request });
        break;

      case "settings":
      case "settings_updated":
        set({ settings: { ...get().settings, ...msg.settings } });
        break;

      case "history":
        set({ commandHistory: msg.history });
        break;

      case "show_window":
        // Backend wykryl wake word - pokaz okno
        if (window.electron?.showWindow) {
          window.electron.showWindow();
        }
        break;
    }
  },

  send: (msg) => {
    const { ws, wsConnected } = get();
    if (ws && wsConnected) ws.send(JSON.stringify(msg));
  },

  // UI moze nadal recznie wlaczac/wylaczac przez przycisk
  startListening: () => get().send({ type: "start_listening" }),
  stopListening:  () => get().send({ type: "stop_listening" }),

  sendTextCommand: (text) => {
    get().send({ type: "text_command", text });
    get().addChatMessage("user", text);
  },

  emergencyStop: () => {
    get().send({ type: "emergency_stop" });
    set({ isEmergencyStopVisible: false });
  },

  approveConfirmation: () => {
    const { pendingConfirmation } = get();
    if (pendingConfirmation) {
      get().send({ type: "confirmation_response", request_id: pendingConfirmation.id, approved: true });
      set({ pendingConfirmation: null });
    }
  },

  denyConfirmation: () => {
    const { pendingConfirmation } = get();
    if (pendingConfirmation) {
      get().send({ type: "confirmation_response", request_id: pendingConfirmation.id, approved: false });
      set({ pendingConfirmation: null });
    }
  },

  updateSettings: (s) => {
    set({ settings: { ...get().settings, ...s } });
    get().send({ type: "update_settings", settings: s });
  },

  addChatMessage: (role, text) => {
    const msg = { id: Date.now() + Math.random(), role, text, timestamp: new Date().toISOString() };
    set((s) => ({ chatMessages: [...s.chatMessages.slice(-100), msg] }));
  },

  addCommandLog: (command) => {
    const entry = { id: Date.now(), command, timestamp: new Date().toISOString(), status: "completed" };
    set((s) => ({ commandHistory: [entry, ...s.commandHistory].slice(0, 500) }));
  },

  setActivePage: (page) => set({ activePage: page }),
}));

export default useJarvisStore;
