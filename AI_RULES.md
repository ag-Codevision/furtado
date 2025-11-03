# AI Development Rules for Furtado Office IA Studio

This document outlines the technical stack and coding conventions for the AI developer working on this project. Adhering to these rules ensures consistency, maintainability, and stability.

## Tech Stack Overview

The application is built with a modern, lightweight tech stack. Here are the key technologies:

-   **Framework:** React 19 with TypeScript for building the user interface.
-   **Build Tool:** Vite is used for fast development and optimized builds.
-   **Styling:** Tailwind CSS is used for all styling, loaded directly via a CDN in `index.html`.
-   **AI Integration:** The official `@google/genai` library is used for all interactions with the Google Gemini API.
-   **UI Components:** The project uses a set of custom-built UI components located in `src/components/ui`. There is no third-party component library like Shadcn/UI or Material-UI.
-   **State Management:** Application state is managed using React's built-in hooks (`useState`, `useEffect`, `useCallback`).
-   **Routing:** Navigation is handled by a simple state-based router within `App.tsx`, not a library like React Router.
-   **Client-side Storage:** User history and generated content are persisted in the browser using `localStorage`, managed through dedicated service files.
-   **File Handling:** Specific client-side libraries are used for document processing:
    -   **Mammoth.js** for parsing `.docx` files.
    -   **XLSX.js** for parsing `.xlsx` files.
    -   **html2pdf.js** for generating `.pdf` files from HTML.

## Library and Code Architecture Rules

To maintain a clean and simple codebase, please follow these rules:

1.  **Styling:**
    -   **ONLY** use Tailwind CSS utility classes for styling.
    -   Do **NOT** write custom CSS files or use inline `style` attributes unless absolutely necessary for dynamic properties.
    -   All components should be responsive.

2.  **UI Components:**
    -   When creating new UI elements, first check if a suitable component exists in `src/components/ui/index.tsx`.
    -   If a new component is needed, create it as a small, single-purpose function. Do **NOT** install external component libraries.
    -   Icons should be implemented as inline SVGs.

3.  **State Management:**
    -   Continue using React's built-in hooks for state management.
    -   Avoid introducing complex state management libraries like Redux or Zustand.

4.  **AI Service Layer:**
    -   All calls to the Gemini API **MUST** be made through the functions in `src/services/geminiService.ts`.
    -   Do not instantiate the `GoogleGenAI` client or make API calls directly from components.

5.  **Local Storage Management:**
    -   All interactions with `localStorage` **MUST** go through the dedicated service files (`historyService.ts`, `postHistoryService.ts`, etc.).
    -   This centralizes data management and makes it easier to maintain.

6.  **Routing:**
    -   The app uses a state-based system in `App.tsx` to render different panels. Continue this pattern.
    -   Do **NOT** install or use `react-router-dom`.

7.  **File Handling:**
    -   Use the globally available `mammoth`, `XLSX`, and `html2pdf` objects for document processing, as they are loaded via CDN.
    -   Encapsulate file processing logic within the relevant service or component.