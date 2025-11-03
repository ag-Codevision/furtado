import React, { useState, useEffect } from 'react';
import { Feature, AITool, InitialHistoryItem, UnifiedItem } from './types';
import { AIToolsPage, DashboardPanel, HistoryPanel } from './components/FeaturePanels';
import { getApiKey } from './services/apiKeyService';
import { ApiKeyManager } from './components/ApiKeyManager';

const Sidebar: React.FC<{ 
    activeFeature: Feature; 
    onFeatureSelect: (feature: Feature) => void; 
    onNewPetitionClick: () => void;
}> = ({ activeFeature, onFeatureSelect, onNewPetitionClick }) => {
    // FIX: Added 'disabled' property to nav items to resolve TypeScript errors.
    const navItems = [
        { id: Feature.Dashboard, label: "Dashboard", icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>, disabled: false },
        { id: Feature.MeuHistorico, label: "Meu Histórico", icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>, disabled: false },
        { id: Feature.FerramentasIA, label: "Ferramentas de IA", icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>, disabled: false },
    ];

    return (
       <aside className="w-64 flex-shrink-0 bg-[#2a2a2a] p-4 flex flex-col justify-between">
  <div>
    <div className="flex items-center gap-3 mb-8 px-2">
      <img 
        src="http://furtadoadvocacia.com.br/wp-content/uploads/2025/11/icone.png" 
        alt="Logo Furtado Office" 
        className="w-12 h-12"
      />
      <h1 className="text-xl font-bold text-white">Furtado Office IA Studio</h1>
    </div>
                <nav className="space-y-2">
                    {navItems.map(item => {
                        const isActive = activeFeature === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => !item.disabled && onFeatureSelect(item.id as Feature)}
                                disabled={item.disabled}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                                    isActive
                                        ? 'bg-[#d4af37] text-black'
                                        : 'text-neutral-300 hover:bg-neutral-700'
                                } ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>
            <button 
                onClick={onNewPetitionClick}
                className="w-full bg-[#d4af37] text-black font-bold py-3 rounded-md text-sm hover:bg-[#c8a35f] transition-colors"
            >
                + Nova Petição com IA
            </button>
        </aside>
    );
};

const Header: React.FC = () => {
    return (
        <header className="h-16 bg-[#1c1c1c] border-b border-neutral-800 flex-shrink-0 flex items-center justify-between px-6">
            <div className="relative w-full max-w-md">
                <input
                    type="text"
                    placeholder="Buscar casos, documentos..."
                    className="w-full bg-[#2a2a2a] border border-neutral-700 rounded-md py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-[#d4af37] focus:outline-none"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <div className="flex items-center gap-4">
                <button className="text-neutral-400 hover:text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                </button>
                <div className="flex items-center gap-3">
                    <img src="https://i.pravatar.cc/40" alt="Avatar do usuário" className="h-10 w-10 rounded-full border-2 border-neutral-600" />
                    <div className="text-right">
                        <p className="text-sm font-semibold text-white">Dr. Silva</p>
                        <p className="text-xs text-neutral-400">Advogado Trabalhista</p>
                    </div>
                </div>
            </div>
        </header>
    );
};

const App: React.FC = () => {
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [isKeyChecked, setIsKeyChecked] = useState(false);

    useEffect(() => {
        const key = getApiKey();
        setApiKey(key);
        setIsKeyChecked(true);
    }, []);

    const [activeFeature, setActiveFeature] = useState<Feature>(Feature.FerramentasIA);
    const [activeAiTool, setActiveAiTool] = useState<AITool | null>(null);
    const [initialHistoryItem, setInitialHistoryItem] = useState<InitialHistoryItem>(null);

    const handleRecentItemSelect = (item: UnifiedItem) => {
        setInitialHistoryItem({ id: item.id, type: item.type });
        setActiveFeature(Feature.MeuHistorico);
        setActiveAiTool(null);
    };

    const handleFeatureSelect = (feature: Feature) => {
        setActiveFeature(feature);
        setActiveAiTool(null);
    };
    
    const handleToolSelect = (tool: AITool) => {
        setActiveFeature(Feature.FerramentasIA);
        setActiveAiTool(tool);
    };

    const handleKeySubmit = () => {
        const key = getApiKey();
        setApiKey(key);
        // Reload to ensure all services are re-initialized with the new key
        window.location.reload();
    };

    const renderActivePanel = () => {
        switch (activeFeature) {
            case Feature.Dashboard:
                return <DashboardPanel setActiveFeature={handleToolSelect} onRecentItemSelect={handleRecentItemSelect} />;
            case Feature.MeuHistorico:
                 return <HistoryPanel initialItem={initialHistoryItem} onClearInitialItem={() => setInitialHistoryItem(null)} />;
            case Feature.FerramentasIA:
                return <AIToolsPage activeTool={activeAiTool} onToolSelect={setActiveAiTool} />;
            default:
                return <AIToolsPage activeTool={activeAiTool} onToolSelect={setActiveAiTool} />;
        }
    };

    if (!isKeyChecked) {
        // Render a loading state or null while checking for the key
        return null; 
    }

    if (!apiKey) {
        return <ApiKeyManager onKeySubmit={handleKeySubmit} />;
    }

    return (
        <div className="flex h-screen bg-[#1c1c1c] text-neutral-300 font-sans">
            <Sidebar 
                activeFeature={activeFeature} 
                onFeatureSelect={handleFeatureSelect}
                onNewPetitionClick={() => handleToolSelect(AITool.PeticaoInicial)} 
            />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-x-hidden overflow-y-auto">
                    <div className="p-6">
                        {renderActivePanel()}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default App;