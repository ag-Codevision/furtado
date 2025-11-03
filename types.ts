

export enum Feature {
  Dashboard = "Dashboard",
  MeuHistorico = "Meu Histórico",
  FerramentasIA = "Ferramentas de IA",
}

export enum AITool {
  PeticaoInicial = "Petição Inicial Trabalhista",
  PostGeneration = "Geração de Posts",
  ComplexQuery = "Consulta Complexa",
}

export const postFormats = [
    { name: 'Feed Instagram (Retrato 4:5) - 1080x1350px', value: '4:5' },
    { name: 'Feed Instagram (Quadrado 1:1) - 1080x1080px', value: '1:1' },
    { name: 'Stories / Reels (Vertical 9:16) - 1080x1920px', value: '9:16' },
    { name: 'YouTube / LinkedIn (Paisagem 16:9) - 1920x1080px', value: '16:9' },
    { name: 'Apresentação (Paisagem 4:3) - 1024x768px', value: '4:3' },
    { name: 'Pin para Pinterest (Vertical 3:4) - 1080x1440px', value: '3:4' },
] as const;

export type PostFormat = typeof postFormats[number]['value'];


export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "4:5";

export const aspectRatios: AspectRatio[] = ["1:1", "16:9", "9:16", "4:3", "3:4", "4:5"];

export interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}

export interface PostContent {
  title: string;
  subtitle: string;
  copy: string;
  hashtags: string[];
  seoKeywords: string[];
}

export interface SavedPetition {
  id: string;
  title: string;
  content: string;
  savedAt: string;
}

export interface SavedQuery {
  id: string;
  title: string;
  content: string;
  savedAt: string;
}

export interface PostResult {
    postContent: PostContent;
    imageUrlWithText: string;
    imageUrlWithoutText: string;
}
export interface SavedPost {
  id: string;
  savedAt: string;
  post: PostResult;
}

export interface UnifiedItem {
    id: string;
    title: string;
    savedAt: string;
    type: 'Petição' | 'Post' | 'Consulta';
}

export type InitialHistoryItem = {
    id: string;
    type: UnifiedItem['type'];
} | null;