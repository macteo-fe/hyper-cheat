import { FormCard } from '../models/FormCard.js';
import { StepTemplateStore } from '../utils/stepTemplate.js';
import { adaptCheatFormHtml } from '../utils/newCheatFormat.js';
import { showToast } from '../utils/toast.js';
import { showConfirmDialog } from '../utils/confirmDialog.js';

const STEPS_CLIPBOARD_TYPE = 'slot-cheat-steps';
const STEPS_CLIPBOARD_VERSION = 1;

export class FormController {
    constructor(data) {
        this.initializeProperties(data);
        this.initializeDOMElements();
        this.addEventListeners();
    }
    initializeProperties(data) {
        const { tabId, database, cheatController } = data;
        this.tabId = tabId;
        this.key = null;
        this.gameId = null;
        this.cheatName = null;
        this.formText = '';
        this.cheatFormat = 'legacy';
        this.scenarios = null;
        this.cheatData = {};
        this.cheatSteps = [];
        this.canAddData = false;
        this.formData = null;
        this._db = database;
        this._cheatController = cheatController;
        this.symbolAssets = {};
        this.selectedIndices = new Set();
        this._selectionAnchor = null;
        this._isRangeSelecting = false;
        this._selectStartIndex = null;
        this._selectFromHeader = false;
        this._suppressCardClick = false;
        this._copiedSteps = [];
        this._pendingSelectedIndices = null;
        this._saveChain = Promise.resolve();
    }
    initializeDOMElements() {
        this.titleText = document.getElementById('s_txt_title');
        this.stepsList = document.getElementById('s_lst_steps');
        this.backButton = document.getElementById('s_btn_back');
        this.addStepButton = document.getElementById('s_btn_add');
        this.clearTemplateButton = document.getElementById('s_btn_clearTemplate');
        this.runCheatButton = document.getElementById('s_btn_run');
        this.stepsView = document.getElementById('s_view_container');
        this.symbolPalettes = [
            this._createSymbolPaletteRefs('s'),
            this._createSymbolPaletteRefs('m'),
        ].filter((palette) => palette.root && palette.list && palette.count && palette.toggle);
        this.stepsList.innerHTML = "";
    }
    _createSymbolPaletteRefs(prefix) {
        return {
            root: document.getElementById(`${prefix}_view_symbolPalette`),
            list: document.getElementById(`${prefix}_lst_symbols`),
            count: document.getElementById(`${prefix}_txt_symbolCount`),
            toggle: document.getElementById(`${prefix}_btn_toggleSymbols`),
        };
    }
    addEventListeners() {
        this.backButton.addEventListener('click', this.handleCloseButton);
        this.addStepButton.addEventListener('click', this.handleAddStepButton);
        this.clearTemplateButton.addEventListener('click', this.handleClearTemplateButton);
        this.runCheatButton.addEventListener('click', this.handlePlayCheat);
        this.symbolPalettes.forEach((palette) => {
            palette.toggle.addEventListener('click', () => this.handleToggleSymbols(palette));
        });

        document.addEventListener('card:duplicate', this.handleCardDuplicate.bind(this));
        document.addEventListener('card:setTemplate', this.handleCardSetTemplate.bind(this));
        document.addEventListener('card:moveUp', this.handleCardMoveToTop.bind(this));
        document.addEventListener('card:moveDown', this.handleCardMoveToBottom.bind(this));
        document.addEventListener('card:delete', this.handleCardDelete.bind(this));
        document.addEventListener('card:submit', this.handleCardSubmit.bind(this));

        this.stepsList.addEventListener('dragstart', this.handleDragStart.bind(this));
        this.stepsList.addEventListener('dragover', this.handleDragOver.bind(this));
        this.stepsList.addEventListener('drop', this.handleDrop.bind(this));
        this.stepsList.addEventListener('dragend', this.handleDragEnd.bind(this));

        this.stepsList.addEventListener('mousedown', this.handleSelectionMouseDown);
        document.addEventListener('mousemove', this.handleSelectionMouseMove);
        document.addEventListener('mouseup', this.handleSelectionMouseUp);
        this.stepsList.addEventListener('click', this.handleSelectionClick, true);
        document.addEventListener('keydown', this.handleKeyDown);
    }
    setSymbolAssets(symbols = {}) {
        this.symbolAssets = symbols || {};
        this.renderSymbolPalette();
        Array.from(this.stepsList.children).forEach((cardElement) => {
            if (cardElement.formCard) {
                cardElement.formCard.setSymbolAssets(this.symbolAssets);
            }
        });
    }
    renderSymbolPalette() {
        const codes = Object.keys(this.symbolAssets || {}).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        const chipsHtml = codes.length
            ? codes.map((code) => `
            <div class="symbol-chip" title="${code}">
                <img src="${this.symbolAssets[code]}" alt="${code}" />
                <span>${code}</span>
            </div>
        `).join('')
            : '';

        this.symbolPalettes.forEach((palette) => {
            palette.count.textContent = String(codes.length);
            if (!codes.length) {
                palette.root.classList.add('hidden');
                palette.list.innerHTML = '';
                return;
            }
            palette.root.classList.remove('hidden');
            palette.list.innerHTML = chipsHtml;
        });
    }
    handleToggleSymbols = (palette) => {
        const target = palette || this.symbolPalettes[0];
        if (!target) return;
        const collapsed = target.root.classList.toggle('is-collapsed');
        target.toggle.setAttribute('aria-expanded', String(!collapsed));
        target.toggle.title = collapsed ? 'Expand symbols' : 'Collapse symbols';
    }
    loadForm(formData) {
        const { key, gameId, cheatName } = formData;
        this.key = Number(key);
        this.gameId = gameId;
        this.cheatName = cheatName;
        this.formText = '';
        this.cheatFormat = 'legacy';
        this.scenarios = null;
        this.cheatData = {};
        this.cheatSteps = [];
        this.canAddData = false;
        this.formData = formData;
        this.stepsList.innerHTML = "";
        this.clearSelection();
        this.addStepButton.style.display = 'none';
        this.clearTemplateButton.style.display = 'none';
        this.runCheatButton.style.display = 'none';
        this.loadCheatScenario(this.gameId).then(({ formHtml, format, scenarios }) => {
            this.formText = formHtml;
            this.cheatFormat = format;
            this.scenarios = scenarios;
            this.titleText.innerHTML = this.cheatName;
            this.addStepButton.style.display = 'inline-block';
            this.clearTemplateButton.style.display = 'inline-block';
            this.runCheatButton.style.display = 'inline-block';
            this.renderTableSteps();
        }).catch(err => {
            this.titleText.innerHTML = "Error loading cheat scenario";
            console.error(err);
        });
    }
    clearForm() {
        this.key = null;
        this.gameId = null;
        this.cheatName = null;
        this.formText = '';
        this.cheatFormat = 'legacy';
        this.scenarios = null;
        this.cheatData = {};
        this.cheatSteps = [];
        this.canAddData = false;
        this.formData = null;
        this.stepsList.innerHTML = "";
        this.clearSelection();
        this.addStepButton.style.display = 'none';
        this.clearTemplateButton.style.display = 'none';
        this.runCheatButton.style.display = 'none';
        this.renderSymbolPalette();
    }
    handleCloseButton = () => {
        document.getElementById('m_view_container').style.display = 'block';
        document.getElementById('s_view_container').style.display = 'none';
        document.getElementById('e_view_container').style.display = 'none';
    }
    handlePlayCheat = () => {
        document.getElementById('m_view_container').style.display = 'none';
        document.getElementById('s_view_container').style.display = 'none';
        document.getElementById('e_view_container').style.display = 'block';
        this._cheatController.showCheat(this.formData);
    }
    handleAddStepButton = () => {
        this.addNewStep();
    }
    handleClearTemplateButton = () => {
        this.clearStepTemplate();
    }
    addNewStep() {
        if (!this.formText || !this.canAddData) return;
        const templateData = this._cloneStepTemplate();
        this.cheatSteps.push(templateData);
        this.updateSteps();
    }
    _cloneStepTemplate() {
        return StepTemplateStore.clone(this.gameId);
    }
    clearStepTemplate() {
        if (!this.gameId) return;
        const cleared = StepTemplateStore.clear(this.gameId);
        this.refreshTemplateIndicators();
        if (cleared) {
            showToast('Step template cleared for this game');
        } else {
            showToast('No step template set for this game');
        }
    }
    handleCardSetTemplate(event) {
        const { index, data } = event.detail;
        const stepIndex = index - 1;
        if (stepIndex < 0 || stepIndex >= this.cheatSteps.length) return;
        if (data) {
            this.cheatSteps[stepIndex] = { ...data, index };
        }
        this.setStepTemplate(stepIndex, data || this.cheatSteps[stepIndex]);
    }
    setStepTemplate(stepIndex, stepData) {
        let cloned;
        try {
            cloned = JSON.parse(JSON.stringify(stepData || {}));
        } catch {
            cloned = { ...(stepData || {}) };
        }
        delete cloned.index;
        StepTemplateStore.save(this.gameId, cloned);
        this.cheatSteps[stepIndex] = { ...stepData, index: stepIndex + 1 };
        this.cheatData.cheatSteps = this.cheatSteps;
        this._db.updateData(this.cheatData).then(() => {
            showToast('Step template created successfully');
            this.refreshTemplateIndicators();
        });
    }
    refreshTemplateIndicators() {
        Array.from(this.stepsList.children).forEach((cardElement) => {
            const card = cardElement.formCard;
            if (!card) return;
            card.setTemplateActive(StepTemplateStore.matches(this.gameId, card.data));
        });
    }
    handleCardDuplicate(event) {
        const { index, data } = event.detail;
        const stepIndex = index - 1;
        if (stepIndex < 0 || stepIndex >= this.cheatSteps.length) return;
        if (data) {
            this.cheatSteps[stepIndex] = { ...data, index };
        }
        this.duplicateStep(stepIndex, data || this.cheatSteps[stepIndex]);
    }
    handleCardMoveToTop(event) {
        const { index } = event.detail;
        this.moveStepToTop(index - 1);
    }
    handleCardMoveToBottom(event) {
        const { index } = event.detail;
        this.moveStepToBottom(index - 1);
    }
    handleCardDelete(event) {
        const { index } = event.detail;
        this.deleteStep(index - 1);
    }
    handleCardSubmit(event) {
        const { data, index } = event.detail;
        if (!index || !this.cheatSteps[index - 1]) return;
        this.cheatSteps[index - 1] = data;
        this.cheatData.cheatSteps = this.cheatSteps;
        // Persist only — avoid re-render so typing focus stays on the step form
        this._db.updateData(this.cheatData);
    }
    duplicateStep(stepIndex, stepData) {
        let cloned;
        try {
            cloned = JSON.parse(JSON.stringify(stepData || {}));
        } catch {
            cloned = { ...(stepData || {}) };
        }
        delete cloned.index;
        this.cheatSteps.splice(stepIndex + 1, 0, cloned);
        this.updateSteps();
    }
    moveStepToTop(stepIndex) {
        if (stepIndex <= 0) return;
        const step = this.cheatSteps.splice(stepIndex, 1)[0];
        this.cheatSteps.unshift(step);
        this.updateSteps();
    }
    moveStepToBottom(stepIndex) {
        if (stepIndex >= this.cheatSteps.length - 1) return;
        const step = this.cheatSteps.splice(stepIndex, 1)[0];
        this.cheatSteps.push(step);
        this.updateSteps();
    }
    deleteStep(stepIndex) {
        this.cheatSteps.splice(stepIndex, 1);
        this.updateSteps();
    }
    async confirmDeleteSelectedSteps() {
        const indices = this.getSortedSelectedIndices();
        if (!indices.length) return;

        const count = indices.length;
        const confirmed = await showConfirmDialog({
            title: 'Delete steps',
            message: count === 1
                ? 'Delete the selected step?'
                : `Delete ${count} selected steps?`,
            confirmLabel: 'Confirm',
            cancelLabel: 'Cancel',
            danger: true,
        });
        if (!confirmed) return;

        for (let i = indices.length - 1; i >= 0; i--) {
            this.cheatSteps.splice(indices[i], 1);
        }
        this.clearSelection();
        this.updateSteps();
    }
    updateSteps() {
        this.cheatSteps.forEach((step, idx) => {
            step.index = idx + 1;
        });
        this.cheatData.cheatSteps = this.cheatSteps;
        // Render from memory immediately so rapid Add Step clicks can't race on setTimeout/DB reload
        this.canAddData = true;
        this.updateExistingSteps(this.cheatSteps);
        this.refreshTemplateIndicators();
        this.applySelectionStyles();
        this._persistSteps();
    }
    _persistSteps() {
        this._saveChain = this._saveChain
            .catch(() => {})
            .then(() => {
                this.cheatData.cheatSteps = this.cheatSteps;
                return this._db.updateData(this.cheatData);
            })
            .catch((err) => {
                console.error('Failed to persist steps', err);
            });
        return this._saveChain;
    }
    renderTableSteps() {
        this._db.getDataByKey(this.key).then(data => {
            const { cheatSteps } = data;
            this.cheatData = data;
            this.cheatSteps = cheatSteps ? cheatSteps : [];
            this.canAddData = true;
            this.updateExistingSteps(this.cheatSteps);
            this.refreshTemplateIndicators();
            this.applySelectionStyles();
        });
    }
    updateExistingSteps(dataSteps) {
        const existingCards = Array.from(this.stepsList.children);

        dataSteps.forEach((dataStep, index) => {
            const existingCard = existingCards[index];
            const isTemplateStep = StepTemplateStore.matches(this.gameId, dataStep);
            if (existingCard) {
                const card = existingCard.formCard;
                card.setSymbolAssets(this.symbolAssets);
                card.renderCard({
                    dataStep,
                    formText: this.formText,
                    isTemplateStep,
                    cheatFormat: this.cheatFormat,
                    scenarios: this.scenarios,
                });
                this.setupDragAndDrop(existingCard, dataStep.index);
            } else {
                const card = new FormCard(this.gameId);
                card.setSymbolAssets(this.symbolAssets);
                card.renderCard({
                    dataStep,
                    formText: this.formText,
                    isTemplateStep,
                    cheatFormat: this.cheatFormat,
                    scenarios: this.scenarios,
                });
                this.stepsList.appendChild(card.elements.card);
                card.elements.card.formCard = card;
                this.setupDragAndDrop(card.elements.card, dataStep.index);
            }
        });
        
        while (this.stepsList.children.length > dataSteps.length) {
            this.stepsList.removeChild(this.stepsList.lastChild);
        }

        if (this._pendingSelectedIndices) {
            this.selectedIndices = new Set(
                this._pendingSelectedIndices.filter((idx) => idx >= 0 && idx < dataSteps.length)
            );
            this._pendingSelectedIndices = null;
            const selected = this.getSortedSelectedIndices();
            this._selectionAnchor = selected.length ? selected[selected.length - 1] : null;
        } else {
            this.selectedIndices = new Set(
                [...this.selectedIndices].filter((idx) => idx >= 0 && idx < dataSteps.length)
            );
        }
        this.applySelectionStyles();
    }
    setupDragAndDrop(cardElement, index) {
        const cardHeader = cardElement.querySelector('.card-header');
        if (cardHeader) {
            cardHeader.setAttribute('draggable', 'true');
            cardElement.dataset.index = index;
        }
        cardElement.classList.add('form-card');
    }

