const STORAGE_KEY = 'hyber-cheat:globalStepTemplate';

export const StepTemplateStore = {
    save(data) {
        const clone = { ...(data || {}) };
        delete clone.index;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clone));
    },

    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    },

    clone() {
        const data = this.load();
        if (!data) return {};
        try {
            return JSON.parse(JSON.stringify(data));
        } catch {
            return { ...data };
        }
    },

    matches(stepData) {
        const template = this.load();
        if (!template || !stepData) return false;
        const clone = { ...stepData };
        delete clone.index;
        try {
            return JSON.stringify(clone) === JSON.stringify(template);
        } catch {
            return false;
        }
    },
};
