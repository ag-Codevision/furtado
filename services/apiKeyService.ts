const API_KEY_STORAGE_KEY = 'gemini_api_key';

export const getApiKey = (): string | null => {
    // First, try to get from localStorage, which is set by the user in the UI
    const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (storedKey) {
        return storedKey;
    }
    // Fallback to the environment variable if localStorage is empty
    const envKey = process.env.GEMINI_API_KEY;
    if (envKey) {
        return envKey;
    }
    return null;
};

export const setApiKey = (key: string): void => {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
};