    // --- Step selection ---
    _isFormFieldTarget(target) {
        if (!target || !target.closest) return false;
        return !!target.closest('input, textarea, select, option, [contenteditable="true"]');
    }
    _isInteractiveControl(target) {
        if (!target || !target.closest) return false;
        return !!target.closest('.card-actions, button, input, textarea, select, option, [contenteditable="true"]');
    }
    _isStepsViewActive() {
        return this.stepsView && this.stepsView.style.display !== 'none';
    }
    _cardIndexFromElement(cardElement) {
        if (!cardElement) return -1;
        const fromDataset = Number(cardElement.dataset.index);
        if (Number.isFinite(fromDataset) && fromDataset > 0) return fromDataset - 1;
        return Array.from(this.stepsList.children).indexOf(cardElement);
    }
    getSortedSelectedIndices() {
        return [...this.selectedIndices].sort((a, b) => a - b);
    }
    clearSelection() {
        this.selectedIndices.clear();
        this._selectionAnchor = null;
        this.applySelectionStyles();
    }
    applySelectionStyles() {
        Array.from(this.stepsList.children).forEach((cardElement, index) => {
            cardElement.classList.toggle('is-selected', this.selectedIndices.has(index));
        });
    }
    selectSingle(index, { additive = false, toggle = false } = {}) {
        if (index < 0 || index >= this.cheatSteps.length) return;
        if (toggle) {
            if (this.selectedIndices.has(index)) this.selectedIndices.delete(index);
            else this.selectedIndices.add(index);
        } else if (additive) {
            this.selectedIndices.add(index);
        } else {
            this.selectedIndices.clear();
            this.selectedIndices.add(index);
        }
        this._selectionAnchor = index;
        this.applySelectionStyles();
    }
    selectRange(fromIndex, toIndex, { additive = false } = {}) {
        if (fromIndex < 0 || toIndex < 0) return;
        const start = Math.min(fromIndex, toIndex);
        const end = Math.max(fromIndex, toIndex);
        if (!additive) this.selectedIndices.clear();
        for (let i = start; i <= end; i++) {
            if (i >= 0 && i < this.cheatSteps.length) this.selectedIndices.add(i);
        }
        this.applySelectionStyles();
    }
    _setHeadersDraggable(enabled) {
        this.stepsList.querySelectorAll('.card-header').forEach((header) => {
            header.setAttribute('draggable', enabled ? 'true' : 'false');
        });
    }
    handleSelectionMouseDown = (event) => {
        if (event.button !== 0) return;
        if (this._isInteractiveControl(event.target)) return;

        const card = event.target.closest('.form-card');
        if (!card || !this.stepsList.contains(card)) {
            if (event.target === this.stepsList) this.clearSelection();
            return;
        }

        const index = this._cardIndexFromElement(card);
        if (index < 0) return;

        this._isRangeSelecting = true;
        this._selectStartIndex = index;
        this._selectFromHeader = !!event.target.closest('.card-header');
        this._suppressCardClick = false;

        // Press-drag on summary/body selects; header stays draggable for reorder
        if (!this._selectFromHeader) {
            this._setHeadersDraggable(false);
        }

        const additive = event.ctrlKey || event.metaKey;
        const range = event.shiftKey;

        if (range && this._selectionAnchor != null) {
            this.selectRange(this._selectionAnchor, index, { additive });
            this._suppressCardClick = true;
        } else if (additive || this.selectedIndices.has(index)) {
            this.selectSingle(index, { toggle: true });
            this._suppressCardClick = true;
        } else {
            this.selectSingle(index);
        }
    }
    handleSelectionMouseMove = (event) => {
        if (!this._isRangeSelecting || this._selectStartIndex == null) return;
        if ((event.buttons & 1) === 0) {
            this.handleSelectionMouseUp();
            return;
        }

        const el = document.elementFromPoint(event.clientX, event.clientY);
        const card = el?.closest?.('.form-card');
        if (!card || !this.stepsList.contains(card)) return;

        const index = this._cardIndexFromElement(card);
        if (index < 0) return;

        if (index !== this._selectStartIndex) {
            // Crossing cards: switch to range-select (cancel reorder drag)
            if (this._selectFromHeader) {
                this._setHeadersDraggable(false);
                this._selectFromHeader = false;
            }
            this._suppressCardClick = true;
        }

        this.selectRange(this._selectStartIndex, index);
        this._selectionAnchor = this._selectStartIndex;
    }
    handleSelectionMouseUp = () => {
        this._isRangeSelecting = false;
        this._selectStartIndex = null;
        this._selectFromHeader = false;
        this._setHeadersDraggable(true);
    }
    handleSelectionClick = (event) => {
        if (!this._suppressCardClick) return;
        if (!event.target.closest('.form-card')) return;
        event.preventDefault();
        event.stopPropagation();
        this._suppressCardClick = false;
    }

