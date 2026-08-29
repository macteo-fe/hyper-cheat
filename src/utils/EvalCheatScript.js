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

            findSymbolResourceManager() {
                const canvas = this.cc?.find?.('Canvas');
                if (!canvas?.getComponentsInChildren) return null;
                const comps = canvas.getComponentsInChildren('SlotSymbolResourceManager') || [];
                if (!comps.length) return null;
                // Prefer a manager whose staticFrameAssets is already filled (post-onLoad).
                const ready = comps.filter((c) => Object.keys(c?.staticFrameAssets || {}).length > 0);
                const pool = ready.length ? ready : comps;
                return pool.reduce((best, current) => {
                    const bestCount = this._getSymbolManagerCount(best);
                    const currentCount = this._getSymbolManagerCount(current);
                    return currentCount > bestCount ? current : best;
                });
            }

            _getSymbolManagerCount(manager) {
                if (!manager) return 0;
                return Object.keys(manager.staticFrameAssets || {}).length
                    || (Array.isArray(manager.symbolSfList) ? manager.symbolSfList.length : 0);
            }

            exportSymbolAssets() {
                try {
                    const manager = this.findSymbolResourceManager();
                    if (!manager) {
                        return { ok: false, count: 0, reason: 'manager-not-found' };
                    }

                    // Only use already-initialized runtime maps / serialized props — never call component methods.
                    const staticMap = manager.staticFrameAssets || {};
                    const list = Array.isArray(manager.symbolSfList) ? manager.symbolSfList : [];
                    const readyCodes = Object.keys(staticMap);
                    if (!readyCodes.length) {
                        return { ok: false, count: 0, reason: 'assets-not-ready' };
                    }

                    const symbols = {};
                    readyCodes.forEach((code) => {
                        const frame = staticMap[code]
                            || list.find((item) => item?.symbolCode === code)?.symbolSf
                            || null;
                        const dataUrl = this.spriteFrameToDataURL(frame);
                        if (dataUrl) symbols[code] = dataUrl;
                    });

                    const gameId = this.isBaseV2
                        ? this.director?.gameConfig?.GAME_ID
                        : this.director?.node?.config?.GAME_ID;

                    window.dispatchEvent(new CustomEvent('onSymbolAssets', {
                        detail: {
                            gameId,
                            symbols,
                            codes: Object.keys(symbols),
                        },
                    }));

                    console.log(`CHEAT_TOOL: exported ${Object.keys(symbols).length} symbol frames`);
                    return { ok: Object.keys(symbols).length > 0, count: Object.keys(symbols).length };
                } catch (error) {
                    console.error('CHEAT_TOOL: exportSymbolAssets failed', error);
                    return { ok: false, count: 0, reason: String(error) };
                }
            }

            spriteFrameToDataURL(spriteFrame) {
                if (!spriteFrame) return null;
                try {
                    const { texture, rect, rotated } = this._resolveSpriteFrameSource(spriteFrame);
                    if (!texture || !rect) return null;

                    const source = this._getTextureDrawSource(texture);
                    if (!source) return null;

                    const width = Math.max(1, Math.floor(rect.width || 64));
                    const height = Math.max(1, Math.floor(rect.height || 64));
                    const sx = Math.max(0, Math.floor(rect.x || 0));
                    const sy = Math.max(0, Math.floor(rect.y || 0));

                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return null;

                    if (source instanceof HTMLImageElement
                        || source instanceof HTMLCanvasElement
                        || (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap)) {
                        if (rotated) {
                            canvas.width = height;
                            canvas.height = width;
                            ctx.translate(0, width);
                            ctx.rotate(-Math.PI / 2);
                            ctx.drawImage(source, sx, sy, height, width, 0, 0, height, width);
                        } else {
                            canvas.width = width;
                            canvas.height = height;
                            ctx.drawImage(source, sx, sy, width, height, 0, 0, width, height);
                        }
                        return canvas.toDataURL('image/png');
                    }

                    if (source instanceof Uint8Array || source instanceof Uint8ClampedArray) {
                        const texWidth = texture.width || texture._width || width;
                        const texHeight = texture.height || texture._height || height;
                        const tmp = document.createElement('canvas');
                        tmp.width = texWidth;
                        tmp.height = texHeight;
                        const tmpCtx = tmp.getContext('2d');
                        const imageData = tmpCtx.createImageData(texWidth, texHeight);
                        imageData.data.set(source.subarray(0, texWidth * texHeight * 4));
                        tmpCtx.putImageData(imageData, 0, 0);
                        canvas.width = width;
                        canvas.height = height;
                        ctx.drawImage(tmp, sx, sy, width, height, 0, 0, width, height);
                        return canvas.toDataURL('image/png');
                    }

                    return null;
                } catch (error) {
                    console.warn('CHEAT_TOOL: spriteFrameToDataURL failed', error);
                    return null;
                }
            }

            // Dynamic-atlas frames keep the drawable Texture2D on `_original`.
            _resolveSpriteFrameSource(spriteFrame) {
                const frameRect = spriteFrame.rect || spriteFrame._rect || null;
                const rotated = !!(spriteFrame.rotated || spriteFrame._rotated || spriteFrame.isRotated);
                const original = spriteFrame.original || spriteFrame._original;

                if (original?._texture) {
                    const width = frameRect?.width
                        || spriteFrame._originalSize?.width
                        || original._texture.width
                        || 64;
                    const height = frameRect?.height
                        || spriteFrame._originalSize?.height
                        || original._texture.height
                        || 64;
                    return {
                        texture: original._texture,
                        rect: {
                            x: original._x ?? 0,
                            y: original._y ?? 0,
                            width,
                            height,
                        },
                        rotated,
                    };
                }

                const texture = spriteFrame.texture || spriteFrame._texture;
                return {
                    texture,
                    rect: frameRect || {
                        x: 0,
                        y: 0,
                        width: spriteFrame.width || texture?.width || 64,
                        height: spriteFrame.height || texture?.height || 64,
                    },
                    rotated,
                };
            }

            _getTextureDrawSource(texture) {
                if (!texture) return null;
                const imageAsset = texture.image || texture._image;
                let source = imageAsset?.data || imageAsset?._nativeAsset || imageAsset?._data || imageAsset;
                if (!source) {
                    source = texture._nativeAsset || texture._canvas || texture._image;
                }
                return source || null;
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
//# sourceURL=EvalCheatScript.js
