export class CheatController {
    constructor(data) {
        this.initializeProperties(data);
        this.initializeDOMElements();
        this.addEventListeners();
    }

    initializeProperties(data) {
        const { tabId, database } = data;
        this.tabId = tabId;
        this._db = database;

        this.key = null;
        this.gameId = null;
        this.currency = null;
        this.cheatName = null;
        this.userId = null;
        this.cheatData = null;
        this.cheatSteps = null;
        this._count = 0;
        this._isCheating = false;
        this._isLoop = false;
        this.isPaused = false;
    }

    initializeDOMElements() {
        this.statusText = document.getElementById('e_txt_status');
        this.statusIndicator = document.getElementById('e_ico_status');
        this.logBox = document.getElementById('e_txt_logs');
        this.clearLogButton = document.getElementById('e_btn_clearLog');
        this.backButton = document.getElementById('e_btn_back');
        this.playButton = document.getElementById('e_btn_play');
        this.stopButton = document.getElementById('e_btn_stop');
        this.pauseButton = document.getElementById('e_btn_pause');
        this.resumeButton = document.getElementById('e_btn_resume');
        this.clearSession = document.getElementById('e_btn_clear');
        this.reloadButton = document.getElementById('e_btn_reload');
        this.mainLoopCheckbox = document.getElementById('m_chk_loop');
        this.execLoopCheckbox = document.getElementById('e_chk_loop');
        this.envCheckbox = document.getElementById('m_chk_env');
    }

    addEventListeners() {
        this.backButton.addEventListener('click', this.handleBackButton);
        this.playButton.addEventListener('click', this.handlePlayCheat);
        this.stopButton.addEventListener('click', this.handleStopCheat);
        this.pauseButton.addEventListener('click', this.handlePauseCheat);
        this.resumeButton.addEventListener('click', this.handleResumeCheat);
        this.clearLogButton.addEventListener('click', this.handleClearLog);
        this.clearSession.addEventListener('click', this.handleClearSessionClick);
        this.reloadButton.addEventListener('click', this.handleReloadGameClick);
        this.mainLoopCheckbox.addEventListener('change', this.handleLoopToggle);
        this.execLoopCheckbox.addEventListener('change', this.handleLoopToggle);
        this.envCheckbox.addEventListener('change', this.handleEnvToggle);
        if (chrome && chrome.runtime) chrome.runtime.onMessage.addListener(this.handleMessage);
    }

    get count() {
        return this._count;
    }
    set count(value) {
        this._count = value;
        document.getElementById('e_txt_step').innerHTML = `Step: ${value}`;
    }
    get isCheating() {
        return this._isCheating;
    }
    set isCheating(value) {
        this._isCheating = !!value;
    }
    get isLoop() {
        return this._isLoop;
    }
    set isLoop(value) {
        this._isLoop = !!value;
        if (this.mainLoopCheckbox) this.mainLoopCheckbox.checked = this._isLoop;
        if (this.execLoopCheckbox) this.execLoopCheckbox.checked = this._isLoop;
    }

    getEnvironment() {
        return this.envCheckbox?.checked ? 'staging' : 'dev';
    }

    syncRuntime(extra = {}) {
        const runtime = {
            isCheating: this.isCheating,
            isPaused: this.isPaused,
            isLoop: this.isLoop,
            stepIndex: this.count,
            gameId: this.gameId,
            userId: this.userId,
            environment: this.getEnvironment(),
            cheatSteps: this.cheatSteps || [],
            ...extra,
        };
        const cmd = `window.cheatScript && window.cheatScript.setRuntime(${JSON.stringify(runtime)})`;
        return this.evalCommand(cmd).catch(() => false);
    }

    evalCommand(cmd) {
        return new Promise((resolve, reject) => {
            if (!chrome?.devtools?.inspectedWindow) {
                reject(new Error('No inspected window'));
                return;
            }
            chrome.devtools.inspectedWindow.eval(cmd, (result, isException) => {
                if (isException) reject(isException);
                else resolve(result);
            });
        });
    }

