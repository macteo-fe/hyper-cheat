import { TableController } from "./controllers/TableController.js";
import { CheatController } from "./controllers/CheatController.js";
import { FormController } from "./controllers/FormController.js";

export class App {
    constructor({ tabId, database }) {
        this.tabId = tabId;
        this.isInit = false;
        this.gameId = null;
        this.currency = null;
        this.userId = null;
        this.isOverwriting = false;

        this.cheatController = new CheatController({ tabId, database });
        this.formController = new FormController({ tabId, database, cheatController: this.cheatController });
        this.table = new TableController({ tabId, database, cheatController: this.cheatController, formController: this.formController });
        this.start();
    }
    start() {
        this.labelMessage = document.getElementById('m_txt_logMessage');
        this.checkboxEnv = document.getElementById('m_chk_env');
        this.viewContainer = document.getElementById('m_view_container');
        this.viewSteps = document.getElementById('s_view_container');
        this.viewExecution = document.getElementById('e_view_container');
        this.labelTitle = document.getElementById('m_txt_title');
        this.btnCheatSpeed = document.getElementById('m_btn_speedUp');
        this.btnCheatSpeed.addEventListener('click', this.handleCheatSpeedClick);
        this.btnStopSpeed = document.getElementById('m_btn_stopSpeed');
        this.btnStopSpeed.addEventListener('click', this.handleStopCheatSpeedClick);


        if (chrome && chrome.runtime) {
            chrome.runtime.onMessage.addListener(this.handleMessage);
            this.gameLoop();
        } else {
            this.logMessage('No chrome runtime found!');
        }
    }
    handleMessage = (message, sender) => {
        if (message.action === "onGameConfigResponse" && this.tabId == sender.tab.id) {
            this.updateGameInfo(message.data);
        }
        // if (message.action === "onFailedToGetDirector" && this.tabId == sender.tab.id) {
        //     this.resetGameInfo();
        // }
    }
    gameLoop() {
        this.update();
        setTimeout(this.gameLoop.bind(this), 1000);
    }

    update() {
        this.checkOverwrite().then(isOverWrite => {
            if (isOverWrite) {
                if (!this.isInit) this.requestGameConfig();
            } else {
                if (!this.isOverwriting) {
                    this.overWriteFunction();
                }
            }
        });
    }

    resetGameInfo() {
        this.isInit = false;
        this.gameId = null;
        this.userId = null;
        this.currency = null;
        this.isOverwriting = false;

        this.labelMessage.style.display = 'block';
        this.viewContainer.style.display = 'none';
        this.viewSteps.style.display = 'none';
        this.viewExecution.style.display = 'none';
        this.labelMessage.innerHTML = 'Loading Game...';

        this.table.clearTable();
        this.formController.clearForm();
        this.cheatController.resetCheatState();
    }
    updateGameInfo(data) {
        if (this.isInit || !data) return;
        const { gameId, userId, currency } = data;
        this.gameId = gameId;
        this.userId = userId;
        this.currency = currency || 'USD';
        const isDevelopMode = localStorage.getItem('isDevelopMode')
        this.checkboxEnv.checked = isDevelopMode != "true";
        this.labelMessage.style.display = 'none';
        this.viewContainer.style.display = 'block';
        this.viewSteps.style.display = 'none';
        this.viewExecution.style.display = 'none';
        this.labelTitle.innerHTML = `Cheat ${this.gameId} - ${this.userId}`;

        this.table.updateConfig({ gameId: this.gameId, userId: this.userId, currency: this.currency });
        this.table.renderTable();
        this.isInit = true;
    }

    async checkOverwrite() {
        const cmd = `window.cheatScript && window.cheatScript.isOverwritten`;
        return await this.evalCommand(cmd);
    }
    async overWriteFunction() {
        if (this.isOverwriting) return;
        this.isOverwriting = true;
        try {
            const response = await fetch(chrome.runtime.getURL("src/utils/EvalCheatScript.js"));
            const code = await response.text();
            await this.evalCommand(code);
        } catch (error) {
            this.isOverwriting = false;
            this.logMessage(`Error in overwrite cheat!`);
        }
    }
    async requestGameConfig() {
        const cmd = `cheatScript.getCheatConfig()`;
        return await this.evalCommand(cmd);
    }
    async loadCheatScenario(gameId) {
        const urls = [
            `https://cheat.staging.enostd.gay/${gameId}/inputdata`,
            `https://cheat.dev.enostd.gay/${gameId}/inputdata`
        ];
        for (const url of urls) {
            const response = await fetch(url);
            if (response.ok) {
                return true;
            }
        }
        throw this.logMessage('Failed to load cheat scenario!');
    }
    handleCheatSpeedClick = () => {
        const cmd = `cheatScript.setCheatSpeed(10)`;
        this.evalCommand(cmd);
        this.btnCheatSpeed.style.display = 'none';
        this.btnStopSpeed.style.display = 'inline-block';
    }
    handleStopCheatSpeedClick = () => {
        const cmd = `cheatScript.resetSpeed()`;
        this.evalCommand(cmd);
        this.btnCheatSpeed.style.display = 'inline-block';
        this.btnStopSpeed.style.display = 'none';
    }
    evalCommand(cmd) {
        return new Promise((resolve, reject) => {
            chrome.devtools.inspectedWindow.eval(cmd, (result, isException) => {
                if (isException) {
                    reject(isException);
                } else {
                    resolve(result);
                }
            });
        });
    }
    logMessage(message, type = 'danger') {
        this.labelMessage.innerHTML = message;
        this.labelMessage.classList.add(`text-${type}`);
    }
}