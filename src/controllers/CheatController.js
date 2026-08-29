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
        if (chrome && chrome.runtime) chrome.runtime.onMessage.addListener(this.handleMessage);
    }

    get count() {
        return this._count;
    }
    set count(value) {
        if (this.cheatSteps && this.cheatSteps.length && value >= this.cheatSteps.length) {
            this.addLog(`No Cheat Steps`, 'warn');
            this.stopCheat();
            value = 0;
        }
        document.getElementById('e_txt_step').innerHTML = `Step: ${value}`;
        this._count = value;
    }
    get isCheating() {
        return this._isCheating;
    }
    set isCheating(value) {
        const cmd = `cheatScript.isCheating = ${value}`;
        chrome.devtools.inspectedWindow.eval(cmd, () => { });
        this._isCheating = value;
    }

    //handle Event
    handleBackButton = () => {
        this.resetCheatState();
        this.showPage('m_view_container');
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
        request.onreadystatechange = function () {
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
            } else {
                this.addLog(`No cheat steps`, 'error');
            }
        });
    }

    handleMessage = (message, sender) => {
        if (message.action === "onSendCheatToNetwork" && this.tabId == sender.tab.id) {
            this.addLog(`Spin Click`);
            this.cheat(() => {
                this.callRunORGFunction(message);
            });
        }
    }

    callRunORGFunction(message) {
        let data = message.data;
        data.isCheated = true;
        const params = JSON.stringify(message.data);
        const cmd = `cheatScript.gameState._clientSendRequest(${params})`;
        chrome.devtools.inspectedWindow.eval(cmd, (result, isException) => {
            if (isException) {
                console.error(`Error call _clientSendRequest`, isException);
            } else {
                console.log(`Successfully call _clientSendRequest`, result);
            }
        });
    }

    cheat(callbackSendSpin) {
        const stagingUrl = `https://cheat.staging.enostd.gay/${this.gameId}/inputed`;
        const devUrl = `https://cheat.dev.enostd.gay/${this.gameId}/inputed`;
        const isStagingMode = document.getElementById('m_chk_env').checked;
        const apiUrl = isStagingMode ? stagingUrl : devUrl;
        this.callbackPost = () => {
            callbackSendSpin && callbackSendSpin();
            this.callbackPost = null;
        };
        if (this.isCheating && !this.isPaused) {
            const data = this.cheatSteps[this.count];
            if (!data) {
                this.addLog(`No Step ${this.count}`, 'danger');
                this.stopCheat();
                return this.callbackPost && this.callbackPost();
            }
            data.userId = this.userId;
            delete data.index;
            this._post({
                url: apiUrl, data,
                callback: (response) => {
                    if (this.callbackPost) {
                        this.addLog(`Cheat Success ${JSON.stringify(data)}`, 'success');
                        this.count++;
                        this.callbackPost();
                    }
                },
                callbackErr: () => {
                    if (this.callbackPost) {
                        this.addLog(`Error cheat ${JSON.stringify(data)}`, 'error');
                        this.stopCheat();
                        this.callbackPost();
                    }
                }
            });
        } else {
            callbackSendSpin && callbackSendSpin();
        }
    }


    _post({ url = '', data = {}, callback = (data) => { }, apiUrl = '', callbackErr = () => { } }) {
        const dataPost = this._encodeQueryData(data);
        const fullURL = apiUrl + url;
        const request = new XMLHttpRequest();
        request.open('POST', fullURL, true);
        request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
        request.onreadystatechange = function () {
            if (request.readyState == 4) {
                if (request.status === 200) {
                    callback({
                        status: request.status,
                        data: request.responseText
                    });
                } else {
                    callbackErr();
                }
            } else if (request.readyState === 0) {
                callbackErr();
            }
        };
        request.ontimeout = function (e) {
            callbackErr();
        };
        request.onerror = (e) => {
            callbackErr();
        };
        request.send(dataPost);
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
        if (type === 'warning') {
            logClass = 'log-warning';
        }
        if (type === 'error') {
            logClass = 'log-error';
        }
        if (type === 'success') {
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
        this.stopCheat();
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
        this.addLog(`Start Cheat`, "success");
    }

    stopCheat() {
        this.isCheating = false;
        this.isPaused = false;
        this.count = 0;
        this.updateStatus('Stopped');
        this.playButton.disabled = false;
        this.stopButton.disabled = true;
        this.pauseButton.disabled = true;
        this.resumeButton.disabled = true;
        this.addLog(`Stop cheat`, 'warning');
    }

    pauseCheat() {
        this.isPaused = true;
        this.updateStatus('Paused');
        this.pauseButton.disabled = true;
        this.resumeButton.disabled = false;
        this.addLog('Pause button clicked.', 'warning');
    }

    resumeCheat() {
        this.isPaused = false;
        this.updateStatus('Running');
        this.pauseButton.disabled = false;
        this.resumeButton.disabled = true;
        this.addLog('Resume button clicked.', 'info');
    }
}