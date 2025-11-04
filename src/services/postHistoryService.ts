import { SavedPost, PostResult } from '@/src/types';

const POST_HISTORY_KEY = 'furtadoAdvocaciaPostHistory';

// Helper function to get posts from localStorage
const getHistory = (): SavedPost[] => {
    try {
        const historyString = localStorage.getItem(POST_HISTORY_KEY);
        return historyString ? JSON.parse(historyString) : [];
    } catch (error) {
        console.error("Failed to parse post history from localStorage:", error);
        return [];
    }
};

// Helper function to save posts to localStorage
const saveHistory = (posts: SavedPost[]): void => {
    try {
        localStorage.setItem(POST_HISTORY_KEY, JSON.stringify(posts));
    } catch (error) {
        console.error("Failed to save post history to localStorage:", error);
    }
};

// CREATE
export const addPost = (post: PostResult): SavedPost => {
    const posts = getHistory();
    const newPost: SavedPost = {
        id: crypto.randomUUID(),
        savedAt: new Date().toISOString(),
        post,
    };
    const updatedPosts = [newPost, ...posts];
    saveHistory(updatedPosts);
    return newPost;
};

// READ
export const getAllPosts = (): SavedPost[] => {
    return getHistory();
};

// UPDATE
export const updatePost = (id: string, updates: Partial<Omit<SavedPost, 'id' | 'savedAt'>>): void => {
    const posts = getHistory();
    const postIndex = posts.findIndex(p => p.id === id);
    if (postIndex > -1) {
        posts[postIndex] = { ...posts[postIndex], ...updates };
        saveHistory(posts);
    } else {
        console.warn(`Post with id ${id} not found for update.`);
    }
};

// DELETE
export const deletePost = (id: string): void => {
    const posts = getHistory();
    const updatedPosts = posts.filter(p => p.id !== id);
    saveHistory(updatedPosts);
};