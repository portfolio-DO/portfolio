/**
 * JARVIS Electron Main Process
 */

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const { setupTray } = require("./tray");
const { setupIpcHandlers } = require("./ipc-handlers");

let mainWindow = null;
let pythonProcess = null;
let tray = null;
let isQuitting = false;

const isDev = process.env.NODE_ENV !== "production";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    backgroundColor: "#0a0a0f",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,  // Zacznij ukryty - pojawi sie po wake word lub kliknieciu tray
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  mainWindow.once("ready-to-show", () => {
    // NIE pokazuj od razu - czekamy na wake word
    // mainWindow.show();
  });

  // Zamknij = minimalizuj do tray (nie konczy aplikacji)
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function showWindow() {
  if (!mainWindow) return;
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  mainWindow.focus();
  // Animacja pojawienia sie
  mainWindow.setOpacity(0);
  let opacity = 0;
  const fadeIn = setInterval(() => {
    opacity += 0.1;
    if (opacity >= 1) {
      opacity = 1;
      clearInterval(fadeIn);
    }
    mainWindow.setOpacity(opacity);
  }, 20);
}

function hideWindow() {
  if (mainWindow && mainWindow.isVisible()) {
    mainWindow.hide();
  }
}

function startPythonBackend() {
  const pythonExe = process.platform === "win32" ? "python" : "python3";
  const backendPath = path.join(__dirname, "../../../python-backend/main.py");

  logger(`Startuje Python: ${pythonExe} ${backendPath}`);

  pythonProcess = spawn(pythonExe, [backendPath], {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: path.join(__dirname, "../../../python-backend"),
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
  });

  pythonProcess.stdout.on("data", (data) => {
    process.stdout.write(`[Python] ${data}`);
  });

  pythonProcess.stderr.on("data", (data) => {
    process.stderr.write(`[Python ERR] ${data}`);
  });

  pythonProcess.on("close", (code) => {
    logger(`Python zakonczony (kod ${code})`);
    pythonProcess = null;
  });

  pythonProcess.on("error", (err) => {
    console.error("Blad uruchamiania Python:", err);
  });
}

function logger(msg) {
  process.stdout.write(`[Electron] ${msg}\n`);
}

app.whenReady().then(() => {
  createWindow();
  startPythonBackend();
  setupIpcHandlers(mainWindow, showWindow, hideWindow);
  tray = setupTray(mainWindow, app, showWindow, isQuitting);
  
  // Eksportuj showWindow zeby tray i IPC mogly go uzywac
  app.showJarvisWindow = showWindow;
});

// Nie zamykaj przy zamknieciu wszystkich okien
app.on("window-all-closed", () => {
  // Zostajemy w tray
});

app.on("before-quit", () => {
  isQuitting = true;
  if (pythonProcess) {
    pythonProcess.kill("SIGTERM");
  }
});

// Jeden instancja
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showWindow();
  });
}

// Eksportuj showWindow dla WebSocket z renderera
module.exports = { showWindow, hideWindow };
