const { Tray, Menu, nativeImage } = require("electron");
const path = require("path");

function setupTray(mainWindow, app, showWindow, isQuittingRef) {
  let icon;
  try {
    icon = nativeImage.createFromPath(path.join(__dirname, "../../../assets/tray-icon.png"));
  } catch {
    icon = nativeImage.createEmpty();
  }

  const tray = new Tray(icon);
  tray.setToolTip("JARVIS - AI Assistant (nasluchuje w tle)");

  const updateMenu = () => Menu.buildFromTemplate([
    { label: "Pokaz JARVIS", click: () => showWindow() },
    { type: "separator" },
    { label: "JARVIS nasluchuje w tle", enabled: false },
    { type: "separator" },
    {
      label: "Zakoncz",
      click: () => {
        app.quit();
      }
    },
  ]);

  tray.setContextMenu(updateMenu());

  tray.on("click", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      showWindow();
    }
  });

  tray.on("double-click", () => showWindow());

  return tray;
}

module.exports = { setupTray };
