export class FormCard {
    constructor(gameId) {
        this.gameId = gameId;
        this.index = 0;
        this.data = {};
        this.formText = '';
        this.isRender = false;
        this.isCollapsed = true;
        this.symbolAssets = {};
        this.elements = {
            card: this._createDomElement('div', 'card mb-0 form-card is-collapsed'),
            header: {
                container: this._createDomElement('div', 'card-header d-flex justify-content-between'),
                stepLabel: this._createDomElement('a'),
                matrixLabel: this._createDomElement('a'),
                toggleLabel: this._createDomElement('span', 'card-toggle'),
                buttons: {
                    actionsContainer: this._createDomElement('div', 'card-actions'),
                    duplicate: this._createButton('⧉', 'Duplicate step'),
                    up: this._createButton('↑'),
                    down: this._createButton('↓'),
                    delete: this._createButton('⌫')
                }
            },
            summary: {
                container: this._createDomElement('div', 'card-summary'),
                data: this._createDomElement('div', 'card-summary-data'),
                matrix: this._createDomElement('div', 'card-summary-matrix'),
            },
            body: {
                container: this._createDomElement('div', 'card-body', 'display: none;'),
                leftDiv: {
                    container: this._createDomElement('div', 'leftDiv', 'width: 50%; float: left;'),
                    inputs: [],
                    selects: [],
                    submitButton: null,
                },
                rightDiv: {
                    container: this._createDomElement('div', 'rightDiv', 'width: 50%; float: right;'),

                    formValues: {},
                    matrixContainer: this._createDomElement('div', 'matrix-container'),
                }
            }
        };
        setTimeout(() => {
            this.appendElements();
            this.addEventListeners();
        }, 0);
    }

    // Create card element
    appendElements() {
        this.elements.card.appendChild(this.elements.header.container);
        this.elements.card.appendChild(this.elements.summary.container);
        this.elements.card.appendChild(this.elements.body.container);
        // Header
        this.elements.header.container.appendChild(this.elements.header.stepLabel);
        this.elements.header.container.appendChild(this.elements.header.toggleLabel);
        this.elements.header.container.appendChild(this.elements.header.matrixLabel);
        this.elements.header.container.appendChild(this.elements.header.buttons.actionsContainer);
        this.elements.header.buttons.actionsContainer.appendChild(this.elements.header.buttons.duplicate);
        this.elements.header.buttons.actionsContainer.appendChild(this.elements.header.buttons.up);
        this.elements.header.buttons.actionsContainer.appendChild(this.elements.header.buttons.down);
        this.elements.header.buttons.actionsContainer.appendChild(this.elements.header.buttons.delete);
        // Summary — matrix left, field chips right when collapsed
        this.elements.summary.container.appendChild(this.elements.summary.matrix);
        this.elements.summary.container.appendChild(this.elements.summary.data);
        // Body
        this.elements.body.container.appendChild(this.elements.body.leftDiv.container);
        this.elements.body.container.appendChild(this.elements.body.rightDiv.container);
    }
    _createDomElement(elementName, className, style) {
        const element = document.createElement(elementName);
        element.className = className;
        if (style) element.style = style;
        return element;
    }
    _createButton(symbol, title = '') {
        const button = this._createDomElement('button', 'btn btn-link');
        button.type = 'button';
        button.textContent = symbol;
        if (title) button.title = title;
        return button;
    }


    setSymbolAssets(symbols = {}) {
        this.symbolAssets = symbols || {};
        if (this.isRender) {
            this.updateRightDiv();
            this.updateSummary();
        }
    }

