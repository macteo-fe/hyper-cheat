export class FormCard {
    constructor(gameId) {
        this.gameId = gameId;
        this.index = 0;
        this.data = {};
        this.formText = '';
        this.isRender = false;
        this.elements = {
            card: this._createDomElement('div', 'card mb-0 form-card'),
            header: {
                container: this._createDomElement('div', 'card-header d-flex justify-content-between'),
                stepLabel: this._createDomElement('a'),
                matrixLabel: this._createDomElement('a'),
                buttons: {
                    actionsContainer: this._createDomElement('div', 'card-actions'),
                    duplicate: this._createButton('⏎'),
                    up: this._createButton('↑'),
                    down: this._createButton('↓'),
                    delete: this._createButton('⌫')
                }
            },
            body: {
                container: this._createDomElement('div', 'card-body', 'display: block;'),
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
        this.elements.card.appendChild(this.elements.body.container);
        // Header
        this.elements.header.container.appendChild(this.elements.header.stepLabel);
        this.elements.header.container.appendChild(this.elements.header.matrixLabel);
        this.elements.header.container.appendChild(this.elements.header.buttons.actionsContainer);
        this.elements.header.buttons.actionsContainer.appendChild(this.elements.header.buttons.duplicate);
        this.elements.header.buttons.actionsContainer.appendChild(this.elements.header.buttons.up);
        this.elements.header.buttons.actionsContainer.appendChild(this.elements.header.buttons.down);
        this.elements.header.buttons.actionsContainer.appendChild(this.elements.header.buttons.delete);
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
    _createButton(symbol) {
        const button = this._createDomElement('button', 'btn btn-link');
        button.textContent = symbol;
        return button;
    }


    //handle action
    addEventListeners() {
        this.elements.header.buttons.duplicate.addEventListener('click', this._handleDuplicate.bind(this));
        this.elements.header.buttons.up.addEventListener('click', this._handleMoveUp.bind(this));
        this.elements.header.buttons.down.addEventListener('click', this._handleMoveDown.bind(this));
        this.elements.header.buttons.delete.addEventListener('click', this._handleDelete.bind(this));
        this.elements.header.container.addEventListener('click', this._handleHeaderClick.bind(this));
    }
    _handleDuplicate() {
        this._dispatchCardEvent('duplicate', { data: this.data });
    }
    _handleMoveUp() {
        this._dispatchCardEvent('moveUp');
    }
    _handleMoveDown() {
        this._dispatchCardEvent('moveDown');
    }
    _handleDelete() {
        this._dispatchCardEvent('delete');
    }
    _handleHeaderClick(event) {
        if (event.target.tagName === 'BUTTON') return;
        this.elements.body.container.style.display = this.elements.body.container.style.display === "none" ? 'block' : 'none';
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
    }

    updateHeader() {
        this.elements.header.stepLabel.textContent = `Step ${this.index}`;
        this.elements.header.matrixLabel.textContent = ``;
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
        const buttons = Array.from(leftDiv.getElementsByTagName("button"));
        const submitInput = inputs.find(ip => ip.type === "submit");
        const submitBtn = buttons.find(ip => ip.type === "submit");
        const submitButton = submitInput || submitBtn;

        this.elements.body.leftDiv.inputs = inputs;
        this.elements.body.leftDiv.selects = selects;

        const inputMatrix = inputs.find(ip => ip.id === "matrixData");
        if (inputMatrix) {
            inputMatrix.addEventListener('keyup', () => {
                this._handleSubmit(inputs.concat(selects), false);
            });
        }

        const allSubmitButtons = [...inputs, ...buttons].filter(ip => ip.type === "submit");
        if (allSubmitButtons.length > 1) {
            allSubmitButtons.forEach(btn => {
                btn.type = "button";
                btn.value = "Submit";
                btn.onclick = () => {
                    this._handleSubmit(inputs.concat(selects), true);
                };
            });
        } else {
            this.elements.body.leftDiv.submitButton = submitButton;
            if (submitButton) {
                submitButton.type = "button";
                submitButton.value = "Submit";
                submitButton.onclick = () => {
                    this._handleSubmit(inputs.concat(selects), true);
                }
            }
        }
    }
    _handleSubmit(inputs, isSentEvent = false) {
        const newData = this._collectData(inputs);
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
    }

    _renderFormValues(container, isUpdating = false) {
        this.elements.body.rightDiv.formValues = {};
        const formCheat = document.createElement("div");
        formCheat.innerHTML = this.formText;
        this.elements.body.rightDiv.container.classList.toggle('is-updating', isUpdating);
        Object.entries(this.data).forEach(([key, value]) => {
            if (!value) return;

            const valueContainer = document.createElement("div");
            valueContainer.className = 'form-value-container';

            const label = document.createElement("label");
            const labelValue = document.createElement("label");
            labelValue.className = 'value-label';

            const element = formCheat.querySelector(`#${key}`) || formCheat.querySelector(`[name=${key}]`);
            label.textContent = element?.parentNode?.innerText?.trim() || key;
            labelValue.textContent = value;

            if (key === 'matrixData') {
                labelValue.style.color = this._checkMatrix(value, this.data.tableFormat) ? "var(--success)" : "var(--danger)";
                this.elements.header.matrixLabel.textContent = value;
            } else {
                labelValue.style.color = "var(--success)";
            }

            valueContainer.appendChild(label);
            valueContainer.appendChild(labelValue);
            container.appendChild(valueContainer);

            this.elements.body.rightDiv.formValues[key] = {
                container: valueContainer,
                label: label,
                value: labelValue
            };
        });
    }

    _renderMatrixTable(container) {
        let { matrixData = null, tableFormat = null, megaSymbolCode = null } = this.data || {};
        if (this.gameId === '9833') {
            tableFormat = megaSymbolCode;
        }

        if (!matrixData || !tableFormat) return;
        try {
            const matrixHtml = this._buildMatrix(matrixData, tableFormat);
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
            const formatValues = format.split(',').map(num => parseInt(num, 10));

            if (formatValues.some(isNaN)) return false;

            const expectedTotal = formatValues.reduce((sum, val) => sum + val, 0);
            return matrixValues.length === expectedTotal;
        } catch (error) {
            console.error('Matrix validation error:', error);
            return false;
        }
    }

    _buildMatrix(matrixData, format) {
        if (!matrixData || !format) return '';
        try {
            const matrixValues = matrixData.split(',');
            const formatValues = format.split(',').map(Number);
            const matrix = [];
            let currentIndex = 0;
            const maxColumns = Math.max(...formatValues);

            for (const rowLength of formatValues) {
                const row = [];
                for (let col = 0; col < rowLength; col++) {
                    const value = matrixValues[currentIndex++];
                    row.push(value ? value.split('-')[0] : null);
                }
                matrix.push(row);
            }

            let output = 'Matrix Table <br/><pre>\n';
            for (let row = 0; row < maxColumns; row++) {
                for (let col = 0; col < matrix.length; col++) {
                    const value = matrix[col][row] || ' ';
                    output += value.padEnd(2, ' ') + ' | ';
                }
                output += '\n';
            }
            output += '</pre>';
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
            tableMatrixContainer = container.querySelector("#tableMatrix"),
            submitButton = container.querySelector("#submitBtn");

        matrixDataInput.addEventListener("input", updateMatrixTable.bind(this));
        tableFormatInput.addEventListener("input", updateMatrixTable.bind(this));

        const inputsMain = Array.from(container.getElementsByTagName("input"));
        const selects = Array.from(container.getElementsByTagName("select"));
        const textArea = Array.from(container.getElementsByTagName("textarea"));


        this.elements.body.leftDiv.inputs = inputsMain;
        this.elements.body.leftDiv.selects = selects;

        this.elements.body.leftDiv.submitButton = submitButton;
        if (submitButton) {
            submitButton.type = "button";
            submitButton.value = "Submit";
            submitButton.onclick = () => {
                this._handleSubmit(inputsMain.concat(selects).concat(textArea), true);
            }
        }

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
                input.addEventListener('change', (event) => {
                    const cellIndex = event.target.getAttribute('data-cell-index');
                    updateMatrixData(event.target, cellIndex);
                    this._handleSubmit(inputsMain.concat(selects).concat(textArea), false);
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
            tableMatrixContainer = container.querySelector("#tableMatrix"),
            submitButton = container.querySelector("#submitBtn");

        matrixDataInput.addEventListener("input", updateMatrixTable.bind(this));
        tableFormatInput.addEventListener("input", updateMatrixTable.bind(this));

        const inputsMain = Array.from(container.getElementsByTagName("input"));
        const selects = Array.from(container.getElementsByTagName("select"));
        const textArea = Array.from(container.getElementsByTagName("textarea"));


        this.elements.body.leftDiv.inputs = inputsMain;
        this.elements.body.leftDiv.selects = selects;
        const submitInput = inputsMain.find(ip => ip.type === "submit");

        this.elements.body.leftDiv.submitButton = submitButton || submitInput;
        submitButton = submitButton || submitInput;
        if (submitButton) {
            submitButton.type = "button";
            submitButton.value = "Submit";
            submitButton.onclick = () => {
                this._handleSubmit(inputsMain.concat(selects).concat(textArea), true);
            }
        }

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
                input.addEventListener('change', (event) => {
                    const cellIndex = event.target.getAttribute('data-cell-index');
                    updateMatrixData(event.target, cellIndex);
                    this._handleSubmit(inputsMain.concat(selects).concat(textArea), false);
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
        const textArea = Array.from(container.getElementsByTagName("textarea"));

        const submitInput = inputsMain.find(ip => ip.type === "submit");
        const submitBtn = inputsMain.find(ip => ip.type === "submit");
        const submitButton = submitInput || submitBtn;


        this.elements.body.leftDiv.inputs = inputsMain;
        this.elements.body.leftDiv.selects = selects;

        this.elements.body.leftDiv.submitButton = submitButton;
        if (submitButton) {
            submitButton.type = "button";
            submitButton.value = "Submit";
            submitButton.onclick = () => {
                this._handleSubmit(inputsMain.concat(selects).concat(textArea), true);
            }
        }

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
                input.addEventListener('change', (event) => {
                    const cellIndex = event.target.getAttribute('data-cell-index');
                    updateMatrixData(event.target, cellIndex);
                    this._handleSubmit(inputsMain.concat(selects).concat(textArea), false);
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
        const submitButton = container.querySelector('input[type="submit"]');

        matrixDataInput.addEventListener("input", updateMatrixTable.bind(this));
        tableFormatInput.addEventListener("input", updateMatrixTable.bind(this));

        const inputsMain = Array.from(container.getElementsByTagName("input"));
        const selects = Array.from(container.getElementsByTagName("select"));
        const textArea = Array.from(container.getElementsByTagName("textarea"));


        this.elements.body.leftDiv.inputs = inputsMain;
        this.elements.body.leftDiv.selects = selects;

        this.elements.body.leftDiv.submitButton = submitButton;
        if (submitButton) {
            submitButton.type = "button";
            submitButton.value = "Submit";
            submitButton.onclick = () => {
                this._handleSubmit(inputsMain.concat(selects).concat(textArea), true);
            }
        }

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
                input.addEventListener('change', (event) => {
                    const cellIndex = event.target.getAttribute('data-cell-index');
                    updateMatrixData(event.target, cellIndex);
                    this._handleSubmit(inputsMain.concat(selects).concat(textArea), false);
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