    handleBackButton = () => {
        this.resetCheatState();
        this.showPage('m_view_container');
    }

    handleLoopToggle = (event) => {
        this.isLoop = event.target.checked;
        this.syncRuntime({ isLoop: this.isLoop });
        if (this.cheatSteps) {
            this.addLog(this.isLoop ? 'Loop enabled' : 'Loop disabled', 'info');
        }
    }

    handleEnvToggle = () => {
        this.syncRuntime({ environment: this.getEnvironment() });
    }

    handlePlayCheat = () => {
        this.startCheat();
    }

    handleStopCheat = () => {
        this.stopCheat();
    }

    handlePauseCheat = () => {
        if (this.isCheating) {
            this.pauseCheat();
        }
    }

    handleResumeCheat = () => {
        if (this.isCheating && this.isPaused) {
            this.resumeCheat();
        }
    }

    handleClearLog = () => {
        this.clearLog();
    }

    handleClearSessionClick = () => {
        const stagingUrl = `https://cheat.staging.enostd.gay/${this.gameId}/clearsession`;
        const devUrl = `https://cheat.dev.enostd.gay/${this.gameId}/clearsession`;
        const isStagingMode = document.getElementById('m_chk_env').checked;
        const url = isStagingMode ? stagingUrl : devUrl;
        const dataPost = this._encodeQueryData({ userId: this.userId, currency: this.currency });
        const request = new XMLHttpRequest();
        request.open('POST', url, true);
        request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        request.onreadystatechange = () => {
            if (request.readyState == 4) {
                if (chrome && chrome.windows && chrome.tabs) {
                    chrome.tabs.reload(this.tabId);
                    this.resetCheatState();
                }
            }
        };
        request.send(dataPost);
    }

    handleReloadGameClick = () => {
        if (chrome && chrome.windows && chrome.tabs) {
            chrome.tabs.reload(this.tabId);
        }
    }

    showCheat({ key, cheatName, gameId, userId, currency }) {
        this.key = Number(key);
        this.cheatName = cheatName;
        this.userId = userId;
        this.gameId = gameId;
        this.currency = currency;
        this.cheatData = {};
        this.cheatSteps = [];
        this.count = 0;
        this.isCheating = false;
        this.isPaused = false;
        this.playButton.disabled = true;
        this.stopButton.disabled = true;
        this.pauseButton.disabled = true;
        this.resumeButton.disabled = true;

        this.clearLog();
        this.addLog(`Open cheat ${cheatName}`);
        this._db.getDataByKey(this.key).then(data => {
            this.cheatData = data;
            this.cheatSteps = data.cheatSteps || [];
            if (this.cheatSteps.length) {
                this.addLog(`Loaded cheat ${cheatName}`, 'success');
                this.showPage('e_view_container');
                this.startCheat().then((ok) => {
                    if (!ok) this.addLog('Failed to sync cheat runtime into game page', 'error');
                });
            } else {
                this.addLog(`No cheat steps`, 'error');
            }
        });
    }

    handleMessage = (message, sender) => {
        if (sender?.tab?.id !== this.tabId) return;
        if (message.action === 'onCheatProgress') {
            this.handleCheatProgress(message.data || {});
        }
    }

    handleCheatProgress(detail) {
        const { type, stepIndex, data, message, event } = detail;
        switch (type) {
            case 'intercept':
                this.addLog(`Spin Click${event ? ` (${event})` : ''}`);
                break;
            case 'success':
                this.addLog(`Cheat Success ${JSON.stringify(data)}`, 'success');
                break;
            case 'step':
                this.count = stepIndex ?? this.count;
                break;
            case 'loop':
                this.addLog('Loop restart', 'info');
                this.count = stepIndex ?? 0;
                break;
            case 'error':
                this.addLog(`Error cheat ${message || JSON.stringify(data)}`, 'error');
                this.stopCheat({ syncOnly: false, skipLog: true });
                this.addLog('Game request blocked until cheat succeeds', 'warning');
                break;
            case 'finished':
                this.addLog(message || 'Cheat finished', 'warn');
                this.stopCheat({ skipLog: true });
                break;
            default:
                break;
        }
    }