    //handle action
    addEventListeners() {
        this.elements.header.buttons.duplicate.addEventListener('click', this._handleDuplicate.bind(this));
        this.elements.header.buttons.up.addEventListener('click', this._handleMoveUp.bind(this));
        this.elements.header.buttons.down.addEventListener('click', this._handleMoveDown.bind(this));
        this.elements.header.buttons.delete.addEventListener('click', this._handleDelete.bind(this));
        this.elements.header.container.addEventListener('click', this._handleHeaderClick.bind(this));
    }
    _handleDuplicate(event) {
        event.stopPropagation();
        const data = this._cloneStepData(this._syncDataFromForm());
        this.updateRightDiv(true);
        this.updateSummary();
        this._dispatchCardEvent('duplicate', { data });
    }
    _handleMoveUp(event) {
        event.stopPropagation();
        this._dispatchCardEvent('moveUp');
    }
    _handleMoveDown(event) {
        event.stopPropagation();
        this._dispatchCardEvent('moveDown');
    }
    _handleDelete(event) {
        event.stopPropagation();
        this._dispatchCardEvent('delete');
    }
    _handleHeaderClick(event) {
        if (event.target.tagName === 'BUTTON') return;
        this.setCollapsed(!this.isCollapsed);
    }
    setCollapsed(collapsed) {
        this.isCollapsed = !!collapsed;
        this.elements.card.classList.toggle('is-collapsed', this.isCollapsed);
        this.elements.card.classList.toggle('is-expanded', !this.isCollapsed);
        this.elements.body.container.style.display = this.isCollapsed ? 'none' : 'block';
        this.elements.summary.container.style.display = this.isCollapsed ? 'block' : 'none';
        this.elements.header.toggleLabel.textContent = this.isCollapsed ? '▸' : '▾';
        if (this.isCollapsed) this.updateSummary();
    }
    _dispatchCardEvent(eventName, data = {}) {
        if (!this.isRender) return;
        const event = new CustomEvent(`card:${eventName}`, {
            bubbles: true,
            detail: {
                index: this.index,
                ...data
            }
        });
        document.dispatchEvent(event);
    }

    //render card
    renderCard(data) {
        const { dataStep, formText } = data;
        this.index = dataStep.index;
        this.data = dataStep;
        this.formText = formText;
        this.isRender = true;

        this.elements.body.leftDiv.container.innerHTML = "";
        this.elements.body.rightDiv.container.innerHTML = "";
        this.updateHeader();
        this.updateLeftDiv();
        this.updateRightDiv();
        this.updateSummary();
        this.setCollapsed(this.isCollapsed);
    }

    updateHeader() {
        this.elements.header.stepLabel.textContent = `Step ${this.index}`;
        this.elements.header.matrixLabel.textContent = '';
        this.elements.header.toggleLabel.textContent = this.isCollapsed ? '▸' : '▾';
    }

    updateLeftDiv() {
        this.elements.body.leftDiv.container.innerHTML = this.formText;
        const userId = this.elements.body.leftDiv.container.querySelector(`[name="userId"]`);
        if (userId && userId.parentNode) userId.parentNode.style.display = "none";
        Object.entries(this.data).forEach(([key, value]) => {
            const element = this.elements.body.leftDiv.container.querySelector(`#${key}`)
                || this.elements.body.leftDiv.container.querySelector(`[name=${key}]`);
            if (element) element.value = value;
        });
        this._setupInputHandlers(this.elements.body.leftDiv.container);
        this._removeSubmitButtons(this.elements.body.leftDiv.container);
        this._bindAutoSubmit(this.elements.body.leftDiv.container);
    }
    _setupInputHandlers(leftDiv) {
        const tableE = Array.from(leftDiv.getElementsByTagName("table"));
        const hasTableMatrixE = tableE.some(table => table.id === "tableMatrix");
        const textAreE = Array.from(leftDiv.getElementsByTagName("textarea"));
        const hasTableAreaE = textAreE.some(table => table.id === "matrixData");


        if ((hasTableMatrixE && hasTableAreaE)) {
            if (this.gameId == '902') {
                this.initGame902(leftDiv);
            } else if (this.gameId == '9826') {
                this.initGame9826(leftDiv);
            } else if (this.gameId == '9808') {
                this.initGame9808(leftDiv);
            } else {
                this.initGame9790(leftDiv);
            }
            return;
        }

        //for 9868
        if (this.gameId == '9868' || this.gameId == '9864') this.initGame9868(leftDiv);

        const inputs = Array.from(leftDiv.getElementsByTagName("input"));
        const selects = Array.from(leftDiv.getElementsByTagName("select"));
        this.elements.body.leftDiv.inputs = inputs;
        this.elements.body.leftDiv.selects = selects;
        this.elements.body.leftDiv.submitButton = null;
    }

    _removeSubmitButtons(container) {
        if (!container) return;
        container.querySelectorAll('input[type="submit"], button[type="submit"], #submitBtn').forEach((el) => {
            el.style.display = 'none';
            el.disabled = true;
            el.onclick = null;
        });
    }

    _getFormFields(container) {
        if (!container) return [];
        return [
            ...container.querySelectorAll('input:not([type="submit"]):not([type="button"])'),
            ...container.querySelectorAll('select'),
            ...container.querySelectorAll('textarea'),
        ];
    }

