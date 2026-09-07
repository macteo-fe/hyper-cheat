const STORAGE_KEY = 'hyber-cheat:stepTemplateByGame';
const LEGACY_GLOBAL_KEY = 'hyber-cheat:globalStepTemplate';

function normalizeGameId(gameId) {
    if (gameId == null || gameId === '') return null;
    return String(gameId);
}

function stripIndex(data) {
    const clone = { ...(data || {}) };
    delete clone.index;
    return clone;
}

function readAll() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeAll(map) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map || {}));
}

// Drop the old single global template so it cannot leak across games.
try {
    localStorage.removeItem(LEGACY_GLOBAL_KEY);
} catch {
    // ignore
}

export const StepTemplateStore = {
    save(gameId, data) {
        const key = normalizeGameId(gameId);
        if (!key) return;
        const map = readAll();
        map[key] = stripIndex(data);
        writeAll(map);
    },

    load(gameId) {
        const key = normalizeGameId(gameId);
        if (!key) return null;
        const map = readAll();
        return map[key] || null;
    },

    clear(gameId) {
        const key = normalizeGameId(gameId);
        if (!key) return false;
        const map = readAll();
        if (!(key in map)) return false;
        delete map[key];
        writeAll(map);
        return true;
    },

    clone(gameId) {
        const data = this.load(gameId);
        if (!data) return {};
        try {
            return JSON.parse(JSON.stringify(data));
        } catch {
            return { ...data };
        }
    },

    matches(gameId, stepData) {
        const template = this.load(gameId);
        if (!template || !stepData) return false;
        const clone = stripIndex(stepData);
        try {
            return JSON.stringify(clone) === JSON.stringify(template);
        } catch {
            return false;
        }
    },
};
