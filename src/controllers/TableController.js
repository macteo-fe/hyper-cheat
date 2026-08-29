export class TableController {
    constructor(data) {
        const { tabId, database, cheatController, formController } = data;
        this.tabId = tabId;
        this.gameId = null;
        this.currency = null;
        this._db = database;
        this._cheatController = cheatController;
        this._formController = formController;
        this.start();
    }
    start() {
        document.getElementById('m_btn_add').addEventListener('click', this.handleAddCheatBtnClick);
        document.getElementById('m_btn_clear').addEventListener('click', this.handleClearSessionClick);
        document.getElementById('m_btn_reload').addEventListener('click', this.handleReloadGameClick);
        document.getElementById('m_tbl_cheat').addEventListener('click', this.handleDataTableBodyClick);
        document.getElementById('m_btn_exportAll').addEventListener('click', this.handleExportAllClick);
        const dropZone = document.getElementById('m_tbl_cheat');
        dropZone.addEventListener('dragover', this.handleDragOver);
        dropZone.addEventListener('dragleave', this.handleDragLeave);
        dropZone.addEventListener('drop', this.handleDrop.bind(this));
    }
    handleAddCheatBtnClick = () => {
        const cheatTitle = this._replaceSpaces(document.getElementById('m_inp_cheat').value);
        this.addNewData(cheatTitle);
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
    handleDataTableBodyClick = (event) => {
        if (event.target.classList.contains('list-cheatName-link')) {
            event.preventDefault();
            const cheatName = event.target.dataset.cheatname;
            const key = event.target.dataset.key;
            document.getElementById('m_view_container').style.display = 'none';
            document.getElementById('s_view_container').style.display = 'block';
            document.getElementById('e_view_container').style.display = 'none';
            const formData = { key, cheatName, gameId: this.gameId, userId: this.userId };
            this._formController.loadForm(formData);
        }
        if (event.target.classList.contains('btn-edit-cheatName')) {
            event.preventDefault();
            const cheatName = event.target.dataset.cheatname;
            const key = event.target.dataset.key;
            const input = event.target.parentElement.querySelector('input[type="text"]');
            const saveBtn = event.target.parentElement.querySelector('button.btn-primary');
            const editBtn = event.target;
            const titleLink = event.target.parentElement.querySelector('.list-cheatName-link');
            input.classList.remove('d-none');
            saveBtn.classList.remove('d-none');
            editBtn.classList.add('d-none');
            titleLink.classList.add('d-none');
            input.focus();
            saveBtn.addEventListener('click', () => {
                const newCheatName = input.value.trim();
                if (newCheatName) {
                    this._db.updateCheatName(Number(key), newCheatName).then(() => {
                        input.classList.add('d-none');
                        saveBtn.classList.add('d-none');
                        editBtn.classList.remove('d-none');
                        titleLink.classList.remove('d-none');
                        titleLink.textContent = newCheatName;
                        titleLink.dataset.cheatname = newCheatName;
                    });
                }
            }, { once: true });
        }
        if (event.target.classList.contains('btn-danger')) {
            const key = event.target.dataset.key;
            this._db.deleteData(Number(key)).then(() => {
                this.renderTable(this.gameId);
            });
        }
        if (event.target.classList.contains('btn-success')) {
            const cheatName = event.target.dataset.cheatname;
            const key = event.target.dataset.key;
            document.getElementById('m_view_container').style.display = 'none';
            document.getElementById('s_view_container').style.display = 'none';
            document.getElementById('e_view_container').style.display = 'block';
            const cheatData = { key, cheatName, gameId: this.gameId, userId: this.userId };
            this._cheatController.showCheat(cheatData);
        }
        if (event.target.classList.contains('btn-secondary')) {
            const cheatName = event.target.dataset.cheatname;
            const key = event.target.dataset.key;
            this._db.getDataByKey(Number(key)).then(data => {
                this.exportDataFile(data, `${this.gameId}_${cheatName}.json`);
            });
        }
    }
    handleExportAllClick = () => {
        this._db.getDataByGameID(this.gameId).then(data => {
            this.exportDataFile(data, `${this.gameId}_all.json`);
        });
    }
    updateConfig(dataConfig) {
        const { gameId, userId, currency } = dataConfig;
        this.userId = userId;
        this.gameId = gameId;
        this.currency = currency;
    }
    renderTable() {
        document.getElementById('m_tbl_cheat').style.display = 'none';
        document.getElementById('m_tbl_body').innerHTML = '';
        if (this.gameId) {
            this._db.getDataByGameID(this.gameId).then(data => {
                const result = Array.isArray(data) ? data.sort((a, b) => b.key - a.key) : data;
                this.showTable(result);
            });
        } else {
            this._db.getAllData().then(data => {
                const result = Array.isArray(data) ? data.sort((a, b) => b.key - a.key) : data;
                this.showTable(result);
            });
        }
    }
    clearTable() {
        document.getElementById('m_tbl_cheat').style.display = 'none';
        document.getElementById('m_tbl_body').innerHTML = '';
    }
    showTable(data) {
        document.getElementById('m_tbl_cheat').style.display = 'block';
        const dataTableBody = document.getElementById('m_tbl_body');
        dataTableBody.innerHTML = '';
        const rows = data.map(({ gameId, cheatName, key }) => {
            const stringData = `data-gameId="${gameId}" data-cheatName="${cheatName}" data-key="${key}"`;
            return `
            <tr>
                <td><a ${stringData}>${gameId}</a></td>
                <td>
                    <a href="#" class="list-cheatName-link" ${stringData}>${cheatName}</a>
                    <input type="text" class="form-control d-none"${stringData} value="${cheatName}"" />
                    <button class="btn btn-sm btn-primary d-none" ${stringData}">Save</button>
                    <button class="btn btn-sm btn-edit-cheatName" ${stringData} title="Edit Name">✎</button>
                </td>
                <td>
                    <button class="btn btn-success" ${stringData}>►Run</button>
                    <button class="btn btn-danger" ${stringData}>Delete</button>
                    <button class="btn btn-secondary" ${stringData}>Export</button>
                </td>
            </tr>
            `;
        }).join('');

        dataTableBody.insertAdjacentHTML('beforeend', rows);
    }
    addNewData(cheatTitle) {
        if (!cheatTitle || !cheatTitle.length || !this.gameId || !this.gameId.length) return;
        const newData = { gameId: this.gameId, cheatName: cheatTitle };
        this._db.addData(newData).then(() => {
            this.renderTable(this.gameId);
            document.getElementById('m_inp_cheat').value = '';
        });
    }
    exportDataFile(data, fileName) {
        const dataStr = JSON.stringify(data);
        const type = fileName.split(".").pop();
        const dataUri = `data:application/${type};charset=utf-8,${encodeURIComponent(dataStr)}`;
        const linkElement = document.createElement('a');
        linkElement.href = dataUri;
        linkElement.download = fileName;
        linkElement.click();
    }
    _replaceSpaces(str) {
        return str && str.length ? str.replace(/\s+/g, '_') : null;
    }
    _encodeQueryData(data) {
        return Object.keys(data).map(key => [key, data[key]].map(encodeURIComponent).join("=")).join("&");
    }
    handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.add('drag-over');
    }
    handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over');
    }
    handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length) {
            Array.from(files).forEach(file => {
                this.processFile(file);
            });
        }
    }
    processFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data)) {
                    const validData = data.filter(item => {
                        return item && item.gameId && item.cheatName;
                    });

                    if (validData.length === 0) {
                        console.error(`No valid data found in file ${file.name}`);
                        return;
                    }

                    const promises = validData.map(item => {
                        delete item.key;
                        return this._db.addData(item);
                    });

                    Promise.all(promises)
                        .then(() => {
                            this.renderTable(this.gameId);
                            console.log(`Successfully imported ${validData.length} items from ${file.name}`);
                        })
                        .catch(error => {
                            console.error('Error adding multiple data:', error);
                        });
                }
                else if (data && data.gameId && data.cheatName) {
                    delete data.key;
                    this._db.addData(data)
                        .then(() => {
                            this.renderTable(this.gameId);
                            console.log(`Successfully imported cheat "${data.cheatName}" from ${file.name}`);
                        })
                        .catch(error => {
                            console.error('Error adding data:', error);
                        });
                } else {
                    console.error(`Invalid data format in file ${file.name}`);
                }
            } catch (error) {
                console.error(`Error parsing file ${file.name}:`, error);
            }
        };
        reader.readAsText(file);
    }
}
