

import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as geminiService from '../services/geminiService';
import * as historyService from '../services/historyService';
import * as postHistoryService from '../services/postHistoryService';
import * as complexQueryHistoryService from '../services/complexQueryHistoryService';
import { PostContent, postFormats, PostFormat, SavedPetition, PostResult, SavedPost, SavedQuery, AITool, UnifiedItem, InitialHistoryItem } from '../types';
import { Card, Spinner, FileUpload, Modal, DocumentUpload, TabButton, validateFile } from './ui/index';

// Declaration for client-side library loaded via script tag
declare const html2pdf: any;


// =================================================================================================
// Reusable Petition Viewer & Logic
// =================================================================================================

const copyPetitionToClipboard = (text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!text) {
            return reject(new Error("No text to copy."));
        }
        
        try {
            let formattedContent = '';
            text.split('\n').forEach(line => {
                if (line.trim() === '') {
                    formattedContent += `<p>&nbsp;</p>`;
                } else {
                    const isTitle = line.trim() === line.trim().toUpperCase() && 
                                    line.trim().length > 0 && 
                                    !line.includes('[') && 
                                    line.trim().length < 80;
                    if (isTitle) {
                        formattedContent += `<p style="font-weight: bold; text-transform: uppercase; text-align: justify; line-height: 1.5; margin: 0; padding: 0;">${line}</p>`;
                    } else {
                        formattedContent += `<p style="text-indent: 1.25cm; text-align: justify; line-height: 1.5; margin: 0; padding: 0;">${line}</p>`;
                    }
                }
            });

            const fullHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: 'Bookman Old Style', serif; font-size: 12pt; }
                    </style>
                </head>
                <body>${formattedContent}</body>
                </html>
            `;
    
            const blob = new Blob([fullHtml], { type: 'text/html' });
            const clipboardItem = new ClipboardItem({ 'text/html': blob });
    
            navigator.clipboard.write([clipboardItem]).then(resolve, reject);
        } catch (error) {
            console.error("Falha ao copiar HTML, tentando texto simples:", error);
            navigator.clipboard.writeText(text).then(resolve, reject);
        }
    });
};


const FormattedPetitionViewer: React.FC<{ text: string }> = ({ text }) => {
    if (!text) return null;
    const regexPlaceholder = /(\[INFORMAÇÃO NÃO ENCONTRADA NO DOCUMENTO\])/g;

    return (
        <div
            className="bg-white text-black mx-auto max-w-4xl rounded-lg shadow-lg"
            style={{
                fontFamily: "'Bookman Old Style', serif",
                fontSize: '12pt',
                padding: '2.5cm 2.0cm 2.5cm 3.0cm'
            }}
        >
            {text.split('\n').map((line, lineIndex) => {
                const isTitle = line.trim() === line.trim().toUpperCase() &&
                                line.trim().length > 0 &&
                                !line.includes('[') &&
                                line.trim().length < 80;
                
                if (line.trim() === '') return <div key={lineIndex} style={{ height: '0.75em' }}></div>;

                const parts = line.split(regexPlaceholder);
                
                return (
                    <p
                        key={lineIndex}
                        style={{
                            textIndent: isTitle ? '0' : '1.25cm',
                            fontWeight: isTitle ? 'bold' : 'normal',
                            textTransform: isTitle ? 'uppercase' : 'none',
                            textAlign: 'justify',
                            lineHeight: '1.5',
                            margin: 0,
                            padding: 0,
                        }}
                    >
                        {parts.map((part, partIndex) =>
                            regexPlaceholder.test(part) ? (
                                <span key={partIndex} className="text-red-500 font-bold">{part}</span>
                            ) : (
                                part
                            )
                        )}
                    </p>
                );
            })}
        </div>
    );
};


// =================================================================================================
// Ferramentas de IA - Painel de Seleção e Roteador
// =================================================================================================

interface AIToolCardProps {
    tool: {
        id: string;
        title: string;
        description: string;
        icon: React.ReactNode;
        enabled: boolean;
    };
    onSelect: () => void;
}

const AIToolCard: React.FC<AIToolCardProps> = ({ tool, onSelect }) => {
    return (
        <div className={`
            bg-[#2a2a2a] border border-neutral-800 rounded-xl p-6 flex flex-col shadow-lg
            transition-all duration-300
            ${tool.enabled 
                ? 'opacity-100 hover:border-amber-700 hover:shadow-amber-900/20' 
                : 'opacity-50 filter blur-sm pointer-events-none'}
        `}>
            <div className="flex items-center gap-4 mb-4">
                <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-700">{tool.icon}</div>
                <h3 className="font-bold text-lg text-white">{tool.title}</h3>
            </div>
            <p className="text-neutral-400 text-sm mb-6 flex-grow">{tool.description}</p>
            <button 
                onClick={onSelect}
                disabled={!tool.enabled}
                className="w-full mt-auto py-2.5 bg-[#d4af37] text-black font-bold rounded-md hover:bg-[#c8a35f] transition-colors text-sm"
            >
                Usar Modelo
            </button>
        </div>
    );
};

const AIToolsSelectionPanel: React.FC<{ onToolSelect: (tool: AITool) => void }> = ({ onToolSelect }) => {
    const peticaoIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#d4af37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
    const postIcon = <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[#d4af37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;

    const enabledTools = [
        { id: AITool.PeticaoInicial, title: "Petição Inicial Trabalhista", description: "Modelo completo para ajuizamento de reclamações trabalhistas, incluindo pedidos de horas extras, verbas rescisórias e danos morais.", icon: peticaoIcon, enabled: true },
        { id: AITool.PostGeneration, title: "Geração de Posts por IA", description: "Crie posts completos, com texto e imagem, para as suas redes sociais. Ideal para conteúdo jurídico informativo e profissional.", icon: postIcon, enabled: true },
    ];

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white">Ferramentas de IA</h1>
                <p className="text-neutral-400 mt-2">Otimize seu fluxo de trabalho com nossas ferramentas inteligentes.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {enabledTools.map(tool => (
                    <AIToolCard 
                        key={tool.id} 
                        tool={tool} 
                        onSelect={() => onToolSelect(tool.id as AITool)} 
                    />
                ))}
            </div>
        </div>
    );
};

interface AIToolsPageProps {
    activeTool: AITool | null;
    onToolSelect: (tool: AITool | null) => void;
}
export const AIToolsPage: React.FC<AIToolsPageProps> = ({ activeTool, onToolSelect }) => {
    const [peticaoResult, setPeticaoResult] = useState<string | null>(null);
    const [postResult, setPostResult] = useState<PostResult | null>(null);
    const [queryResult, setQueryResult] = useState<string | null>(null);

    const handleBack = () => {
        onToolSelect(null);
    };

    if (!activeTool) {
        return <AIToolsSelectionPanel onToolSelect={onToolSelect} />;
    }

    switch (activeTool) {
        case AITool.PeticaoInicial:
            return <PeticaoInicialPanel result={peticaoResult} setResult={setPeticaoResult} onBack={handleBack} />;
        case AITool.PostGeneration:
            return <PostGeneratorPanel result={postResult} setResult={setPostResult} onBack={handleBack} />;
        case AITool.ComplexQuery:
            return <ComplexQueryPanel result={queryResult} setResult={setQueryResult} onBack={handleBack} />;
        default:
            return <AIToolsSelectionPanel onToolSelect={onToolSelect} />;
    }
};

// =================================================================================================
// Ferramentas de IA - Painéis Individuais
// =================================================================================================

interface PostResultDisplayProps {
    result: PostResult;
    onRegenerate: () => void;
    onRegenerateImage: () => void;
    isImageLoading: boolean;
    onImageClick: (src: string) => void;
    onDownloadTexts: () => void;
    onSaveToHistory: () => void;
    saveStatus: 'idle' | 'success' | 'error';
}

const PostResultDisplay: React.FC<PostResultDisplayProps> = ({ result, onRegenerate, onRegenerateImage, isImageLoading, onImageClick, onDownloadTexts, onSaveToHistory, saveStatus }) => {
    const { postContent, imageUrl } = result;

    const handleDownloadImage = () => {
        try {
            const link = document.createElement('a');
            link.href = imageUrl;
            const filename = `${postContent.title.toLowerCase().replace(/\s+/g, '-')}.png`;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Falha ao baixar a imagem:", error);
            alert('Ocorreu um erro ao tentar baixar a imagem. O seu navegador pode estar bloqueando downloads automáticos.');
        }
    };
    
    const saveButtonText = {
        idle: "Salvar no Histórico",
        success: "Salvo com sucesso!",
        error: "Erro ao salvar"
    };

    const saveButtonClasses = {
        idle: "bg-[#d4af37] hover:bg-[#c8a35f]",
        success: "bg-green-600 hover:bg-green-700",
        error: "bg-red-700 hover:bg-red-800"
    };

    return (
        <Card className="mt-4 bg-[#2a2a2a]/50">
            <h3 className="font-semibold text-lg mb-4 text-amber-200">Post Gerado</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="w-full space-y-4">
                     <div className="grid grid-cols-1 gap-2">
                         <div className="relative w-full rounded-lg overflow-hidden group">
                            <button onClick={() => onImageClick(imageUrl)} className="w-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-900 focus:ring-amber-500 rounded-lg">
                                <img 
                                    src={imageUrl} 
                                    alt="Criativo do post" 
                                    className="w-full h-auto shadow-lg group-hover:opacity-90 transition-opacity" 
                                />
                            </button>
                             {isImageLoading && (
                                <div className="absolute inset-0 bg-black bg-opacity-60 flex justify-center items-center rounded-lg">
                                    <Spinner />
                                </div>
                            )}
                         </div>
                     </div>
                     <div className="space-y-2">
                         <button onClick={onSaveToHistory} className={`w-full px-4 py-3 text-black font-bold rounded-md transition-colors text-sm ${saveButtonClasses[saveStatus]}`}>
                           {saveButtonText[saveStatus]}
                         </button>
                         <div className="grid grid-cols-2 gap-2">
                           <button onClick={onRegenerateImage} disabled={isImageLoading} className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-amber-200 font-bold rounded-md transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                               {isImageLoading ? <Spinner/> : 'Gerar Nova Imagem'}
                           </button>
                           <button onClick={handleDownloadImage} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-300 font-bold rounded-md transition-colors text-sm">
                               Baixar Imagem
                           </button>
                           <button onClick={onRegenerate} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-300 font-bold rounded-md transition-colors text-sm col-span-2">
                               Gerar Tudo Novamente
                           </button>
                            <button onClick={onDownloadTexts} className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-amber-200 font-bold rounded-md transition-colors text-sm col-span-2">
                               Baixar Texto (Word)
                           </button>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <div>
                        <h4 className="font-bold text-md text-amber-300">Título</h4>
                        <p className="text-yellow-100 mt-1">{postContent.title}</p>
                    </div>
                     <div>
                        <h4 className="font-bold text-md text-amber-300">Subtítulo</h4>
                        <p className="text-yellow-100 mt-1">{postContent.subtitle}</p>
                    </div>
                    <div>
                        <h4 className="font-bold text-md text-amber-300">Copy (Legenda)</h4>
                        <p className="text-yellow-100 mt-1 whitespace-pre-wrap">{postContent.copy}</p>
                    </div>
                    <div>
                        <h4 className="font-bold text-md text-amber-300">Hashtags</h4>
                        <p className="text-amber-400 mt-1">{postContent.hashtags.join(' ')}</p>
                    </div>
                     <div>
                        <h4 className="font-bold text-md text-amber-300">Palavras-chave (SEO)</h4>
                        <p className="text-yellow-200 mt-1">{postContent.seoKeywords.join(', ')}</p>
                    </div>
                </div>
            </div>
        </Card>
    );
};

interface PostGeneratorPanelProps {
    result: PostResult | null;
    setResult: (result: PostResult | null) => void;
    onBack: () => void;
}

export const PostGeneratorPanel: React.FC<PostGeneratorPanelProps> = ({ result, setResult, onBack }) => {
    const [theme, setTheme] = useState<string>('Direitos do trabalhador em caso de demissão sem justa causa.');
    const [styleImageFile, setStyleImageFile] = useState<File | null>(null);
    const [logoImageFile, setLogoImageFile] = useState<File | null>(null);
    const [aspectRatio, setAspectRatio] = useState<PostFormat>(postFormats[0].value);
    const [isLoading, setIsLoading] = useState(false);
    const [isImageLoading, setIsImageLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalImageSrc, setModalImageSrc] = useState('');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');


    const handleSubmit = async () => {
        if (!theme || !aspectRatio) {
            setError('Por favor, preencha o tema e selecione um formato para o post.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult(null);
        try {
            const post = await geminiService.generatePost(theme, styleImageFile, logoImageFile, aspectRatio);
            setResult(post);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegenerateImage = async () => {
        if (!result) return;
        setIsImageLoading(true);
        setError(null);
        try {
            const imageUrl = await geminiService.generateImage(result.postContent, styleImageFile, logoImageFile, aspectRatio);
            setResult({ ...result, imageUrl });
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsImageLoading(false);
        }
    };
    
    const handleSaveToHistory = () => {
        if (result) {
            try {
                postHistoryService.addPost(result);
                setSaveStatus('success');
            } catch (e) {
                console.error("Failed to save post to history", e);
                setSaveStatus('error');
            } finally {
                setTimeout(() => setSaveStatus('idle'), 3000);
            }
        }
    };

    const handleDownloadTexts = () => {
        try {
            if (!result) return;
            const { postContent } = result;

            const contentHtml = `
                <!DOCTYPE html>
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                    <meta charset="utf-8">
                    <title>${postContent.title}</title>
                </head>
                <body>
                    <h1>${postContent.title}</h1>
                    <h2>${postContent.subtitle}</h2>
                    <p>${postContent.copy.replace(/\n/g, '<br />')}</p>
                    <hr/>
                    <h3>Hashtags</h3>
                    <p>${postContent.hashtags.join(' ')}</p>
                    <h3>Palavras-chave (SEO)</h3>
                    <p>${postContent.seoKeywords.join(', ')}</p>
                </body>
                </html>
            `;

            const blob = new Blob([contentHtml], { type: 'application/msword' });
            const link = document.createElement('a');
            const filename = `${postContent.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.doc`;
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error("Falha ao baixar os textos:", error);
            alert('Ocorreu um erro ao tentar baixar o arquivo de textos. O seu navegador pode estar bloqueando downloads automáticos.');
        }
    };

    const openModal = (src: string) => {
        setModalImageSrc(src);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    const canSubmit = !isLoading && !!theme && !!aspectRatio;

    return (
        <>
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="text-neutral-400 hover:text-white" aria-label="Voltar"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
                <div>
                    <h1 className="text-2xl font-bold text-white">Geração de Posts para Redes Sociais</h1>
                    <p className="text-neutral-400">Crie conteúdo visual e textual de forma rápida e profissional.</p>
                </div>
            </div>
            <Card>
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-amber-300">Geração de Posts</h2>
                    <div>
                        <label htmlFor="post-theme" className="block text-sm font-medium text-amber-200 mb-2">Tema ou Título do Post</label>
                        <textarea
                            id="post-theme"
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                            placeholder="Digite o tema para gerar o post completo..."
                            className="w-full p-2 bg-neutral-900 border border-neutral-700 rounded-md focus:ring-2 focus:ring-amber-500 focus:outline-none text-yellow-100"
                            rows={2}
                        />
                    </div>
                     <div>
                        <label htmlFor="post-format" className="block text-sm font-medium text-amber-200 mb-2">Formato do Post</label>
                        <select
                            id="post-format"
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value as PostFormat)}
                            className="w-full p-2 bg-neutral-900 border border-neutral-700 rounded-md focus:ring-2 focus:ring-amber-500 focus:outline-none text-yellow-100"
                        >
                            {postFormats.map(format => (
                                <option key={format.value} value={format.value}>{format.name}</option>
                            ))}
                        </select>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-amber-200 mb-2">Imagem de Referência de Estilo <span className="text-neutral-400">(Opcional)</span></label>
                            <FileUpload onFileSelect={setStyleImageFile} onFileRemove={() => setStyleImageFile(null)} id="style-ref-upload" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium text-amber-200 mb-2">Logo do Escritório <span className="text-neutral-400">(Opcional)</span></label>
                            <FileUpload onFileSelect={setLogoImageFile} onFileRemove={() => setLogoImageFile(null)} id="logo-upload" />
                        </div>
                    </div>

                    <button onClick={handleSubmit} disabled={!canSubmit} className="w-full px-4 py-3 bg-amber-600 hover:bg-amber-700 text-black font-bold rounded-md disabled:bg-neutral-800 disabled:cursor-not-allowed flex items-center justify-center transition-colors">
                        {isLoading ? <Spinner /> : 'Gerar Post Completo'}
                    </button>
                </div>
                {isLoading && <div className="mt-4 flex justify-center"><Spinner /></div>}
                {error && <div className="mt-4 p-3 bg-red-900 border border-red-700 text-red-200 rounded-md">{error}</div>}
            </Card>
            
            {result && !isLoading && (
                <PostResultDisplay
                    result={result}
                    onRegenerate={handleSubmit}
                    onRegenerateImage={handleRegenerateImage}
                    isImageLoading={isImageLoading}
                    onImageClick={openModal}
                    onDownloadTexts={handleDownloadTexts}
                    onSaveToHistory={handleSaveToHistory}
                    saveStatus={saveStatus}
                />
            )}

            {isModalOpen && <Modal src={modalImageSrc} onClose={closeModal} />}
        </>
    );
};

interface ComplexQueryPanelProps {
    result: string | null;
    setResult: (result: string | null) => void;
    onBack: () => void;
}

export const ComplexQueryPanel: React.FC<ComplexQueryPanelProps> = ({ result, setResult, onBack }) => {
    const [prompt, setPrompt] = useState<string>('Forneça uma análise detalhada sobre a equiparação salarial no direito do trabalho brasileiro, citando os requisitos do Art. 461 da CLT e o entendimento jurisprudencial atual do TST.');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [queryTitle, setQueryTitle] = useState('');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [copyStatus, setCopyStatus] = useState(false);


    const handleSubmit = async () => {
        if (!prompt) {
            setError('Por favor, digite uma consulta complexa.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult(null);
        try {
            const text = await geminiService.complexQuery(prompt);
            setResult(text);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleStartSave = () => {
        setIsSaving(true);
        setQueryTitle(`Consulta - ${new Date().toLocaleDateString('pt-BR')}`);
        setSaveStatus('idle');
    };
    
    const handleCopy = () => {
        if (!result) return;
        navigator.clipboard.writeText(result).then(() => {
            setCopyStatus(true);
            setTimeout(() => setCopyStatus(false), 2000);
        });
    };

    const handleConfirmSave = () => {
        if (!result || !queryTitle) return;
        try {
            complexQueryHistoryService.addQuery(queryTitle, result);
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } catch (error) {
            console.error("Falha ao salvar no histórico:", error);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 3000);
        } finally {
            setIsSaving(false);
            setQueryTitle('');
        }
    };

    const handleCancelSave = () => {
        setIsSaving(false);
        setQueryTitle('');
    };

    return (
        <>
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="text-neutral-400 hover:text-white" aria-label="Voltar"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
                <div>
                    <h1 className="text-2xl font-bold text-white">Consulta Complexa</h1>
                    <p className="text-neutral-400">Obtenha respostas detalhadas para questões jurídicas complexas.</p>
                </div>
            </div>
            <Card>
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-amber-300">Consulta Complexa</h2>
                    <div>
                        <label htmlFor="complex-query" className="block text-sm font-medium text-amber-200 mb-2">Sua Pergunta</label>
                        <textarea
                            id="complex-query"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Digite sua consulta jurídica complexa aqui..."
                            className="w-full p-2 bg-neutral-900 border border-neutral-700 rounded-md focus:ring-2 focus:ring-amber-500 focus:outline-none text-yellow-100"
                            rows={5}
                        />
                    </div>
                    <button onClick={handleSubmit} disabled={isLoading || !prompt} className="w-full px-4 py-3 bg-amber-600 hover:bg-amber-700 text-black font-bold rounded-md disabled:bg-neutral-800 disabled:cursor-not-allowed flex items-center justify-center transition-colors">
                        {isLoading ? <Spinner /> : 'Enviar Consulta'}
                    </button>
                </div>
            </Card>

            {isLoading && <div className="mt-4 flex justify-center"><Spinner /></div>}
            {error && <div className="mt-4 p-3 bg-red-900 border border-red-700 text-red-200 rounded-md">{error}</div>}

            {result && !isLoading && (
                <Card className="mt-4 bg-neutral-900/50">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                         <h3 className="font-semibold text-lg text-amber-200 flex-shrink-0">Resultado da Consulta</h3>
                         {!isSaving ? (
                            <div className="flex items-center gap-2 w-full justify-end">
                                {saveStatus === 'idle' && (
                                    <>
                                        <button 
                                            onClick={handleCopy}
                                            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-300 font-bold rounded-md transition-colors text-sm"
                                        >
                                            {copyStatus ? 'Copiado!' : 'Copiar Texto'}
                                        </button>
                                        <button 
                                            onClick={handleStartSave}
                                            className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-amber-200 font-bold rounded-md transition-colors text-sm"
                                        >
                                            Salvar no Histórico
                                        </button>
                                    </>
                                )}
                                {saveStatus === 'success' && (
                                    <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                        <span>Salvo com sucesso!</span>
                                    </div>
                                )}
                                {saveStatus === 'error' && (
                                    <div className="flex items-center gap-2 text-red-400 text-sm font-semibold">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                        <span>Erro ao salvar. Tente novamente.</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                             <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto sm:justify-end">
                                <input
                                    type="text"
                                    value={queryTitle}
                                    onChange={(e) => setQueryTitle(e.target.value)}
                                    className="w-full sm:w-64 text-sm p-2 bg-neutral-800 border border-neutral-600 rounded-md focus:ring-1 focus:ring-amber-500 focus:outline-none text-yellow-100"
                                    placeholder="Título da consulta"
                                />
                                <div className="flex items-center gap-2 justify-end">
                                    <button onClick={handleConfirmSave} disabled={!queryTitle} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-black font-bold rounded-md transition-colors text-sm disabled:bg-neutral-800 disabled:cursor-not-allowed">
                                        Salvar
                                    </button>
                                    <button onClick={handleCancelSave} className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-amber-200 font-bold rounded-md transition-colors text-sm">
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="p-3 bg-neutral-950 border border-neutral-700 rounded-md max-h-[60vh] overflow-y-auto">
                      <p className="text-white whitespace-pre-wrap font-mono text-sm">{result}</p>
                    </div>
                </Card>
            )}
        </>
    );
};

interface PeticaoInicialPanelProps {
    result: string | null;
    setResult: (result: string | null) => void;
    onBack: () => void;
}

const ModeloFilePreview: React.FC<{ file: File, onRemove: () => void }> = ({ file, onRemove }) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        let objectUrl: string | null = null;
        if (file && file.type.startsWith('image/')) {
            objectUrl = URL.createObjectURL(file);
            setPreviewUrl(objectUrl);
        } else {
            setPreviewUrl(null);
        }

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [file]);
    
    const getFileIcon = () => {
        const name = file.name.toLowerCase();
        if (name.endsWith('.docx')) return <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
        return <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
    }

    return (
         <div className="relative group flex flex-col items-center justify-center text-center bg-neutral-800 p-2 rounded-md w-28 h-28 border border-neutral-600">
            <button onClick={onRemove} className="absolute -top-1 -right-1 p-0.5 text-neutral-300 hover:text-white bg-black/60 rounded-full z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="w-full h-full flex items-center justify-center overflow-hidden rounded-sm">
                 {previewUrl ? (
                    <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
                ) : (
                    getFileIcon()
                )}
            </div>
            {!previewUrl && (
                 <span className="text-[10px] text-yellow-100/80 truncate w-full absolute bottom-1 px-1" title={file.name}>
                    {file.name}
                 </span>
            )}
        </div>
    )
}

export const PeticaoInicialPanel: React.FC<PeticaoInicialPanelProps> = ({ result, setResult, onBack }) => {
    const [documentos, setDocumentos] = useState<File[]>([]);
    const [modeloFile, setModeloFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copyStatus, setCopyStatus] = useState(false);
    const modeloFileInputRef = useRef<HTMLInputElement>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [petitionTitle, setPetitionTitle] = useState('');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');


    const handleModeloFileSingle = useCallback((file: File | undefined) => {
        if (!file) return;

        const validation = validateFile(file, ".docx,.txt");
        if (!validation.isValid) {
            alert(validation.message);
            if (modeloFileInputRef.current) {
                modeloFileInputRef.current.value = '';
            }
            return;
        }
        setModeloFile(file);
    }, []);

    const handleModeloFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        handleModeloFileSingle(event.target.files?.[0]);
    };

    const handleRemoveModeloFile = () => {
        setModeloFile(null);
        if (modeloFileInputRef.current) {
            modeloFileInputRef.current.value = '';
        }
    };

    const handleModeloDragOver = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
    }, []);

    const handleModeloDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        handleModeloFileSingle(event.dataTransfer.files?.[0]);
    }, [handleModeloFileSingle]);


    const handleSubmit = async () => {
        if (documentos.length === 0) {
            setError('Por favor, anexe ao menos um documento do caso.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setResult(null);
        try {
            const text = await geminiService.generatePeticaoInicial(documentos, modeloFile);
            setResult(text);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartSave = () => {
        setIsSaving(true);
        setPetitionTitle(`Petição - ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}`);
        setSaveStatus('idle');
    };

    const handleConfirmSave = () => {
        if (!result || !petitionTitle) return;
        try {
            historyService.addPetition(petitionTitle, result);
            setSaveStatus('success');
        } catch (error) {
            console.error("Falha ao salvar petição no histórico:", error);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
            setTimeout(() => setSaveStatus('idle'), 3000);
        }
    };
    
    const handleCancelSave = () => {
        setIsSaving(false);
        setPetitionTitle('');
    };
    
    const handleCopyToClipboard = () => {
        if (!result) return;
        copyPetitionToClipboard(result)
            .then(() => {
                setCopyStatus(true);
                setTimeout(() => setCopyStatus(false), 2500);
            })
            .catch(err => {
                alert('Ocorreu um erro ao tentar copiar o texto.');
                console.error("Falha na cópia:", err);
            });
    };

    const canSubmit = !isLoading && documentos.length > 0;

    return (
        <div>
             <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="text-neutral-400 hover:text-white" aria-label="Voltar"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg></button>
                <div>
                    <h1 className="text-2xl font-bold text-white">Petição Inicial Trabalhista</h1>
                    <p className="text-neutral-400">Anexe as provas e deixe a IA extrair as informações para a petição.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start mb-6">
                <div className="p-4 bg-[#2a2a2a] rounded-lg">
                    <h2 className="text-sm font-semibold text-neutral-300 mb-2">1. Anexe os Documentos e Provas</h2>
                    <p className="text-xs text-neutral-400 mb-3">Formatos aceitos: .pdf, .docx, .xlsx, .txt, imagens.</p>
                    <DocumentUpload
                        onFileChange={setDocumentos}
                        id="documentos-upload"
                        accept=".pdf,.docx,.xlsx,.txt,image/*"
                    />
                </div>
                <div className="p-4 bg-[#2a2a2a] rounded-lg">
                    <h2 className="text-sm font-semibold text-neutral-300 mb-2">2. Modelo do Documento (Opcional)</h2>
                    <p className="text-xs text-neutral-400 mb-3">Envie um arquivo .docx ou .txt para ser usado como base.</p>
                     <div className="flex gap-4 items-center">
                        <label
                            htmlFor="modelo-upload-input"
                            onDragOver={handleModeloDragOver}
                            onDrop={handleModeloDrop}
                            className="flex flex-col flex-shrink-0 justify-center items-center w-48 h-32 p-4 transition bg-neutral-900 border-2 border-neutral-700 border-dashed rounded-md appearance-none cursor-pointer hover:border-amber-600 focus:outline-none"
                        >
                            <div className="text-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto w-8 h-8 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                <p className="mt-1 font-medium text-neutral-400 text-[10px] leading-tight">
                                    Arraste ou <span className="text-amber-400 underline cursor-pointer">procure</span>
                                </p>
                            </div>
                            <input type="file" id="modelo-upload-input" className="hidden" ref={modeloFileInputRef} onChange={handleModeloFileChange} accept=".docx,.txt" />
                        </label>
                        
                        <div className="w-48 h-32 flex items-center justify-center">
                           {modeloFile && <ModeloFilePreview file={modeloFile} onRemove={handleRemoveModeloFile} />}
                        </div>
                    </div>
                </div>
            </div>
            
             <div className="flex justify-center mb-6">
                <button onClick={handleSubmit} disabled={!canSubmit} className="w-full max-w-sm py-3 bg-[#d4af37] text-black font-bold rounded-md disabled:bg-neutral-700 disabled:text-neutral-400 disabled:cursor-not-allowed flex items-center justify-center transition-colors">
                    {isLoading ? <Spinner /> : 'Gerar Documento com IA'}
                </button>
            </div>

            <div className="bg-[#2a2a2a] rounded-lg p-1 relative min-h-[500px] h-full flex flex-col">
                <div className="flex justify-between items-center p-3 border-b border-neutral-700 flex-shrink-0">
                    <h2 className="text-sm font-semibold text-neutral-300">3. Resultado Gerado</h2>
                    {result && !isLoading && (
                         !isSaving ? (
                            <div className="flex items-center gap-4">
                                {saveStatus === 'idle' && (
                                    <>
                                        <button onClick={handleStartSave} className="text-xs font-semibold text-neutral-300 hover:text-white transition-colors">
                                            Salvar no Histórico
                                        </button>
                                        <button onClick={handleCopyToClipboard} className="flex items-center gap-1 text-xs font-semibold text-[#d4af37] hover:text-yellow-300 transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                            {copyStatus ? 'Copiado!' : 'Copiar Texto'}
                                        </button>
                                    </>
                                )}
                                {saveStatus === 'success' && (
                                    <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                        <span>Salvo com sucesso!</span>
                                    </div>
                                )}
                                {saveStatus === 'error' && (
                                    <div className="flex items-center gap-2 text-red-400 text-sm font-semibold">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                                        <span>Erro ao salvar.</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={petitionTitle}
                                    onChange={(e) => setPetitionTitle(e.target.value)}
                                    className="w-64 text-xs p-1.5 bg-neutral-800 border border-neutral-600 rounded-md focus:ring-1 focus:ring-amber-500 focus:outline-none text-yellow-100"
                                    placeholder="Título da petição"
                                />
                                <button onClick={handleConfirmSave} disabled={!petitionTitle} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-black font-bold rounded-md transition-colors text-xs disabled:bg-neutral-800 disabled:cursor-not-allowed">
                                    Salvar
                                </button>
                                <button onClick={handleCancelSave} className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-amber-200 font-bold rounded-md transition-colors text-xs">
                                    Cancelar
                                </button>
                            </div>
                        )
                    )}
                </div>
                 <div className="flex-grow p-8 overflow-y-auto" style={{ maxHeight: '70vh' }}>
                    {isLoading && <div className="pt-16 flex justify-center"><Spinner /></div>}
                    {error && <div className="p-3 bg-red-900/50 border border-red-700 text-red-200 rounded-md text-sm">{error}</div>}
                    {!isLoading && !error && result && <FormattedPetitionViewer text={result} />}
                    {!isLoading && !error && !result && <div className="flex items-center justify-center h-full text-neutral-500 text-sm">O resultado aparecerá aqui...</div>}
                </div>
            </div>
        </div>
    );
};

// =================================================================================================
// Painéis Principais (Dashboard, Histórico)
// =================================================================================================

interface DashboardPanelProps {
    setActiveFeature: (tool: AITool) => void;
    onRecentItemSelect: (item: UnifiedItem) => void;
}

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const TypeIcon: React.FC<{ type: UnifiedItem['type'] }> = ({ type }) => {
    switch (type) {
        case 'Petição':
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
        case 'Post':
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
        case 'Consulta':
            return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.546-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
        default:
            return null;
    }
};

export const DashboardPanel: React.FC<DashboardPanelProps> = ({ setActiveFeature, onRecentItemSelect }) => {
    const [stats, setStats] = useState({ petitions: 0, posts: 0, queries: 0 });
    const [recentItems, setRecentItems] = useState<UnifiedItem[]>([]);

    useEffect(() => {
        const petitions = historyService.getAllPetitions();
        const posts = postHistoryService.getAllPosts();
        const queries = complexQueryHistoryService.getAllQueries();

        setStats({
            petitions: petitions.length,
            posts: posts.length,
            queries: queries.length,
        });
        
        const allItems: UnifiedItem[] = [
            ...petitions.map(p => ({ ...p, type: 'Petição' as const })),
            ...posts.map(p => ({ id: p.id, title: p.post.postContent.title, savedAt: p.savedAt, type: 'Post' as const })),
            ...queries.map(q => ({ ...q, type: 'Consulta' as const }))
        ];

        allItems.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
        setRecentItems(allItems.slice(0, 5));
    }, []);

    const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: number }> = ({ icon, label, value }) => (
        <div className="bg-[#2a2a2a] p-4 rounded-lg flex items-center gap-4 border border-neutral-800">
            <div className="bg-neutral-900 p-3 rounded-md border border-neutral-700">
                {icon}
            </div>
            <div>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-sm text-neutral-400">{label}</p>
            </div>
        </div>
    );

    const ActionCard: React.FC<{ icon: React.ReactNode; title: string; description: string; onClick: () => void; }> = ({ icon, title, description, onClick }) => (
        <button 
            onClick={onClick}
            className="bg-[#2a2a2a] p-6 rounded-lg text-left w-full border border-neutral-800 hover:border-amber-700 transition-colors flex flex-col items-start h-full"
        >
            <div className="bg-neutral-900 p-3 rounded-md border border-neutral-700 mb-4">
                {icon}
            </div>
            <p className="font-semibold text-yellow-100 mb-1">{title}</p>
            <p className="text-sm text-neutral-400 flex-grow">{description}</p>
        </button>
    );

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white">Bem-vindo de volta, Dr. Silva</h1>
                <p className="text-neutral-400 mt-1">Aqui está um resumo da sua atividade recente.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                 <StatCard 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                    label="Petições Salvas"
                    value={stats.petitions}
                />
                 <StatCard 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                    label="Posts Criados"
                    value={stats.posts}
                />
                 <StatCard 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.546-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    label="Consultas Realizadas"
                    value={stats.queries}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                 <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-amber-200">Ações Rápidas</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                         <ActionCard 
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                            title="Nova Petição Inicial"
                            description="Gerar um novo documento jurídico."
                            onClick={() => setActiveFeature(AITool.PeticaoInicial)}
                        />
                         <ActionCard
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                            title="Novo Post"
                            description="Criar conteúdo para mídias sociais."
                            onClick={() => setActiveFeature(AITool.PostGeneration)}
                        />
                    </div>
                </div>

                <div className="bg-[#2a2a2a] p-6 rounded-lg border border-neutral-800">
                    <h3 className="text-xl font-semibold text-amber-200 mb-4">Atividade Recente</h3>
                    <div className="space-y-3">
                        {recentItems.length > 0 ? recentItems.map(item => (
                            <button key={item.id} onClick={() => onRecentItemSelect(item)} className="w-full text-left flex items-center gap-4 bg-neutral-900/80 p-3 rounded-lg hover:bg-neutral-800 transition-colors">
                                <div className="flex-shrink-0"><TypeIcon type={item.type} /></div>
                                <div className="flex-grow overflow-hidden">
                                    <p className="text-sm font-semibold text-yellow-100 truncate">{item.title}</p>
                                    <p className="text-xs text-neutral-400">{item.type} &middot; {formatDate(item.savedAt)}</p>
                                </div>
                            </button>
                        )) : <p className="text-neutral-400 text-center py-4">Nenhuma atividade recente.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};


interface HistorySubPanelProps {
    initialItemId?: string | null;
    onInitialItemConsumed?: () => void;
}

interface HistoryListItemProps {
    item: {
        id: string;
        title: string;
        savedAt: string;
        type: 'Petição' | 'Post' | 'Consulta';
        imageUrl?: string; 
    };
    isSelected: boolean;
    onSelect: () => void;
}
const HistoryListItem: React.FC<HistoryListItemProps> = ({ item, isSelected, onSelect }) => {
    const iconMap = {
        'Petição': <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
        'Post': <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
        'Consulta': <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.546-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    };

    return (
        <button
            onClick={onSelect}
            className={`w-full text-left p-3 rounded-lg flex items-center gap-4 transition-all duration-200 border
                ${isSelected 
                    ? 'bg-neutral-800 border-amber-600 shadow-md' 
                    : 'bg-neutral-900 border-transparent hover:bg-neutral-800/50 hover:border-neutral-700'}`
            }
        >
            {item.imageUrl ? (
                <img src={item.imageUrl} alt="Thumbnail" className="w-12 h-12 object-cover rounded-md flex-shrink-0 bg-neutral-700" />
            ) : (
                <div className="w-12 h-12 flex-shrink-0 bg-neutral-800 rounded-md flex items-center justify-center">
                    {iconMap[item.type]}
                </div>
            )}
            <div className="flex-grow overflow-hidden">
                <p className="font-semibold text-sm text-yellow-100 truncate">{item.title}</p>
                <p className="text-xs text-neutral-400 mt-1">{formatDate(item.savedAt)}</p>
            </div>
        </button>
    );
};


const PetitionHistoryPanel: React.FC<HistorySubPanelProps> = ({ initialItemId, onInitialItemConsumed }) => {
    const [petitions, setPetitions] = useState<SavedPetition[]>([]);
    const [selectedPetition, setSelectedPetition] = useState<SavedPetition | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [copyStatus, setCopyStatus] = useState(false);

    const loadHistory = useCallback(() => {
        const history = historyService.getAllPetitions();
        setPetitions(history);
        return history;
    }, []);

    useEffect(() => {
        const loadedPetitions = loadHistory();
        if (initialItemId && loadedPetitions.length > 0) {
            const itemToSelect = loadedPetitions.find(p => p.id === initialItemId);
            if (itemToSelect) {
                setSelectedPetition(itemToSelect);
            }
            if (onInitialItemConsumed) {
                onInitialItemConsumed();
            }
        }
    }, [initialItemId, loadHistory, onInitialItemConsumed]);
    
    useEffect(() => {
        if (selectedPetition) {
            setEditingTitle(selectedPetition.title);
        } else {
            setEditingTitle('');
        }
    }, [selectedPetition]);

    const handleSelectPetition = (petition: SavedPetition) => {
        setSelectedPetition(petition);
    };

    const handleUpdate = () => {
        if (!selectedPetition) return;

        historyService.updatePetition(selectedPetition.id, {
            title: editingTitle,
        });

        const updatedPetitions = historyService.getAllPetitions();
        setPetitions(updatedPetitions);
        
        const newlySelectedItem = updatedPetitions.find(p => p.id === selectedPetition.id);
        setSelectedPetition(newlySelectedItem || null);

        alert("Título da petição atualizado com sucesso!");
    };
    
    const handleDelete = (id: string) => {
        if (window.confirm("Tem certeza que deseja excluir esta petição do histórico?")) {
            historyService.deletePetition(id);
            if (selectedPetition?.id === id) {
                setSelectedPetition(null);
            }
            loadHistory();
        }
    };
    
    const handleCopyToClipboard = () => {
        if (!selectedPetition) return;
        copyPetitionToClipboard(selectedPetition.content)
            .then(() => {
                setCopyStatus(true);
                setTimeout(() => setCopyStatus(false), 2500);
            })
            .catch(err => {
                alert('Ocorreu um erro ao tentar copiar o texto.');
                console.error("Falha na cópia:", err);
            });
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[60vh]">
            <div className="lg:col-span-1 flex flex-col">
                <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-2 max-h-[50vh] lg:max-h-[calc(60vh-2rem)]">
                    {petitions.length === 0 ? (
                         <p className="text-neutral-500 text-center py-10">Nenhuma petição salva.</p>
                    ) : (
                        petitions.map(p => (
                            <HistoryListItem 
                                key={p.id}
                                item={{ ...p, type: 'Petição' }}
                                isSelected={selectedPetition?.id === p.id}
                                onSelect={() => handleSelectPetition(p)}
                            />
                        ))
                    )}
                </div>
            </div>
            
            <div className="lg:col-span-2 bg-neutral-950/50 border border-neutral-800 rounded-lg p-6 flex flex-col overflow-hidden">
                {selectedPetition ? (
                    <>
                        <div className="flex-shrink-0 mb-4">
                             <label className="block text-sm font-medium text-amber-200 mb-1">Título</label>
                             <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                className="w-full p-2 bg-neutral-800 border border-neutral-700 rounded-md focus:ring-1 focus:ring-amber-500 focus:outline-none text-yellow-100"
                                placeholder="Título da Petição"
                            />
                        </div>

                        <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                             <button onClick={handleUpdate} className="px-4 py-2 bg-[#d4af37] hover:bg-[#c8a35f] text-black font-bold rounded-md transition-colors text-sm">
                                Salvar Título
                             </button>
                             <button onClick={handleCopyToClipboard} className="flex items-center gap-2 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-amber-200 font-bold rounded-md transition-colors text-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                {copyStatus ? 'Copiado!' : 'Copiar Formatado'}
                             </button>
                             <button onClick={() => handleDelete(selectedPetition.id)} className="px-4 py-2 bg-transparent hover:bg-red-900/50 text-red-400 font-semibold rounded-md transition-colors text-sm border border-red-800 hover:border-red-700">
                                Excluir
                             </button>
                        </div>

                        <div className="flex-grow flex flex-col min-h-0">
                            <label className="block text-sm font-medium text-amber-200 mb-1 flex-shrink-0">Conteúdo</label>
                            <div className="flex-grow overflow-y-auto border border-neutral-700 rounded-md bg-neutral-800 p-2">
                                <FormattedPetitionViewer text={selectedPetition.content} />
                            </div>
                        </div>

                    </>
                ) : (
                    <div className="flex flex-col justify-center items-center h-full text-center text-neutral-500 p-8">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        <h3 className="font-semibold text-lg text-neutral-300">Selecione um item</h3>
                        <p className="mt-1 text-sm">Escolha um documento da lista para visualizar seu conteúdo aqui.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const PostHistoryPanel: React.FC<HistorySubPanelProps> = ({ initialItemId, onInitialItemConsumed }) => {
    const [posts, setPosts] = useState<SavedPost[]>([]);
    const [selectedPost, setSelectedPost] = useState<SavedPost | null>(null);
    const [editingPost, setEditingPost] = useState<PostContent | null>(null);

    const loadHistory = useCallback(() => {
        const history = postHistoryService.getAllPosts();
        setPosts(history);
        return history;
    }, []);

    useEffect(() => {
        const loadedPosts = loadHistory();
        if (initialItemId && loadedPosts.length > 0) {
            const itemToSelect = loadedPosts.find(p => p.id === initialItemId);
            if (itemToSelect) {
                setSelectedPost(itemToSelect);
            }
            if (onInitialItemConsumed) {
                onInitialItemConsumed();
            }
        }
    }, [initialItemId, loadHistory, onInitialItemConsumed]);

    useEffect(() => {
        if (selectedPost) {
            setEditingPost(JSON.parse(JSON.stringify(selectedPost.post.postContent))); // Deep copy
        } else {
            setEditingPost(null);
        }
    }, [selectedPost]);

    const handleSelectPost = (post: SavedPost) => {
        setSelectedPost(post);
    };

    const handleUpdate = () => {
        if (!selectedPost || !editingPost) return;

        const updatedPostData: SavedPost['post'] = {
            ...selectedPost.post,
            postContent: editingPost,
        };
        
        postHistoryService.updatePost(selectedPost.id, { post: updatedPostData });

        const updatedPosts = postHistoryService.getAllPosts();
        setPosts(updatedPosts);
        
        const newlySelectedItem = updatedPosts.find(p => p.id === selectedPost.id);
        setSelectedPost(newlySelectedItem || null);

        alert("Post atualizado com sucesso!");
    };
    
    const handleDelete = (id: string) => {
        if (window.confirm("Tem certeza que deseja excluir este post do histórico?")) {
            postHistoryService.deletePost(id);
            if (selectedPost?.id === id) {
                setSelectedPost(null);
            }
            loadHistory();
        }
    };

    const handleFieldChange = (field: keyof PostContent, value: string | string[]) => {
        if (editingPost) {
            setEditingPost(prev => prev ? { ...prev, [field]: value } : null);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[60vh]">
            <div className="lg:col-span-1 flex flex-col">
                <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-2 max-h-[50vh] lg:max-h-[calc(60vh-2rem)]">
                    {posts.length === 0 ? (
                        <p className="text-neutral-500 text-center py-10">Nenhum post salvo.</p>
                    ) : (
                        posts.map(p => (
                            <HistoryListItem
                                key={p.id}
                                item={{
                                    id: p.id,
                                    title: p.post.postContent.title,
                                    savedAt: p.savedAt,
                                    type: 'Post',
                                    imageUrl: (p.post as any).imageUrl || (p.post as any).imageUrlWithText, // backward compatibility
                                }}
                                isSelected={selectedPost?.id === p.id}
                                onSelect={() => handleSelectPost(p)}
                            />
                        ))
                    )}
                </div>
            </div>

            <div className="lg:col-span-2 bg-neutral-950/50 border border-neutral-800 rounded-lg p-6 flex flex-col overflow-hidden">
                <div className="overflow-y-auto flex-grow pr-2 -mr-2">
                    {selectedPost && editingPost ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <img src={(selectedPost.post as any).imageUrl || (selectedPost.post as any).imageUrlWithText} alt="Post" className="w-full rounded-lg shadow-lg" />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-amber-200 mb-1">Título</label>
                                <input type="text" value={editingPost.title} onChange={(e) => handleFieldChange('title', e.target.value)} className="w-full p-2 bg-neutral-800 border border-neutral-700 rounded-md focus:ring-1 focus:ring-amber-500 focus:outline-none text-yellow-100" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-amber-200 mb-1">Subtítulo</label>
                                <input type="text" value={editingPost.subtitle} onChange={(e) => handleFieldChange('subtitle', e.target.value)} className="w-full p-2 bg-neutral-800 border border-neutral-700 rounded-md focus:ring-1 focus:ring-amber-500 focus:outline-none text-yellow-100" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-amber-200 mb-1">Copy (Legenda)</label>
                                <textarea value={editingPost.copy} onChange={(e) => handleFieldChange('copy', e.target.value)} className="w-full p-2 bg-neutral-800 border border-neutral-700 rounded-md focus:ring-1 focus:ring-amber-500 focus:outline-none text-yellow-100" rows={6}></textarea>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-amber-200 mb-1">Hashtags (separadas por espaço)</label>
                                <input type="text" value={editingPost.hashtags.join(' ')} onChange={(e) => handleFieldChange('hashtags', e.target.value.split(' '))} className="w-full p-2 bg-neutral-800 border border-neutral-700 rounded-md focus:ring-1 focus:ring-amber-500 focus:outline-none text-yellow-100" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-amber-200 mb-1">Palavras-chave (SEO, separadas por vírgula)</label>
                                <input type="text" value={editingPost.seoKeywords.join(', ')} onChange={(e) => handleFieldChange('seoKeywords', e.target.value.split(',').map(k => k.trim()))} className="w-full p-2 bg-neutral-800 border border-neutral-700 rounded-md focus:ring-1 focus:ring-amber-500 focus:outline-none text-yellow-100" />
                            </div>
                        </div>
                    ) : (
                       <div className="flex flex-col justify-center items-center h-full text-center text-neutral-500 p-8">
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                           <h3 className="font-semibold text-lg text-neutral-300">Selecione um item</h3>
                           <p className="mt-1 text-sm">Escolha um post da lista para visualizar e editar seu conteúdo aqui.</p>
                       </div>
                    )}
                </div>
                 {selectedPost && (
                    <div className="flex items-center gap-3 mt-4 flex-shrink-0">
                         <button onClick={handleUpdate} className="px-4 py-2 bg-[#d4af37] hover:bg-[#c8a35f] text-black font-bold rounded-md transition-colors text-sm">
                            Salvar Alterações
                         </button>
                         <button onClick={() => handleDelete(selectedPost.id)} className="px-4 py-2 bg-transparent hover:bg-red-900/50 text-red-400 font-semibold rounded-md transition-colors text-sm border border-red-800 hover:border-red-700">
                            Excluir
                         </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const ComplexQueryHistoryPanel: React.FC<HistorySubPanelProps> = ({ initialItemId, onInitialItemConsumed }) => {
    const [queries, setQueries] = useState<SavedQuery[]>([]);
    const [selectedQuery, setSelectedQuery] = useState<SavedQuery | null>(null);
    const [editingContent, setEditingContent] = useState('');
    const [editingTitle, setEditingTitle] = useState('');

    const loadHistory = useCallback(() => {
        const history = complexQueryHistoryService.getAllQueries();
        setQueries(history);
        return history;
    }, []);

    useEffect(() => {
        const loadedQueries = loadHistory();
        if (initialItemId && loadedQueries.length > 0) {
            const itemToSelect = loadedQueries.find(p => p.id === initialItemId);
            if (itemToSelect) {
                setSelectedQuery(itemToSelect);
            }
            if (onInitialItemConsumed) {
                onInitialItemConsumed();
            }
        }
    }, [initialItemId, loadHistory, onInitialItemConsumed]);

    useEffect(() => {
        if (selectedQuery) {
            setEditingTitle(selectedQuery.title);
            setEditingContent(selectedQuery.content);
        } else {
            setEditingTitle('');
            setEditingContent('');
        }
    }, [selectedQuery]);

    const handleSelectQuery = (query: SavedQuery) => {
        setSelectedQuery(query);
    };

    const handleUpdate = () => {
        if (!selectedQuery) return;

        complexQueryHistoryService.updateQuery(selectedQuery.id, {
            title: editingTitle,
            content: editingContent,
        });

        const updatedQueries = complexQueryHistoryService.getAllQueries();
        setQueries(updatedQueries);
        
        const newlySelectedItem = updatedQueries.find(p => p.id === selectedQuery.id);
        setSelectedQuery(newlySelectedItem || null);

        alert("Consulta atualizada com sucesso!");
    };
    
    const handleDelete = (id: string) => {
        if (window.confirm("Tem certeza que deseja excluir esta consulta do histórico?")) {
            complexQueryHistoryService.deleteQuery(id);
            if (selectedQuery?.id === id) {
                setSelectedQuery(null);
            }
            loadHistory();
        }
    };
    
    return (
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[60vh]">
            <div className="lg:col-span-1 flex flex-col">
                <div className="flex-grow overflow-y-auto pr-2 -mr-2 space-y-2 max-h-[50vh] lg:max-h-[calc(60vh-2rem)]">
                    {queries.length === 0 ? (
                        <p className="text-neutral-500 text-center py-10">Nenhuma consulta salva.</p>
                    ) : (
                        queries.map(q => (
                             <HistoryListItem 
                                key={q.id}
                                item={{ ...q, type: 'Consulta' }}
                                isSelected={selectedQuery?.id === q.id}
                                onSelect={() => handleSelectQuery(q)}
                            />
                        ))
                    )}
                </div>
            </div>
            
            <div className="lg:col-span-2 bg-neutral-950/50 border border-neutral-800 rounded-lg p-6 flex flex-col overflow-hidden">
                {selectedQuery ? (
                     <>
                        <div className="flex-shrink-0 mb-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-amber-200 mb-1">Título</label>
                                <input
                                    type="text"
                                    value={editingTitle}
                                    onChange={(e) => setEditingTitle(e.target.value)}
                                    className="w-full p-2 bg-neutral-800 border border-neutral-700 rounded-md focus:ring-1 focus:ring-amber-500 focus:outline-none text-yellow-100"
                                    placeholder="Título da Consulta"
                                />
                            </div>
                        </div>
                        <div className="flex-grow flex flex-col">
                            <label className="block text-sm font-medium text-amber-200 mb-1">Conteúdo</label>
                             <textarea
                                value={editingContent}
                                onChange={(e) => setEditingContent(e.target.value)}
                                className="w-full flex-grow p-2 bg-neutral-800 border border-neutral-700 rounded-md focus:outline-none text-white font-mono text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-3 mt-4 flex-shrink-0">
                             <button onClick={handleUpdate} className="px-4 py-2 bg-[#d4af37] hover:bg-[#c8a35f] text-black font-bold rounded-md transition-colors text-sm">
                                Salvar Alterações
                             </button>
                             <button onClick={() => handleDelete(selectedQuery.id)} className="px-4 py-2 bg-transparent hover:bg-red-900/50 text-red-400 font-semibold rounded-md transition-colors text-sm border border-red-800 hover:border-red-700">
                                Excluir
                             </button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col justify-center items-center h-full text-center text-neutral-500 p-8">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        <h3 className="font-semibold text-lg text-neutral-300">Selecione um item</h3>
                        <p className="mt-1 text-sm">Escolha uma consulta da lista para visualizar e editar seu conteúdo aqui.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

interface HistoryPanelProps {
    initialItem: InitialHistoryItem;
    onClearInitialItem: () => void;
}
export const HistoryPanel: React.FC<HistoryPanelProps> = ({ initialItem, onClearInitialItem }) => {
    const [activeTab, setActiveTab] = useState<'petitions' | 'posts' | 'queries'>('petitions');

    useEffect(() => {
      if (initialItem) {
        switch (initialItem.type) {
          case 'Petição': setActiveTab('petitions'); break;
          case 'Post': setActiveTab('posts'); break;
          case 'Consulta': setActiveTab('queries'); break;
        }
      }
    }, [initialItem]);

    const HistoryTabButton: React.FC<{label: string; isActive: boolean; onClick: () => void;}> = ({label, isActive, onClick}) => (
        <button
            onClick={onClick}
            className={`px-1 py-2 text-sm font-semibold transition-colors duration-200 border-b-2
            ${isActive ? 'text-amber-400 border-amber-400' : 'text-neutral-400 border-transparent hover:text-white hover:border-neutral-600'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white">Meu Histórico</h1>
                <p className="text-neutral-400 mt-1">Acesse, edite e gerencie todos os seus documentos e posts salvos.</p>
            </div>
            
            <div className="bg-[#2a2a2a] border border-neutral-800 rounded-xl p-6">
                <nav className="flex gap-6 border-b border-neutral-700 mb-6">
                     <HistoryTabButton 
                        label="Petições" 
                        isActive={activeTab === 'petitions'}
                        onClick={() => setActiveTab('petitions')} 
                    />
                     <HistoryTabButton 
                        label="Posts" 
                        isActive={activeTab === 'posts'}
                        onClick={() => setActiveTab('posts')} 
                    />
                     <HistoryTabButton 
                        label="Consultas" 
                        isActive={activeTab === 'queries'}
                        onClick={() => setActiveTab('queries')} 
                    />
                </nav>
                <div>
                    {activeTab === 'petitions' && <PetitionHistoryPanel initialItemId={initialItem?.type === 'Petição' ? initialItem.id : null} onInitialItemConsumed={onClearInitialItem} />}
                    {activeTab === 'posts' && <PostHistoryPanel initialItemId={initialItem?.type === 'Post' ? initialItem.id : null} onInitialItemConsumed={onClearInitialItem} />}
                    {activeTab === 'queries' && <ComplexQueryHistoryPanel initialItemId={initialItem?.type === 'Consulta' ? initialItem.id : null} onInitialItemConsumed={onClearInitialItem} />}
                </div>
            </div>
        </div>
    );
};