    _encodeQueryData(data) {
        return Object.keys(data).map(key => [key, data[key]].map(encodeURIComponent).join("=")).join("&");
    }

    updateStatus(state) {
        this.statusText.textContent = state;
        this.statusIndicator.className = 'status-indicator';
        if (state === 'Running') {
            this.statusIndicator.classList.add('status-indicator-running');
        } else if (state === 'Paused') {
            this.statusIndicator.classList.add('status-indicator-paused');
        } else if (state === 'Stopped') {
            this.statusIndicator.classList.add('status-indicator-stopped');
        }
        this.addLog(`Status updated to: ${state}`);
    }

    clearLog() {
        this.logBox.innerHTML = '';
        this.addLog('Log cleared.', 'success');
    }

    addLog(message, type = '') {
        const time = new Date().toLocaleTimeString();
        let logClass = '';
        if (type === 'warning' || type === 'warn') {
            logClass = 'log-warning';
        }
        if (type === 'error') {
            logClass = 'log-error';
        }
        if (type === 'success' || type === 'info') {
            logClass = 'log-info';
        }
        this.logBox.innerHTML += `<div class="${logClass}">[${time}] ${message}</div>`;
        this.logBox.scrollTop = this.logBox.scrollHeight;
    }

    resetCheatState() {
        this.key = null;
        this.gameId = null;
        this.currency = null;
        this.cheatName = null;
        this.userId = null;
        this.cheatData = null;
        this.cheatSteps = null;
        this.count = 0;
        this.isCheating = false;
        this.isPaused = false;
        this.syncRuntime({
            isCheating: false,
            isPaused: false,
            stepIndex: 0,
            cheatSteps: [],
        });
        this.clearLog();
    }

    showPage(pageId) {
        this.playButton.disabled = false;
        this.stopButton.disabled = true;
        this.pauseButton.disabled = true;
        this.resumeButton.disabled = true;
        document.getElementById('m_view_container').style.display = 'none';
        document.getElementById('s_view_container').style.display = 'none';
        document.getElementById('e_view_container').style.display = 'none';
        document.getElementById('e_txt_title').innerHTML = this.cheatName;
        document.getElementById(pageId).style.display = 'block';
    }

    startCheat() {
        this.isCheating = true;
        this.count = 0;
        this.isPaused = false;
        this.updateStatus('Running');
        this.playButton.disabled = true;
        this.stopButton.disabled = false;
        this.pauseButton.disabled = false;
        this.resumeButton.disabled = true;
        this.addLog(this.isLoop ? 'Start Cheat (Loop)' : 'Start Cheat', "success");
        return this.syncRuntime({
            isCheating: true,
            isPaused: false,
            stepIndex: 0,
            cheatSteps: this.cheatSteps || [],
        });
    }

    stopCheat(options = {}) {
        const { skipLog = false } = options;
        this.isCheating = false;
        this.isPaused = false;
        this.count = 0;
        this.updateStatus('Stopped');
        this.playButton.disabled = false;
        this.stopButton.disabled = true;
        this.pauseButton.disabled = true;
        this.resumeButton.disabled = true;
        if (!skipLog) this.addLog(`Stop cheat`, 'warning');
        return this.syncRuntime({
            isCheating: false,
            isPaused: false,
            stepIndex: 0,
        });
    }

    pauseCheat() {
        this.isPaused = true;
        this.updateStatus('Paused');
        this.pauseButton.disabled = true;
        this.resumeButton.disabled = false;
        this.addLog('Pause button clicked.', 'warning');
        return this.syncRuntime({ isPaused: true });
    }

    resumeCheat() {
        this.isPaused = false;
        this.updateStatus('Running');
        this.pauseButton.disabled = false;
        this.resumeButton.disabled = true;
        this.addLog('Resume button clicked.', 'info');
        return this.syncRuntime({ isPaused: false });
    }
}