    _bindAutoSubmit(container) {
        if (!container || container.dataset.autoSubmitBound === '1') return;
        container.dataset.autoSubmitBound = '1';
        const schedule = () => {
            clearTimeout(this._autoSubmitTimer);
            this._autoSubmitTimer = setTimeout(() => {
                if (!this.isRender) return;
                this._handleSubmit(this._getFormFields(container), true);
            }, 200);
        };
        container.addEventListener('input', schedule);
        container.addEventListener('change', schedule);
    }

    _syncDataFromForm() {
        if (!this.isRender) return this.data;
        clearTimeout(this._autoSubmitTimer);
        const container = this.elements.body.leftDiv.container;
        if (!container) return this.data;
        const inputs = this._getFormFields(container);
        if (!inputs.length) return this.data;
        const newData = this._collectData(inputs);
        newData.index = this.index;
        this.data = newData;
        return this.data;
    }

    _cloneStepData(data) {
        try {
            return JSON.parse(JSON.stringify(data || {}));
        } catch {
            return { ...(data || {}) };
        }
    }

    _handleSubmit(inputs, isSentEvent = true) {
        const newData = this._collectData(inputs);
        newData.index = this.index;
        this.data = newData;
        this.updateRightDiv(true);
        if (isSentEvent) this._dispatchCardEvent('submit', { data: this.data, index: this.index });
    }

    _collectData(inputs) {
        const data = {};
        inputs.forEach((input) => {
            if (input.name && input.value) {
                data[input.name] = input.value;
                if ((this.gameId == '9868' || this.gameId == '9864') && input.name == 'stackedReel1' && input.value == '0') {
                    delete data[input.name];
                }
            }
        });
        return data;
    }

    updateRightDiv(isUpdating = false) {
        const fragment = document.createDocumentFragment();
        this._renderFormValues(fragment, isUpdating);
        this._renderMatrixTable(fragment);
        this.elements.body.rightDiv.container.innerHTML = '';
        this.elements.body.rightDiv.container.appendChild(fragment);
        this.updateSummary();
    }

    updateSummary() {
        if (!this.elements.summary?.container) return;
        this.elements.summary.data.innerHTML = this._buildSummaryDataHtml();
        const { matrixData, tableFormat } = this._getMatrixSource();
        if (matrixData && tableFormat) {
            const matrixHtml = this._buildMatrix(matrixData, tableFormat, { compact: true });
            this.elements.summary.matrix.innerHTML = matrixHtml || '<div class="card-summary-empty">No matrix</div>';
        } else {
            this.elements.summary.matrix.innerHTML = '<div class="card-summary-empty">No matrix</div>';
        }
    }

    _getFormFieldDisplay(key, value, formCheat) {
        const element = formCheat.querySelector(`#${key}`) || formCheat.querySelector(`[name="${key}"]`);
        const label = element?.parentNode?.innerText?.trim() || key;
        let valueColor = 'var(--success)';
        if (key === 'matrixData') {
            const format = this.data.tableFormat || this.data.megaSymbolCode;
            valueColor = this._checkMatrix(value, format) ? 'var(--success)' : 'var(--danger)';
        }
        return { label, valueColor };
    }

    _buildSummaryDataHtml() {
        const formCheat = document.createElement('div');
        formCheat.innerHTML = this.formText || '';
        const entries = Object.entries(this.data || {}).filter(([, value]) => value);

        if (!entries.length) {
            return '<div class="card-summary-empty">Empty step</div>';
        }

        return entries.map(([key, value]) => {
            const { label, valueColor } = this._getFormFieldDisplay(key, value, formCheat);
            return `
                <div class="form-value-container is-compact">
                    <label class="form-value-label">${this._escapeHtml(label)}</label>
                    <label class="value-label" style="color:${valueColor}">${this._escapeHtml(String(value))}</label>
                </div>
            `;
        }).join('');
    }

    _shortenValue(value, max = 28) {
        const text = String(value);
        if (text.length <= max) return text;
        return `${text.slice(0, max - 1)}…`;
    }

