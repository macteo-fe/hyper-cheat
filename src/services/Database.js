export class Database {
    constructor() {
        if (Database.instance) return Database.instance;
        //indexedDB.deleteDatabase("CheatDataBase");
        this._initApp();
    }

    _initApp() {
        const request = indexedDB.open("CheatDataBase", 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            db.createObjectStore("objectStore", { keyPath: "key", autoIncrement: true });
        };
        request.onsuccess = (event) => {
            Database.instance = this;
            this._db = event.target.result;
            this.onload && this.onload();
            console.log("Database opened successfully");
            window.db = this;
        };
        request.onerror = (event) => {
            console.log("Error opening database:", event.target.error);
        };
    }

    _handleTransaction(storeName, mode, operation, data) {
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);
            const request = store[operation](data);
            request.onsuccess = () => {
                console.log(`${operation} operation successful:`, request.result);
                resolve(request.result);
            };
            request.onerror = (event) => {
                console.log(`Error during ${operation} operation:`, event.target.error);
                reject(event.target.error);
            };
        });
    }

    async addData(data) {
        const existingData = await this.getAllData();
        const duplicate = existingData.find(item => item.cheatName === data.cheatName && item.gameId === data.gameId);
        if (duplicate) {
            let newCheatName = duplicate.cheatName;
            let counter = 2;
            while (existingData.find(item => item.cheatName === newCheatName && item.gameId === data.gameId)) {
                newCheatName = `${duplicate.cheatName}_${counter}`;
                counter++;
            }
            const updatedData = { ...data, cheatName: newCheatName };
            return this._handleTransaction("objectStore", "readwrite", "add", updatedData);
        }
        return this._handleTransaction("objectStore", "readwrite", "add", data);
    }

    async getDataByKey(key) {
        return this._handleTransaction("objectStore", "readonly", "get", key);
    }

    async getAllData() {
        return this._handleTransaction("objectStore", "readonly", "getAll");
    }

    async updateData(data) {
        return this._handleTransaction("objectStore", "readwrite", "put", data);
    }

    async deleteData(id) {
        return this._handleTransaction("objectStore", "readwrite", "delete", id);
    }

    async deleteAllData() {
        return this._handleTransaction("objectStore", "readwrite", "clear");
    }

    async getDataByGameID(gameId) {
        if (!gameId) return [];
        const allData = await this.getAllData();
        return allData.filter(item => item.gameId === gameId);
    }
    async updateCheatName(key, newCheatName) {
        const data = await this.getDataByKey(key);
        if (!data) {
            throw new Error("Data not found");
        }
        data.cheatName = newCheatName;
        return this.updateData(data);
    }
}
