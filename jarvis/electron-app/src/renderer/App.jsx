import React, { useEffect } from "react";
import useJarvisStore from "./store/jarvisStore.js";
import TitleBar from "./components/TitleBar.jsx";
import MainPage from "./pages/MainPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import ConfirmationModal from "./components/ConfirmationModal.jsx";
import ConnectionOverlay from "./components/ConnectionOverlay.jsx";

export default function App() {
  const { connect, activePage, wsConnected, pendingConfirmation } = useJarvisStore();

  useEffect(() => {
    connect();
    if (window.electron?.onTrayCommand) {
      window.electron.onTrayCommand((cmd) => {
        if (cmd === "start") useJarvisStore.getState().startListening();
        if (cmd === "stop") useJarvisStore.getState().stopListening();
      });
    }
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg-primary)" }}>
      <TitleBar />
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {activePage === "main" && <MainPage />}
        {activePage === "history" && <HistoryPage />}
        {activePage === "settings" && <SettingsPage />}
      </div>
      {pendingConfirmation && <ConfirmationModal />}
      {!wsConnected && <ConnectionOverlay />}
    </div>
  );
}