    _escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    _getMatrixSource() {
        const left = this.elements.body?.leftDiv?.container;
        const liveMatrix = left?.querySelector?.('#matrixData, textarea[name="matrixData"], input[name="matrixData"]')?.value;
        const liveFormat = left?.querySelector?.('#tableFormat, input[name="tableFormat"], textarea[name="tableFormat"]')?.value;
        const liveMega = left?.querySelector?.('#megaSymbolCode, input[name="megaSymbolCode"]')?.value;

        let matrixData = (liveMatrix ?? this.data?.matrixData ?? '').toString().trim();
        let tableFormat = (liveFormat ?? this.data?.tableFormat ?? '').toString().trim();

        if (this.gameId === '9833') {
            tableFormat = (liveMega ?? this.data?.megaSymbolCode ?? tableFormat ?? '').toString().trim();
        }

        if (!tableFormat) {
            tableFormat = this._getDefaultTableFormatFromFormText() || '';
        }

        if (!matrixData) matrixData = null;
        if (!tableFormat) tableFormat = null;

        return { matrixData, tableFormat };
    }

    _getDefaultTableFormatFromFormText() {
        if (!this.formText) return null;
        try {
            const wrap = document.createElement('div');
            wrap.innerHTML = this.formText;
            const input = wrap.querySelector('#tableFormat, [name="tableFormat"]');
            const value = input?.getAttribute('value') || input?.textContent || '';
            return value.toString().trim() || null;
        } catch {
            return null;
        }
    }

    _parseTableFormat(format) {
        return String(format)
            .split(',')
            .map((n) => parseInt(String(n).trim(), 10))
            .filter((n) => Number.isFinite(n) && n > 0);
    }

    _getCellIndex(row, colIndex, formatValues) {
        let cellIndex = 0;
        for (let i = 0; i < colIndex; i++) {
            cellIndex += formatValues[i];
        }
        return cellIndex + row;
    }

    _renderFormValues(container, isUpdating = false) {
        this.elements.body.rightDiv.formValues = {};
        const formCheat = document.createElement("div");
        formCheat.innerHTML = this.formText;
        this.elements.body.rightDiv.container.classList.toggle('is-updating', isUpdating);
        Object.entries(this.data).forEach(([key, value]) => {
            if (!value) return;

            const { label, valueColor } = this._getFormFieldDisplay(key, value, formCheat);

            const valueContainer = document.createElement("div");
            valueContainer.className = 'form-value-container';

            const labelEl = document.createElement("label");
            labelEl.className = 'form-value-label';
            labelEl.textContent = label;

            const labelValue = document.createElement("label");
            labelValue.className = 'value-label';
            labelValue.textContent = value;
            labelValue.style.color = valueColor;

            valueContainer.appendChild(labelEl);
            valueContainer.appendChild(labelValue);
            container.appendChild(valueContainer);

            this.elements.body.rightDiv.formValues[key] = {
                container: valueContainer,
                label: labelEl,
                value: labelValue
            };
        });
    }

    _renderMatrixTable(container) {
        const { matrixData, tableFormat } = this._getMatrixSource();
        if (!matrixData || !tableFormat) return;
        try {
            const matrixHtml = this._buildMatrix(matrixData, tableFormat, { compact: false });
            if (matrixHtml) {
                const matrixContainer = document.createElement("div");
                matrixContainer.className = 'matrix-container';
                matrixContainer.innerHTML = matrixHtml;
                this.elements.body.rightDiv.matrixContainer = matrixContainer;
                container.appendChild(matrixContainer);
            }

        } catch (error) {
            console.error('Error rendering matrix table:', error);
        }
    }

    _checkMatrix(matrixData, format) {
        if (!matrixData || !format) return false;

        try {
            const matrixValues = matrixData.trim().split(',').filter(val => val.length > 0);
            const formatValues = this._parseTableFormat(format);
            if (!formatValues.length) return false;
            const expectedTotal = formatValues.reduce((sum, val) => sum + val, 0);
            return matrixValues.length === expectedTotal;
        } catch (error) {
            console.error('Matrix validation error:', error);
            return false;
        }
    }

    _resolveSymbolImage(symbolValue) {
        if (!symbolValue || !this.symbolAssets) return null;
        const raw = String(symbolValue).trim();
        if (!raw) return null;
        if (this.symbolAssets[raw]) return this.symbolAssets[raw];
        const base = raw.split('_')[0].split('-')[0];
        return this.symbolAssets[base] || null;
    }

