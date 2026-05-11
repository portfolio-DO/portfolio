const { ipcMain, shell } = require("electron");

function setupIpcHandlers(mainWindow, showWindow, hideWindow) {
  ipcMain.on("window:minimize", () => mainWindow.minimize());
  ipcMain.on("window:maximize", () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on("window:close", () => hideWindow());
  ipcMain.on("window:show", () => showWindow());
  ipcMain.on("open:external", (_, url) => shell.openExternal(url));
}

module.exports = { setupIpcHandlers };
