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

                    console.log(`CHEAT_TOOL: exported ${Object.keys(symbols).length}/${readyCodes.length} symbol frames`);
                    return {
                        ok: Object.keys(symbols).length > 0,
                        count: Object.keys(symbols).length,
                        total: readyCodes.length,
                        missing: readyCodes.filter((code) => !symbols[code]),
                    };
                } catch (error) {
                    console.error('CHEAT_TOOL: exportSymbolAssets failed', error);
                    return { ok: false, count: 0, reason: String(error) };
                }
            }

            spriteFrameToDataURL(spriteFrame) {
                if (!spriteFrame) return null;
                try {
                    const bitmapSource = this._resolveBitmapSource(spriteFrame);
                    if (!bitmapSource) return null;

                    const { bitmap, texture } = bitmapSource;
                    let drawInfo = this._resolveSpriteFrameDraw(spriteFrame, texture);
                    if (!drawInfo) return null;

                    const { scaleX, scaleY } = this._getSourceScale(bitmap, texture);
                    let { sx, sy, sw, sh, rotated } = drawInfo;
                    let fsx = sx * scaleX;
                    let fsy = sy * scaleY;
                    let fsw = Math.max(1, sw * scaleX);
                    let fsh = Math.max(1, sh * scaleY);

                    if (!this._isCropValid(bitmap, fsx, fsy, fsw, fsh)) {
                        const fallback = this._resolveRectFallback(spriteFrame, texture);
                        if (fallback) {
                            ({ sx, sy, sw, sh, rotated } = fallback);
                            fsx = sx * scaleX;
                            fsy = sy * scaleY;
                            fsw = Math.max(1, sw * scaleX);
                            fsh = Math.max(1, sh * scaleY);
                        }
                    }

                    if (!this._isCropValid(bitmap, fsx, fsy, fsw, fsh)) {
                        fsx = 0;
                        fsy = 0;
                        fsw = Math.max(1, bitmap.naturalWidth || bitmap.width || 1);
                        fsh = Math.max(1, bitmap.naturalHeight || bitmap.height || 1);
                        rotated = false;
                    }

                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return null;

                    if (rotated) {
                        canvas.width = Math.max(1, Math.round(fsh));
                        canvas.height = Math.max(1, Math.round(fsw));
                        ctx.translate(0, fsw);
                        ctx.rotate(-Math.PI / 2);
                        ctx.drawImage(bitmap, fsx, fsy, fsw, fsh, 0, 0, fsw, fsh);
                    } else {
                        canvas.width = Math.max(1, Math.round(fsw));
                        canvas.height = Math.max(1, Math.round(fsh));
                        ctx.drawImage(bitmap, fsx, fsy, fsw, fsh, 0, 0, fsw, fsh);
                    }
                    return canvas.toDataURL('image/png');
                } catch (error) {
                    console.warn('CHEAT_TOOL: spriteFrameToDataURL failed', error);
                    return null;
                }
            }

            _resolveBitmapSource(spriteFrame) {
                const original = spriteFrame.original || spriteFrame._original;
                const texture = original?._texture || spriteFrame.texture || spriteFrame._texture;
                if (!texture) return null;
                const bitmap = this._ensureBitmapSource(this._getTextureDrawSource(texture), texture);
                if (!bitmap) return null;
                return { bitmap, texture };
            }

            _resolveSpriteFrameDraw(spriteFrame, texture) {
                if (!texture) return null;

                const texW = texture.width || texture._width || 1;
                const texH = texture.height || texture._height || 1;
                const frameRect = spriteFrame.rect || spriteFrame._rect;
                const original = spriteFrame.original || spriteFrame._original;
                const standalone = this._isStandaloneSpriteFrame(spriteFrame, texture, frameRect);

                if (original?._texture) {
                    const width = Math.max(1, original._width ?? frameRect?.width ?? 64);
                    const height = Math.max(1, original._height ?? frameRect?.height ?? 64);
                    return {
                        sx: original._x ?? 0,
                        sy: original._y ?? 0,
                        sw: width,
                        sh: height,
                        rotated: false,
                    };
                }

                // Per-texture sprite frames: _rect is a top-left trim rect on the owned texture.
                if (standalone) {
                    return this._cropFromRect(frameRect, spriteFrame, texW, texH);
                }

                const uv = this._getSpriteFrameUv(spriteFrame);
                if (uv) {
                    return this._cropFromUv(uv, texW, texH, frameRect, null);
                }

                if (frameRect) {
                    return this._cropFromRect(frameRect, spriteFrame, texW, texH);
                }

                return { sx: 0, sy: 0, sw: texW, sh: texH, rotated: false };
            }

            _resolveRectFallback(spriteFrame, texture) {
                const frameRect = spriteFrame.rect || spriteFrame._rect;
                if (!frameRect) return null;
                const texW = texture.width || texture._width || 1;
                const texH = texture.height || texture._height || 1;
                return this._cropFromRect(frameRect, spriteFrame, texW, texH);
            }

            _isStandaloneSpriteFrame(spriteFrame, texture, frameRect) {
                if (spriteFrame.original || spriteFrame._original) return false;

                const atlasUuid = spriteFrame.atlasUuid || spriteFrame._atlasUuid;
                if (atlasUuid) return false;

                const texW = texture.width || texture._width || 0;
                const texH = texture.height || texture._height || 0;
                if (!texW || !texH) return true;

                const originalSize = spriteFrame.originalSize || spriteFrame._originalSize;
                const osW = originalSize?.width ?? 0;
                const osH = originalSize?.height ?? 0;
                if (osW > 0 && osH > 0 && Math.abs(texW - osW) <= 4 && Math.abs(texH - osH) <= 4) {
                    return true;
                }

                if (!frameRect) return texW <= 1024 && texH <= 1024;

                const fitsInTexture = frameRect.x >= 0 && frameRect.y >= 0
                    && frameRect.x + frameRect.width <= texW + 2
                    && frameRect.y + frameRect.height <= texH + 2;
                const rectArea = Math.max(1, frameRect.width * frameRect.height);
                const texArea = texW * texH;
                const isLargeAtlas = texW > 512 && texH > 512 && rectArea < texArea * 0.25;

                if (isLargeAtlas) return false;
                if (fitsInTexture && texW <= 1024 && texH <= 1024) return true;

                return false;
            }

            _cropFromRect(frameRect, spriteFrame, texW, texH) {
                const rotated = !!(spriteFrame.rotated ?? spriteFrame._rotated
                    ?? (typeof spriteFrame.isRotated === 'function' ? spriteFrame.isRotated() : false));

                if (!frameRect) {
                    return { sx: 0, sy: 0, sw: texW, sh: texH, rotated: false };
                }

                const sx = Math.max(0, frameRect.x || 0);
                const sy = Math.max(0, frameRect.y || 0);
                const width = Math.max(1, frameRect.width || texW);
                const height = Math.max(1, frameRect.height || texH);

                if (rotated) {
                    return { sx, sy, sw: height, sh: width, rotated: true };
                }
                return { sx, sy, sw: width, sh: height, rotated: false };
            }

            _getSpriteFrameUv(spriteFrame) {
                const uv = spriteFrame.uv || spriteFrame._uv || spriteFrame.unbiasUV;
                if (!uv || uv.length < 8) return null;
                return Array.from(uv).slice(0, 8);
            }

            _normalizeSpriteUv(uv, texW, texH) {
                if (uv.some((val) => val > 1.5)) {
                    return [
                        uv[0] / texW, uv[1] / texH,
                        uv[2] / texW, uv[3] / texH,
                        uv[4] / texW, uv[5] / texH,
                        uv[6] / texW, uv[7] / texH,
                    ];
                }
                return uv;
            }

            _isUvRotated(uv) {
                const EPS = 1e-4;
                const shareU = Math.abs(uv[0] - uv[2]) < EPS
                    && Math.abs(uv[4] - uv[6]) < EPS
                    && Math.abs(uv[0] - uv[4]) > EPS;
                const shareV = Math.abs(uv[1] - uv[3]) < EPS
                    && Math.abs(uv[5] - uv[7]) < EPS
                    && Math.abs(uv[1] - uv[5]) > EPS;
                if (shareU && !shareV) return true;
                if (shareV && !shareU) return false;
                return false;
            }

            _resolveSyFromUv(vMin, vMax, texH, frameRect) {
                const syTopDown = vMin * texH;
                const syBottomUp = (1 - vMax) * texH;
                if (!frameRect || frameRect.y === undefined) return syTopDown;
                const rectY = frameRect.y || 0;
                if (Math.abs(syBottomUp - rectY) < Math.abs(syTopDown - rectY)) {
                    return syBottomUp;
                }
                return syTopDown;
            }

            _cropFromUv(uv, texW, texH, frameRect, forceRotated = null) {
                const normalized = this._normalizeSpriteUv(uv, texW, texH);
                const uCoords = [normalized[0], normalized[2], normalized[4], normalized[6]];
                const vCoords = [normalized[1], normalized[3], normalized[5], normalized[7]];
                const uMin = Math.min(...uCoords);
                const uMax = Math.max(...uCoords);
                const vMin = Math.min(...vCoords);
                const vMax = Math.max(...vCoords);
                const rotated = forceRotated !== null ? forceRotated : this._isUvRotated(normalized);

                const sx = uMin * texW;
                const sy = this._resolveSyFromUv(vMin, vMax, texH, frameRect);
                const sw = Math.max(1, (uMax - uMin) * texW);
                const sh = Math.max(1, (vMax - vMin) * texH);

                return { sx, sy, sw, sh, rotated };
            }

            _isCropValid(bitmap, sx, sy, sw, sh) {
                const maxW = bitmap.naturalWidth || bitmap.width || 0;
                const maxH = bitmap.naturalHeight || bitmap.height || 0;
                if (!maxW || !maxH) return false;
                return sx >= -0.5 && sy >= -0.5 && sx + sw <= maxW + 1 && sy + sh <= maxH + 1;
            }

            _getSourceScale(source, texture) {
                const texW = texture?.width || texture?._width || 1;
                const texH = texture?.height || texture?._height || 1;
                let srcW = texW;
                let srcH = texH;
                if (source instanceof HTMLImageElement) {
                    srcW = source.naturalWidth || source.width || texW;
                    srcH = source.naturalHeight || source.height || texH;
                } else if (source instanceof HTMLCanvasElement
                    || (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap)) {
                    srcW = source.width || texW;
                    srcH = source.height || texH;
                }
                return {
                    scaleX: srcW / texW,
                    scaleY: srcH / texH,
                };
            }

            _ensureBitmapSource(source, texture) {
                if (!source) return null;
                if (source instanceof HTMLImageElement
                    || source instanceof HTMLCanvasElement
                    || (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap)) {
                    return source;
                }
                if (source instanceof Uint8Array || source instanceof Uint8ClampedArray) {
                    const texW = texture?.width || texture?._width || 1;
                    const texH = texture?.height || texture?._height || 1;
                    const tmp = document.createElement('canvas');
                    tmp.width = texW;
                    tmp.height = texH;
                    const tmpCtx = tmp.getContext('2d');
                    if (!tmpCtx) return null;
                    const imageData = tmpCtx.createImageData(texW, texH);
                    imageData.data.set(source.subarray(0, texW * texH * 4));
                    tmpCtx.putImageData(imageData, 0, 0);
                    return tmp;
                }
                return null;
            }

            _getTextureDrawSource(texture) {
                if (!texture) return null;
                const imageAsset = texture.image || texture._image;
                const htmlCandidates = [
                    imageAsset?.htmlElement,
                    imageAsset?._htmlElementObj,
                    texture._htmlElementObj,
                    imageAsset?._nativeAsset,
                    imageAsset?.data,
                    texture._nativeAsset,
                    texture._canvas,
                    imageAsset,
                ];
                for (const candidate of htmlCandidates) {
                    if (!candidate) continue;
                    if (candidate instanceof HTMLImageElement) {
                        if (!candidate.complete || candidate.naturalWidth === 0) continue;
                        return candidate;
                    }
                    if (candidate instanceof HTMLCanvasElement) {
                        return candidate;
                    }
                    if (typeof ImageBitmap !== 'undefined' && candidate instanceof ImageBitmap) {
                        return candidate;
                    }
                }
                // Retry without requiring image.complete — some textures report late.
                for (const candidate of htmlCandidates) {
                    if (candidate instanceof HTMLImageElement) return candidate;
                }
                const bufferCandidates = [
                    imageAsset?.data,
                    imageAsset?._data,
                    texture._nativeAsset,
                ];
                for (const candidate of bufferCandidates) {
                    if (candidate instanceof Uint8Array || candidate instanceof Uint8ClampedArray) {
                        return candidate;
                    }
                }
                return null;
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
