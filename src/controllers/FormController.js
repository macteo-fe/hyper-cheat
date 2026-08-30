import { FormCard } from '../models/FormCard.js';

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
        this.cheatData = {};
        this.cheatSteps = [];
        this.canAddData = false;
        this.formData = null;
        this._db = database;
        this._cheatController = cheatController;
        this.symbolAssets = {};
    }
    initializeDOMElements() {
        this.titleText = document.getElementById('s_txt_title');
        this.stepsList = document.getElementById('s_lst_steps');
        this.backButton = document.getElementById('s_btn_back');
        this.addStepButton = document.getElementById('s_btn_add');
        this.runCheatButton = document.getElementById('s_btn_run');
        this.symbolPalette = document.getElementById('s_view_symbolPalette');
        this.symbolList = document.getElementById('s_lst_symbols');
        this.symbolCountText = document.getElementById('s_txt_symbolCount');
        this.stepsList.innerHTML = "";
    }
    addEventListeners() {
        this.backButton.addEventListener('click', this.handleCloseButton);
        this.addStepButton.addEventListener('click', this.handleAddStepButton);
        this.runCheatButton.addEventListener('click', this.handlePlayCheat);
        this.symbolList.addEventListener('click', this.handleSymbolPaletteClick);

        document.addEventListener('card:duplicate', this.handleCardDuplicate.bind(this));
        document.addEventListener('card:moveUp', this.handleCardMoveToTop.bind(this));
        document.addEventListener('card:moveDown', this.handleCardMoveToBottom.bind(this));
        document.addEventListener('card:delete', this.handleCardDelete.bind(this));
        document.addEventListener('card:submit', this.handleCardSubmit.bind(this));

        this.stepsList.addEventListener('dragstart', this.handleDragStart.bind(this));
        this.stepsList.addEventListener('dragover', this.handleDragOver.bind(this));
        this.stepsList.addEventListener('drop', this.handleDrop.bind(this));
        this.stepsList.addEventListener('dragend', this.handleDragEnd.bind(this));
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
        this.symbolCountText.textContent = String(codes.length);
        if (!codes.length) {
            this.symbolPalette.classList.add('hidden');
            this.symbolList.innerHTML = '';
            return;
        }
        this.symbolPalette.classList.remove('hidden');
        this.symbolList.innerHTML = codes.map((code) => `
            <button type="button" class="symbol-chip" data-symbol="${code}" title="Click to copy ${code}">
                <img src="${this.symbolAssets[code]}" alt="${code}" />
                <span>${code}</span>
            </button>
        `).join('');
    }
    handleSymbolPaletteClick = async (event) => {
        const chip = event.target.closest('.symbol-chip');
        if (!chip) return;
        const code = chip.dataset.symbol;
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            chip.classList.add('copied');
            setTimeout(() => chip.classList.remove('copied'), 600);
        } catch (_) {
            // clipboard may be blocked in some DevTools contexts
        }
    }
    loadForm(formData) {
        const { key, gameId, cheatName } = formData;
        this.key = Number(key);
        this.gameId = gameId;
        this.cheatName = cheatName;
        this.formText = '';
        this.cheatData = {};
        this.cheatSteps = [];
        this.canAddData = false;
        this.formData = formData;
        this.stepsList.innerHTML = "";
        this.addStepButton.style.display = 'none';
        this.runCheatButton.style.display = 'none';
        this.loadCheatScenario(this.gameId).then(form => {
            this.formText = form;
            this.titleText.innerHTML = this.cheatName;
            this.addStepButton.style.display = 'inline-block';
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
        this.cheatData = {};
        this.cheatSteps = [];
        this.canAddData = false;
        this.formData = null;
        this.stepsList.innerHTML = "";
        this.addStepButton.style.display = 'none';
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
    addNewStep() {
        if (!this.formText || !this.canAddData) return;
        this.cheatSteps.push({ index: this.cheatSteps.length + 1 });
        this.cheatData.cheatSteps = this.cheatSteps;
        this._db.updateData(this.cheatData).then(() => {
            this.renderTableSteps();
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
    updateSteps() {
        this.cheatSteps.forEach((step, idx) => {
            step.index = idx + 1;
        });
        this.cheatData.cheatSteps = this.cheatSteps;
        this._db.updateData(this.cheatData).then(() => {
            this.renderTableSteps();
        });
    }
    renderTableSteps() {
        this._db.getDataByKey(this.key).then(data => {
            const { cheatSteps } = data;
            this.cheatData = data;
            this.cheatSteps = cheatSteps ? cheatSteps : [];
            this.canAddData = true;
            this.updateExistingSteps(this.cheatSteps);
        });
    }
    updateExistingSteps(dataSteps) {
        const existingCards = Array.from(this.stepsList.children);

        dataSteps.forEach((dataStep, index) => {
            const existingCard = existingCards[index];
            if (existingCard) {
                const card = existingCard.formCard;
                card.setSymbolAssets(this.symbolAssets);
                card.renderCard({ dataStep, formText: this.formText });
                this.setupDragAndDrop(existingCard, dataStep.index);
            } else {
                const card = new FormCard(this.gameId);
                card.setSymbolAssets(this.symbolAssets);
                setTimeout(() => {
                    card.renderCard({ dataStep, formText: this.formText });
                    this.stepsList.appendChild(card.elements.card);
                    card.elements.card.formCard = card;
                    this.setupDragAndDrop(card.elements.card, dataStep.index);
                }, 100);
            }
        });
        
        while (this.stepsList.children.length > dataSteps.length) {
            this.stepsList.removeChild(this.stepsList.lastChild);
        }
    }
    setupDragAndDrop(cardElement, index) {
        const cardHeader = cardElement.querySelector('.card-header');
        if (cardHeader) {
            cardHeader.setAttribute('draggable', 'true');
            cardElement.dataset.index = index;
        }
        cardElement.classList.add('form-card');
    }
    async loadCheatScenario(gameId) {
        const stagingUrl = `https://cheat.staging.enostd.gay/`;
        const devUrl = `https://cheat.dev.enostd.gay/`;
        const isStagingMode = document.getElementById('m_chk_env').checked;
        const apiUrl = isStagingMode ? stagingUrl : devUrl;
        const inputUrl = `${apiUrl}${gameId}/inputdata`;
        const response = await fetch(inputUrl);
        if (response.ok) {
            return await response.text();
        } else {
            throw new Error('Failed to load cheat scenario');
        }
    }
    handleDragStart(e) {
        const cardHeader = e.target.closest('.card-header');
        if (!cardHeader) return;

        const card = cardHeader.closest('.form-card');
        if (!card) return;

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