    _buildMatrix(matrixData, format, options = {}) {
        if (!matrixData || !format) return '';
        const { compact = false } = options;
        try {
            const matrixValues = String(matrixData).split(',').map((v) => v.trim());
            const formatValues = this._parseTableFormat(format);
            if (!formatValues.length) return '';

            const maxRows = Math.max(...formatValues);
            const numCols = formatValues.length;
            const formatLabel = formatValues.join(',');

            let output = `<div class="matrix-preview-title">Matrix (${formatLabel})</div>`;
            output += `<div class="matrix-preview-grid${compact ? ' is-compact' : ''}">`;
            for (let row = 0; row < maxRows; row++) {
                output += '<div class="matrix-preview-row">';
                for (let colIndex = 0; colIndex < numCols; colIndex++) {
                    const colLength = formatValues[colIndex];
                    if (row >= colLength) {
                        output += '<div class="matrix-preview-cell is-empty-cell"></div>';
                        continue;
                    }

                    const cellIndex = this._getCellIndex(row, colIndex, formatValues);
                    const rawValue = matrixValues[cellIndex] || '';
                    const value = rawValue ? rawValue.split('-')[0] : '';
                    const image = this._resolveSymbolImage(value);

                    output += `<div class="matrix-preview-cell${value ? '' : ' is-empty-cell'}" title="${value || ''}">`;
                    if (image) {
                        output += `<img src="${image}" alt="${value}" />`;
                    } else if (value) {
                        output += `<span class="matrix-preview-fallback">${value}</span>`;
                    } else {
                        output += `<span class="matrix-preview-fallback">·</span>`;
                    }
                    if (!compact && value) {
                        output += `<span class="matrix-preview-code">${value}</span>`;
                    }
                    output += '</div>';
                }
                output += '</div>';
            }
            output += '</div>';
            return output;
        } catch {
            return '';
        }
    }