    // --- Copy / paste / delete ---
    handleKeyDown = (event) => {
        if (!this._isStepsViewActive() || !this.canAddData) return;
        // Let the browser handle text clipboard while typing in a field
        if (this._isFormFieldTarget(event.target)) return;
        // Confirm dialog handles Enter / Escape itself
        if (document.getElementById('app_confirm_dialog')) return;

        const meta = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();

        if (!meta && (event.key === 'Delete' || event.key === 'Backspace')) {
            if (!this.selectedIndices.size) return;
            event.preventDefault();
            this.confirmDeleteSelectedSteps();
            return;
        }

        if (!meta) return;

        if (key === 'c') {
            if (!this.selectedIndices.size) return;
            event.preventDefault();
            this.copySelectedSteps();
        } else if (key === 'v') {
            event.preventDefault();
            this.pasteSteps();
        } else if (key === 'a') {
            if (!this.cheatSteps.length) return;
            event.preventDefault();
            this.selectedIndices = new Set(this.cheatSteps.map((_, i) => i));
            this._selectionAnchor = this.cheatSteps.length - 1;
            this.applySelectionStyles();
        }
    }
    _cloneStepPayload(stepData) {
        let cloned;
        try {
            cloned = JSON.parse(JSON.stringify(stepData || {}));
        } catch {
            cloned = { ...(stepData || {}) };
        }
        delete cloned.index;
        return cloned;
    }
    _syncSelectedStepsFromDom() {
        Array.from(this.stepsList.children).forEach((cardElement, index) => {
            if (!this.selectedIndices.has(index)) return;
            const card = cardElement.formCard;
            if (!card?.isRender) return;
            const data = card._syncDataFromForm();
            this.cheatSteps[index] = { ...data, index: index + 1 };
        });
        this.cheatData.cheatSteps = this.cheatSteps;
    }
    async copySelectedSteps() {
        const indices = this.getSortedSelectedIndices();
        if (!indices.length) return;

        this._syncSelectedStepsFromDom();
        const steps = indices.map((idx) => this._cloneStepPayload(this.cheatSteps[idx]));
        this._copiedSteps = steps;

        const payload = {
            type: STEPS_CLIPBOARD_TYPE,
            version: STEPS_CLIPBOARD_VERSION,
            steps,
        };
        const text = JSON.stringify(payload);
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            // In-memory copy still works within the extension
        }
    }
    async _readClipboardSteps() {
        if (this._copiedSteps?.length) {
            return this._copiedSteps.map((step) => this._cloneStepPayload(step));
        }
        try {
            const text = await navigator.clipboard.readText();
            if (!text) return [];
            const parsed = JSON.parse(text);
            if (parsed?.type !== STEPS_CLIPBOARD_TYPE || !Array.isArray(parsed.steps)) return [];
            return parsed.steps.map((step) => this._cloneStepPayload(step));
        } catch {
            return [];
        }
    }
    async pasteSteps() {
        if (!this.formText || !this.canAddData) return;
        const steps = await this._readClipboardSteps();
        if (!steps.length) {
            showToast('No steps to paste', 'error');
            return;
        }

        const selected = this.getSortedSelectedIndices();
        const insertAt = selected.length ? selected[selected.length - 1] + 1 : this.cheatSteps.length;
        const clones = steps.map((step) => this._cloneStepPayload(step));
        this.cheatSteps.splice(insertAt, 0, ...clones);

        this._pendingSelectedIndices = clones.map((_, i) => insertAt + i);
        this.updateSteps();
    }
    async loadCheatScenario(gameId) {
        const stagingUrl = `https://cheat.staging.enostd.gay/`;
        const devUrl = `https://cheat.dev.enostd.gay/`;
        const isStagingMode = document.getElementById('m_chk_env').checked;
        const apiUrl = isStagingMode ? stagingUrl : devUrl;
        const inputUrl = `${apiUrl}${gameId}/inputdata`;
        const response = await fetch(inputUrl);
        if (response.ok) {
            const rawHtml = await response.text();
            return adaptCheatFormHtml(rawHtml, gameId);
        } else {
            throw new Error('Failed to load cheat scenario');
        }
    }
    handleDragStart(e) {
        // Multi-select drag takes priority once the pointer crosses steps
        if (this._isRangeSelecting && this._suppressCardClick && !this._selectFromHeader) {
            e.preventDefault();
            return;
        }

        const cardHeader = e.target.closest('.card-header');
        if (!cardHeader) return;

        const card = cardHeader.closest('.form-card');
        if (!card) return;

        this._isRangeSelecting = false;
        this._selectStartIndex = null;
        this._selectFromHeader = false;

        // Hide all card bodies before starting drag
        const allCards = this.stepsList.querySelectorAll('.form-card');
        allCards.forEach(cardElement => {
            if (cardElement.formCard?.setCollapsed) {
                cardElement.formCard.setCollapsed(true);
            } else {
                const cardBody = cardElement.querySelector('.card-body');
                if (cardBody) cardBody.style.display = 'none';
            }
        });

        e.dataTransfer.setData('text/plain', card.dataset.index);
        card.classList.add('dragging');
        this.stepsList.classList.add('dragging-active');
    }
    handleDragOver(e) {
        e.preventDefault();
        const card = e.target.closest('.form-card');
        if (!card) return;
        
        const draggingCard = this.stepsList.querySelector('.dragging');
        if (!draggingCard || draggingCard === card) return;
        
        const rect = card.getBoundingClientRect();
        const threshold = rect.top + rect.height / 2;
        
        if (e.clientY < threshold) {
            card.parentNode.insertBefore(draggingCard, card);
        } else {
            card.parentNode.insertBefore(draggingCard, card.nextSibling);
        }
    }
    handleDrop(e) {
        e.preventDefault();
        const draggingCard = this.stepsList.querySelector('.dragging');
        if (draggingCard) {
            draggingCard.classList.remove('dragging');
            this.stepsList.classList.remove('dragging-active');
            
            const newSteps = Array.from(this.stepsList.children).map((card, idx) => {
                const step = this.cheatSteps[parseInt(card.dataset.index) - 1];
                return { ...step, index: idx + 1 };
            });
            
            this.cheatSteps = newSteps;
            this.updateSteps();
        }
    }
    handleDragEnd = (e) => {
        this.stepsList.classList.remove('dragging-active');
        const draggingCard = this.stepsList.querySelector('.dragging');
        if (draggingCard) {
            draggingCard.classList.remove('dragging');
        }
    }
}