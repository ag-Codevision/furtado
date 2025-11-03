import { SavedPetition } from '../types';

const HISTORY_KEY = 'furtadoAdvocaciaHistory';

// Helper function to get petitions from localStorage
const getHistory = (): SavedPetition[] => {
    try {
        const historyString = localStorage.getItem(HISTORY_KEY);
        return historyString ? JSON.parse(historyString) : [];
    } catch (error) {
        console.error("Failed to parse history from localStorage:", error);
        return [];
    }
};

// Helper function to save petitions to localStorage
const saveHistory = (petitions: SavedPetition[]): void => {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(petitions));
    } catch (error) {
        console.error("Failed to save history to localStorage:", error);
    }
};

// CREATE
export const addPetition = (title: string, content: string): SavedPetition => {
    const petitions = getHistory();
    const newPetition: SavedPetition = {
        id: crypto.randomUUID(),
        title,
        content,
        savedAt: new Date().toISOString(),
    };
    const updatedPetitions = [newPetition, ...petitions];
    saveHistory(updatedPetitions);
    return newPetition;
};

// READ
export const getAllPetitions = (): SavedPetition[] => {
    return getHistory();
};

// UPDATE
export const updatePetition = (id: string, updates: Partial<Omit<SavedPetition, 'id' | 'savedAt'>>): void => {
    const petitions = getHistory();
    const petitionIndex = petitions.findIndex(p => p.id === id);
    if (petitionIndex > -1) {
        petitions[petitionIndex] = { ...petitions[petitionIndex], ...updates };
        saveHistory(petitions);
    } else {
        console.warn(`Petition with id ${id} not found for update.`);
    }
};

// DELETE
export const deletePetition = (id: string): void => {
    const petitions = getHistory();
    const updatedPetitions = petitions.filter(p => p.id !== id);
    saveHistory(updatedPetitions);
};