    //forGame9868
    initGame9868(container) {
        container.querySelector('#stackedReel1').value = '0';
        container.querySelectorAll('.matrix_build').forEach(function (e) {
            e.addEventListener('blur', function () {
                let m = container.querySelector('#matrixData').value
                m = m == '' ? 'J,4,J,7,J,6,7,7,6,6,K,6,K,4,10' : m;
                let t = container.querySelector('#tableFormat').value
                t = t == '' ? '3,3,3,3,3' : t;
                container.querySelector('#tableMatrix').innerHTML = buildMatrix(m, t);
            })
        })
        container.querySelector('#stackedReel5').addEventListener('change', function () {
            var list = container.querySelector('#stackedReel5')
            var value = list.selectedOptions[0].value;
            container.querySelector('#choose-car')
            var jpList = container.querySelector("#jackpotType")
            jpList.innerHTML = "";
            var newOption = '<option value="" selected disabled>Choose a jackpot</option>';
            newOption += '<option value="_MINI">_MINI</option>';
            newOption += '<option value="_MINOR">_MINOR</option>'
            if (value === '3' || value === '4' || value === '5') {
                newOption += '<option value="_MAJOR">_MAJOR</option>'
                newOption += '<option value="_GRAND">_GRAND</option>'
            }
            jpList.innerHTML = newOption;

            var symbolList = container.querySelector("#megaSymbolCode")
            symbolList.innerHTML = "";
            var newOption2 = '<option value="">NONE</option>';
            switch (value) {
                case '1':
                case '2':
                    newOption2 += '<option value="77,66,55 ">LOCK_25_50_100</option>';
                    newOption2 += '<option value="77,66 ">LOCK_50_100</option>'
                    newOption2 += '<option value="77 ">LOCK_100</option>'
                    newOption2 += '<option value="66,55 ">LOCK_25_50</option>'
                    newOption2 += '<option value="66 ">LOCK_50</option>'
                    newOption2 += '<option value="55 ">LOCK_25</option>'
                    break;
                case '3':
                    newOption2 += '<option value="77,66,5">LOCK_50_100, UNLOCK_25</option>';
                    newOption2 += '<option value="77,66 ">LOCK_50_100</option>'
                    newOption2 += '<option value="77 ">LOCK_100</option>'
                    newOption2 += '<option value="66,5">LOCK_50, UNLOCK_25</option>'
                    newOption2 += '<option value="66 ">LOCK_50</option>'
                    newOption2 += '<option value=" 5">UNLOCK_25</option>'
                    break;
                case '4':
                    newOption2 += '<option value="77,6,5">LOCK_100, UNLOCK_25_50</option>';
                    newOption2 += '<option value="77,6">LOCK_100, UNLOCK_50</option>'
                    newOption2 += '<option value="77 ">LOCK_100</option>'
                    newOption2 += '<option value=" 6,5">UNLOCK_25_50</option>'
                    newOption2 += '<option value=" 6">UNLOCK_50</option>'
                    newOption2 += '<option value=" 5">UNLOCK_25</option>'
                    break;
                case '5':
                    newOption2 += '<option value=" 7,6,5">UNLOCK_25_50_100</option>';
                    newOption2 += '<option value=" 7,6">UNLOCK_50_100</option>'
                    newOption2 += '<option value=" 7">UNLOCK_100</option>'
                    newOption2 += '<option value=" 6,5">UNLOCK_25_50</option>'
                    newOption2 += '<option value=" 6">UNLOCK_50</option>'
                    newOption2 += '<option value=" 5">UNLOCK_25</option>'
                    break;
            }
            symbolList.innerHTML = newOption2;
        });
        container.querySelector('#stackedReel1').addEventListener('change', function () {
            this.value = this.checked ? '1' : '0';
        });

        var list = container.querySelector('#stackedReel5')
        var value = list.selectedOptions[0].value;
        var symbolList = container.querySelector("#megaSymbolCode")
        symbolList.innerHTML = "";
        var newOption2 = '<option value="">NONE</option>';
        switch (value) {
            case '1':
            case '2':
                newOption2 += '<option value="77,66,55 ">LOCK_25_50_100</option>';
                newOption2 += '<option value="77,66 ">LOCK_50_100</option>'
                newOption2 += '<option value="77 ">LOCK_100</option>'
                newOption2 += '<option value="66,55 ">LOCK_25_50</option>'
                newOption2 += '<option value="66 ">LOCK_50</option>'
                newOption2 += '<option value="55 ">LOCK_25</option>'
                break;
            case '3':
                newOption2 += '<option value="77,66,5">LOCK_50_100, UNLOCK_25</option>';
                newOption2 += '<option value="77,66 ">LOCK_50_100</option>'
                newOption2 += '<option value="77 ">LOCK_100</option>'
                newOption2 += '<option value="66,5">LOCK_50, UNLOCK_25</option>'
                newOption2 += '<option value="66 ">LOCK_50</option>'
                newOption2 += '<option value=" 5">UNLOCK_25</option>'
                break;
            case '4':
                newOption2 += '<option value="77,6,5">LOCK_100, UNLOCK_25_50</option>';
                newOption2 += '<option value="77,6">LOCK_100, UNLOCK_50</option>'
                newOption2 += '<option value="77 ">LOCK_100</option>'
                newOption2 += '<option value=" 6,5">UNLOCK_25_50</option>'
                newOption2 += '<option value=" 6">UNLOCK_50</option>'
                newOption2 += '<option value=" 5">UNLOCK_25</option>'
                break;
            case '5':
                newOption2 += '<option value=" 7,6,5">UNLOCK_25_50_100</option>';
                newOption2 += '<option value=" 7,6">UNLOCK_50_100</option>'
                newOption2 += '<option value=" 7">UNLOCK_100</option>'
                newOption2 += '<option value=" 6,5">UNLOCK_25_50</option>'
                newOption2 += '<option value=" 6">UNLOCK_50</option>'
                newOption2 += '<option value=" 5">UNLOCK_25</option>'
                break;
        }
        symbolList.innerHTML = newOption2;

        var jpList = container.querySelector("#jackpotType")
        jpList.innerHTML = "";
        var newOption = '<option value="" selected disabled>Choose a jackpot</option>';
        newOption += '<option value="_MINI">_MINI</option>';
        newOption += '<option value="_MINOR">_MINOR</option>'
        jpList.innerHTML = newOption;
    }

