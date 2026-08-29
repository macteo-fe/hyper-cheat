import { Database } from "./services/Database.js";
import { App } from "./App.js";

const database = new Database();
database.onload = () => {
    const tabId = chrome.devtools?.inspectedWindow?.tabId;
    if (!tabId) {
        console.error('Tool-Cheat-Slot: no inspected tab found');
        return;
    }
    const toolCheat = new App({ tabId, database });
    chrome.webNavigation.onCommitted.addListener((details) => {
        if (tabId == details.tabId) toolCheat.resetGameInfo();
    });
};
document.getElementById('m_chk_env').addEventListener('change', (event) => {
    localStorage.setItem('isDevelopMode', !event.target.checked);
});

