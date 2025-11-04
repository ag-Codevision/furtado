import { SavedQuery } from '@/src/types';

const COMPLEX_QUERY_HISTORY_KEY = 'furtadoAdvocaciaComplexQueryHistory';

// Helper function to get queries from localStorage
const getHistory = (): SavedQuery[] => {
    try {
        const historyString = localStorage.getItem(COMPLEX_QUERY_HISTORY_KEY);
        return historyString ? JSON.parse(historyString) : [];
    } catch (error) {
        console.error("Failed to parse complex query history from localStorage:", error);
        return [];
    }
};

// Helper function to save queries to localStorage
const saveHistory = (queries: SavedQuery[]): void => {
    try {
        localStorage.setItem(COMPLEX_QUERY_HISTORY_KEY, JSON.stringify(queries));
    } catch (error) {
        console.error("Failed to save complex query history to localStorage:", error);
    }
};

// CREATE
export const addQuery = (title: string, content: string): SavedQuery => {
    const queries = getHistory();
    const newQuery: SavedQuery = {
        id: crypto.randomUUID(),
        title,
        content,
        savedAt: new Date().toISOString(),
    };
    const updatedQueries = [newQuery, ...queries];
    saveHistory(updatedQueries);
    return newQuery;
};

// READ
export const getAllQueries = (): SavedQuery[] => {
    return getHistory();
};

// UPDATE
export const updateQuery = (id: string, updates: Partial<Omit<SavedQuery, 'id' | 'savedAt'>>): void => {
    const queries = getHistory();
    const queryIndex = queries.findIndex(p => p.id === id);
    if (queryIndex > -1) {
        queries[queryIndex] = { ...queries[queryIndex], ...updates };
        saveHistory(queries);
    } else {
        console.warn(`Query with id ${id} not found for update.`);
    }
};

// DELETE
export const deleteQuery = (id: string): void => {
    const queries = getHistory();
    const updatedQueries = queries.filter(p => p.id !== id);
    saveHistory(updatedQueries);
};