    //forGame9808
    initGame9808(container) {
        const matrixDataInput = container.querySelector("#matrixData"),
            tableFormatInput = container.querySelector("#tableFormat"),
            tableMatrixContainer = container.querySelector("#tableMatrix");

        matrixDataInput.addEventListener("input", updateMatrixTable.bind(this));
        tableFormatInput.addEventListener("input", updateMatrixTable.bind(this));

        const inputsMain = Array.from(container.getElementsByTagName("input"));
        const selects = Array.from(container.getElementsByTagName("select"));

        this.elements.body.leftDiv.inputs = inputsMain;
        this.elements.body.leftDiv.selects = selects;
        this.elements.body.leftDiv.submitButton = null;

        function updateMatrixTable() {
            const matrixData = matrixDataInput.value.split(",").map((e) => e.trim());
            const tableFormat = tableFormatInput.value.split(",").map((e) => parseInt(e.trim()));
            let tableHtml = "";
            const maxColumns = Math.max(...tableFormat);
            for (let row = 0; row < maxColumns; row++) {
                tableHtml += "<tr>";

                tableFormat.forEach((colLength, colIndex) => {
                    if (row < colLength) {
                        const cellIndex = calculateCellIndex(row, colIndex, tableFormat);
                        const cellValue = matrixData[cellIndex] || "";
                        tableHtml += `<td><input type="text" size="5" value="${cellValue}" placeholder="S2" data-cell-index="${cellIndex}"></td>`;
                    } else {
                        tableHtml += "<td></td>";
                    }
                });
                tableHtml += "</tr>";
            }
            tableMatrixContainer.innerHTML = tableHtml;

            // Add event listeners to the input elements
            const inputs = tableMatrixContainer.querySelectorAll('input');
            inputs.forEach(input => {
                input.addEventListener('input', (event) => {
                    const cellIndex = event.target.getAttribute('data-cell-index');
                    updateMatrixData(event.target, cellIndex);
                });
            });
        }

        function calculateCellIndex(row, colIndex, tableFormat) {
            let cellIndex = 0;
            for (let i = 0; i < colIndex; i++) {
                cellIndex += tableFormat[i];
            }
            return cellIndex + row;
        }

        function updateMatrixData(inputElement, cellIndex) {
            const matrixData = matrixDataInput.value.split(",").map((e) => e.trim());
            matrixData[cellIndex] = inputElement.value;
            matrixDataInput.value = matrixData.join(",");
        }

        updateMatrixTable.call(this);
    }

    //forGame9790
    initGame9790(container) {
        let matrixDataInput = container.querySelector("#matrixData"),
            tableFormatInput = container.querySelector("#tableFormat"),
            tableMatrixContainer = container.querySelector("#tableMatrix");

        matrixDataInput.addEventListener("input", updateMatrixTable.bind(this));
        tableFormatInput.addEventListener("input", updateMatrixTable.bind(this));

        const inputsMain = Array.from(container.getElementsByTagName("input"));
        const selects = Array.from(container.getElementsByTagName("select"));

        this.elements.body.leftDiv.inputs = inputsMain;
        this.elements.body.leftDiv.selects = selects;
        this.elements.body.leftDiv.submitButton = null;

        function updateMatrixTable() {
            const matrixData = matrixDataInput.value.split(",").map((e) => e.trim());
            const tableFormat = tableFormatInput.value.split(",").map((e) => parseInt(e.trim()));
            let tableHtml = "";
            const maxColumns = Math.max(...tableFormat);
            for (let row = 0; row < maxColumns; row++) {
                tableHtml += "<tr>";

                tableFormat.forEach((colLength, colIndex) => {
                    if (row < colLength) {
                        const cellIndex = calculateCellIndex(row, colIndex, tableFormat);
                        const cellValue = matrixData[cellIndex] || "";
                        tableHtml += `<td><input type="text" size="5" value="${cellValue}" placeholder="S2" data-cell-index="${cellIndex}"></td>`;
                    } else {
                        tableHtml += "<td></td>";
                    }
                });
                tableHtml += "</tr>";
            }
            tableMatrixContainer.innerHTML = tableHtml;

            // Add event listeners to the input elements
            const inputs = tableMatrixContainer.querySelectorAll('input');
            inputs.forEach(input => {
                input.addEventListener('input', (event) => {
                    const cellIndex = event.target.getAttribute('data-cell-index');
                    updateMatrixData(event.target, cellIndex);
                });
            });
        }

        function calculateCellIndex(row, colIndex, tableFormat) {
            let cellIndex = 0;
            for (let i = 0; i < colIndex; i++) {
                cellIndex += tableFormat[i];
            }
            return cellIndex + row;
        }

        function updateMatrixData(inputElement, cellIndex) {
            const matrixData = matrixDataInput.value.split(",").map((e) => e.trim());
            matrixData[cellIndex] = inputElement.value;
            matrixDataInput.value = matrixData.join(",");
        }

        updateMatrixTable.call(this);
    }


