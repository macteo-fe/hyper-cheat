(function () {
    if (window.EvalCheatScript) {
        console.log("CHEAT_TOOL: already exists, skipping redefinition");
    } else {
        window.EvalCheatScript = class EvalCheatScript {
            constructor(cc, director) {
                if (!cc) {
                    console.error("CHEAT_TOOL: cc object is required for EvalCheatScript.");
                    return;
                }
                this.cc = cc;
                this.director = director;
                if (!this.director) {
                    console.error("CHEAT_TOOL:Director component not found.");
                    return;
                }
                this.gameVersion = cc.ENGINE_VERSION[0];
                const gameStateBase = this.director?.gameStateManager;
                const gameStateBaseV2 = this.director?.gameLogic?._gameStateManager?._gameState;
                this.gameState = gameStateBase || gameStateBaseV2;
                this.isBaseV2 = !!gameStateBaseV2;
                this.isOverwritten = false;
                this.isCheating = false;
                this.isPaused = false;
                this.isLoop = false;
                this.cheatSteps = [];
                this.stepIndex = 0;
                this.gameId = null;
                this.userId = null;
                this.environment = 'staging';
                this._spinChain = Promise.resolve();
                this._SPIN_EVENTS = [
                    'client-normal-game-trial-request',
                    'client-normal-spin-request',
                    'client-free-spin-request',
                    'client-free-game-trial-request',
                    'client-respin-trial-request',
                    'client-respin-request',
                    'client-lightning-game-trial-request',
                    'client-lightning-spin-request',
                    'client-powerup-game-trial-request',
                    'client-powerup-spin-request',
                ];
                if (this.gameState) {
                    this.overWriteFunction();
                    this.initCheatSpeed();
                }
            }

            setRuntime(config = {}) {
                if (config.isCheating !== undefined) this.isCheating = !!config.isCheating;
                if (config.isPaused !== undefined) this.isPaused = !!config.isPaused;
                if (config.isLoop !== undefined) this.isLoop = !!config.isLoop;
                if (config.stepIndex !== undefined) this.stepIndex = Number(config.stepIndex) || 0;
                if (config.gameId !== undefined) this.gameId = config.gameId;
                if (config.userId !== undefined) this.userId = config.userId;
                if (config.environment !== undefined) this.environment = config.environment;
                if (Array.isArray(config.cheatSteps)) {
                    this.cheatSteps = config.cheatSteps.map((step) => ({ ...step }));
                }
                return true;
            }

            overWriteFunction() {
                if (this.isOverwritten || this.director.isOverWriteCheat) {
                    console.log("CHEAT_TOOL: Function already overwritten, skipping...");
                    return false;
                }

                try {
                    if (!this.gameState.orgClientSendRequest) {
                        this.gameState.orgClientSendRequest = this.gameState._clientSendRequest.bind(this.gameState);
                    }

                    this.gameState._clientSendRequest = (...params) => {
                        const data = params[params.length - 1];
                        const { event, isCheated } = data || {};
                        const shouldCheat = this.isCheating
                            && !this.isPaused
                            && !isCheated
                            && this.director.isOverWriteCheat
                            && this._SPIN_EVENTS.includes(event);

                        if (!shouldCheat) {
                            this.gameState.orgClientSendRequest(...params);
                            return;
                        }

                        this._emitProgress('intercept', { event, stepIndex: this.stepIndex });
                        this._spinChain = this._spinChain
                            .catch(() => { })
                            .then(() => this._handleCheatedSpin(params));
                    };

                    this.director.isOverWriteCheat = true;
                    this.isOverwritten = true;
                    console.log("CHEAT_TOOL: Function overwrite completed successfully");
                    return true;
                } catch (error) {
                    console.error("CHEAT_TOOL: Error during function overwrite:", error);
                    return false;
                }
            }

            async _handleCheatedSpin(params) {
                const data = params[params.length - 1];
                const step = this._getCurrentStepPayload();

                if (!step) {
                    this._emitProgress('finished', { stepIndex: this.stepIndex, message: 'No cheat steps' });
                    this.isCheating = false;
                    this.gameState.orgClientSendRequest(...params);
                    return;
                }

                try {
                    await this.sendCheat(step);
                    data.isCheated = true;
                    this._advanceStep(step);
                    this.gameState.orgClientSendRequest(...params);
                } catch (error) {
                    this._emitProgress('error', {
                        stepIndex: this.stepIndex,
                        data: step,
                        message: error?.message || 'Cheat request failed',
                    });
                    // Do not send the real game request when cheat fails.
                }
            }

            _getCurrentStepPayload() {
                if (!this.cheatSteps || !this.cheatSteps.length) return null;
                if (this.stepIndex < 0 || this.stepIndex >= this.cheatSteps.length) return null;
                const step = { ...this.cheatSteps[this.stepIndex] };
                delete step.index;
                if (this.userId) step.userId = this.userId;
                return step;
            }

            _advanceStep(step) {
                const completedIndex = this.stepIndex;
                let nextIndex = completedIndex + 1;

                this._emitProgress('success', { stepIndex: completedIndex, data: step });

                if (nextIndex >= this.cheatSteps.length) {
                    if (this.isLoop) {
                        nextIndex = 0;
                        this.stepIndex = nextIndex;
                        this._emitProgress('loop', { stepIndex: nextIndex });
                        this._emitProgress('step', { stepIndex: nextIndex });
                        return;
                    }
                    this.isCheating = false;
                    this.stepIndex = 0;
                    this._emitProgress('finished', { stepIndex: 0, data: step });
                    return;
                }

                this.stepIndex = nextIndex;
                this._emitProgress('step', { stepIndex: nextIndex });
            }

            _getCheatUrl() {
                const env = this.environment === 'dev' ? 'dev' : 'staging';
                return `https://cheat.${env}.enostd.gay/${this.gameId}/inputed`;
            }

            _encodeQueryData(data) {
                return Object.keys(data)
                    .filter((key) => data[key] !== undefined && data[key] !== null)
                    .map((key) => [key, data[key]].map(encodeURIComponent).join('='))
                    .join('&');
            }

            sendCheat(data) {
                return new Promise((resolve, reject) => {
                    if (!this.gameId) {
                        reject(new Error('Missing gameId'));
                        return;
                    }
                    const request = new XMLHttpRequest();
                    request.open('POST', this._getCheatUrl(), true);
                    request.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
                    request.onreadystatechange = () => {
                        if (request.readyState !== 4) return;
                        if (request.status === 200) {
                            resolve({
                                status: request.status,
                                data: request.responseText,
                            });
                        } else {
                            reject(new Error(`Cheat HTTP ${request.status}`));
                        }
                    };
                    request.ontimeout = () => reject(new Error('Cheat request timeout'));
                    request.onerror = () => reject(new Error('Cheat request network error'));
                    request.send(this._encodeQueryData(data));
                });
            }

            _emitProgress(type, detail = {}) {
                window.dispatchEvent(new CustomEvent('onCheatProgress', {
                    detail: { type, ...detail },
                }));
            }

            getCheatConfig() {
                const userId = this.isBaseV2 ? this.gameState.networkBridge.getUserId() : this.gameState._playerInfoStateManager.getUserId();
                const gameId = this.isBaseV2 ? this.director.gameConfig.GAME_ID : this.director.node.config.GAME_ID;
                const currency = this.isBaseV2 ? this.director.gameLogic.getMoneyFormatter().currency : this.director.currencyCode;
                const event = new CustomEvent('onGameConfigResponse', {
                    detail: { userId, gameId, currency }
                });
                window.dispatchEvent(event);
            }

            initCheatSpeed() {
                if (this.gameVersion == "3") {
                    const originalTick = this.cc.director.tick || this.cc.Director.prototype.tick;
                    this.multiplier = 1.0;
                    this.cc.director.tick = (dt, ...args) => {
                        originalTick.call(this.cc.director, dt * this.multiplier, ...args);
                    };
                } else {
                    this.scheduler = this.cc.director.getScheduler();
                }
            }

            setCheatSpeed(mul) {
                if (this.gameVersion == "3") {
                    this.multiplier = mul;
                } else {
                    this.scheduler.setTimeScale(mul);
                }
            }

            resetSpeed() {
                if (this.gameVersion == 3) {
                    this.multiplier = 1.0;
                } else {
                    this.scheduler.setTimeScale(1.0);
                }
            }

            checkOverwriteStatus() {
                return {
                    isOverwritten: this.isOverwritten,
                    directorOverwrite: this.director?.isOverWriteCheat || false,
                    hasOriginalFunction: !!this.gameState?.orgClientSendRequest,
                    gameStateValid: !!this.gameState
                };
            }

            resetOverwrite() {
                try {
                    if (this.gameState?.orgClientSendRequest) {
                        this.gameState._clientSendRequest = this.gameState.orgClientSendRequest;
                        delete this.gameState.orgClientSendRequest;
                    }
                    this.director.isOverWriteCheat = false;
                    this.isOverwritten = false;
                    console.log("CHEAT_TOOL: Overwrite reset successfully");
                    return true;
                } catch (error) {
                    console.error("CHEAT_TOOL: Error resetting overwrite:", error);
                    return false;
                }
            }

            forceOverwrite() {
                this.isOverwritten = false;
                this.director.isOverWriteCheat = false;
                return this.overWriteFunction();
            }
        };

        async function getDirectorCheatAsync(retryInterval = 100, maxRetries = 1000) {
            if (window._isOverWriteCheatGame && window.cheatScript) {
                console.log("CHEAT_TOOL: Cheat script already exists, checking overwrite status...");
                if (window.cheatScript.isOverwritten) {
                    console.log("CHEAT_TOOL: Functions already overwritten, returning existing script");
                    return window.cheatScript;
                } else {
                    console.log("CHEAT_TOOL: Script exists but not overwritten, attempting overwrite...");
                    const overwriteSuccess = window.cheatScript.overWriteFunction();
                    if (overwriteSuccess) {
                        return window.cheatScript;
                    }
                }
            }

            if (!window._isOverWriteCheatGame) {
                window._isOverWriteCheatGame = true;
                let retries = 0;
                console.log("CHEAT_TOOL: Initializing cheat script...");

                while (retries < maxRetries) {
                    const cc = window.cc;
                    const canvas = cc?.find("Canvas");
                    const director = canvas?.getComponentInChildren("Director") || canvas?.getComponentInChildren("GameDirector");

                    if (cc && director) {
                        console.log("CHEAT_TOOL: Director found, creating EvalCheatScript...");
                        const cheatScript = new window.EvalCheatScript(cc, director);

                        if (cheatScript && cheatScript.gameState) {
                            console.log("CHEAT_TOOL: Cheat script initialized successfully");
                            return cheatScript;
                        } else {
                            console.warn("CHEAT_TOOL: Cheat script created but gameState not found");
                        }
                    }

                    await new Promise(resolve => setTimeout(resolve, retryInterval));
                    retries++;

                    if (retries % 50 === 0) {
                        console.log(`CHEAT_TOOL: Retry attempt: ${retries}/${maxRetries}`);
                        if (!cc) console.log("CHEAT_TOOL: Waiting for Canvas component...");
                        if (!canvas) console.log("CHEAT_TOOL: Waiting for Canvas component...");
                        if (!director) console.log("CHEAT_TOOL: Waiting for Director component...");
                    }
                }

                console.error("CHEAT_TOOL: Failed to get director after max retries.");
                window.dispatchEvent(new CustomEvent('onFailedToGetDirector', {}));
                window._isOverWriteCheatGame = false;
                return null;
            } else {
                console.log("CHEAT_TOOL: Cheat game already in progress");
                return window.cheatScript || null;
            }
        }
        if (!window.cheatScript) {
            getDirectorCheatAsync().then(cheatScript => {
                window.cheatScript = cheatScript;
            });
        }
    }
})();