    //forGame9826
    initGame9826(container) {
        const matrixDataInput = container.querySelector("#matrixData"),
            tableFormatInput = container.querySelector("#tableFormat"),
            tableMatrixContainer = container.querySelector("#tableMatrix");

        matrixDataInput.addEventListener("input", updateMatrixTable.bind(this));
        tableFormatInput.addEventListener("input", updateMatrixTable.bind(this));

        const inputsMain = Array.from(container.getElementsByTagName("input"));
        const selects = Array.from(container.getElementsByTagName("select"));

        this.elements.body.leftDiv.inputs = inputsMain;
        this.elements.body.leftDiv.selects = selects;
        this.elements.body.leftDiv.submitButton = null;

        function updateMatrixTable() {
            const matrixData = matrixDataInput.value.split(",").map((e) => e.trim());
            const tableFormat = tableFormatInput.value.split(",").map((e) => parseInt(e.trim()));
            let tableHtml = "";
            const maxColumns = Math.max(...tableFormat);
            for (let row = 0; row < maxColumns; row++) {
                tableHtml += "<tr>";

                tableFormat.forEach((colLength, colIndex) => {
                    if (row < colLength) {
                        const cellIndex = calculateCellIndex(row, colIndex, tableFormat);
                        const cellValue = matrixData[cellIndex] || "";
                        tableHtml += `<td><input type="text" size="5" value="${cellValue}" placeholder="S2" data-cell-index="${cellIndex}"></td>`;
                    } else {
                        tableHtml += "<td></td>";
                    }
                });
                tableHtml += "</tr>";
            }
            tableMatrixContainer.innerHTML = tableHtml;

            // Add event listeners to the input elements
            const inputs = tableMatrixContainer.querySelectorAll('input');
            inputs.forEach(input => {
                input.addEventListener('input', (event) => {
                    const cellIndex = event.target.getAttribute('data-cell-index');
                    updateMatrixData(event.target, cellIndex);
                });
            });
        }

        function calculateCellIndex(row, colIndex, tableFormat) {
            let cellIndex = 0;
            for (let i = 0; i < colIndex; i++) {
                cellIndex += tableFormat[i];
            }
            return cellIndex + row;
        }

        function updateMatrixData(inputElement, cellIndex) {
            const matrixData = matrixDataInput.value.split(",").map((e) => e.trim());
            matrixData[cellIndex] = inputElement.value;
            matrixDataInput.value = matrixData.join(",");
        }

        updateMatrixTable.call(this);
    }


    //forGame902
    initGame902(container) {
        const matrixDataInput = container.querySelector("#matrixData");
        const tableFormatInput = container.querySelector("#tableFormat");
        const tableMatrixContainer = container.querySelector("#tableMatrix");

        matrixDataInput.addEventListener("input", updateMatrixTable.bind(this));
        tableFormatInput.addEventListener("input", updateMatrixTable.bind(this));

        const inputsMain = Array.from(container.getElementsByTagName("input"));
        const selects = Array.from(container.getElementsByTagName("select"));

        this.elements.body.leftDiv.inputs = inputsMain;
        this.elements.body.leftDiv.selects = selects;
        this.elements.body.leftDiv.submitButton = null;

        function updateMatrixTable() {
            const matrixData = matrixDataInput.value.split(",").map((e) => e.trim());
            const tableFormat = tableFormatInput.value.split(",").map((e) => parseInt(e.trim()));
            let tableHtml = "";
            const maxColumns = Math.max(...tableFormat);
            for (let row = 0; row < maxColumns; row++) {
                tableHtml += "<tr>";

                tableFormat.forEach((colLength, colIndex) => {
                    if (row < colLength) {
                        const cellIndex = calculateCellIndex(row, colIndex, tableFormat);
                        const cellValue = matrixData[cellIndex] || "";
                        tableHtml += `<td><input type="text" size="5" value="${cellValue}" placeholder="S2" data-cell-index="${cellIndex}"></td>`;
                    } else {
                        tableHtml += "<td></td>";
                    }
                });
                tableHtml += "</tr>";
            }
            tableMatrixContainer.innerHTML = tableHtml;

            // Add event listeners to the input elements
            const inputs = tableMatrixContainer.querySelectorAll('input');
            inputs.forEach(input => {
                input.addEventListener('input', (event) => {
                    const cellIndex = event.target.getAttribute('data-cell-index');
                    updateMatrixData(event.target, cellIndex);
                });
            });
        }

        function calculateCellIndex(row, colIndex, tableFormat) {
            let cellIndex = 0;
            for (let i = 0; i < colIndex; i++) {
                cellIndex += tableFormat[i];
            }
            return cellIndex + row;
        }

        function updateMatrixData(inputElement, cellIndex) {
            const matrixData = matrixDataInput.value.split(",").map((e) => e.trim());
            matrixData[cellIndex] = inputElement.value;
            matrixDataInput.value = matrixData.join(",");
        }

        updateMatrixTable.call(this);
    }
}