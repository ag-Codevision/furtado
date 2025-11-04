import React, { useState } from 'react';
import { setApiKey } from '@/src/services/apiKeyService';

interface ApiKeyManagerProps {
    onKeySubmit: () => void;
}

export const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ onKeySubmit }) => {
    const [key, setKey] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (key.trim()) {
            setApiKey(key.trim());
            onKeySubmit();
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-[#1c1c1c] text-neutral-300">
            <div className="w-full max-w-md p-8 space-y-6 bg-[#2a2a2a] rounded-lg shadow-lg border border-neutral-800">
                <div className="text-center">
                     <img 
                        src="http://furtadoadvocacia.com.br/wp-content/uploads/2025/11/icone.png" 
                        alt="Logo Furtado Office" 
                        className="w-16 h-16 mx-auto mb-4"
                      />
                    <h1 className="text-2xl font-bold text-white">Configurar Chave de API do Gemini</h1>
                    <p className="mt-2 text-neutral-400">
                        Para usar o aplicativo, você precisa de uma chave de API do Google Gemini.
                    </p>
                     <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-amber-400 hover:underline mt-2 inline-block"
                    >
                        Obtenha sua chave de API aqui
                    </a>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="api-key" className="sr-only">
                            Gemini API Key
                        </label>
                        <input
                            id="api-key"
                            name="api-key"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            className="w-full px-3 py-2 text-yellow-100 bg-neutral-900 border border-neutral-700 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                            placeholder="Cole sua Chave de API aqui"
                        />
                    </div>
                    <div>
                        <button
                            type="submit"
                            className="w-full px-4 py-2 font-bold text-black bg-[#d4af37] rounded-md hover:bg-[#c8a35f] transition-colors"
                        >
                            Salvar e Continuar
                        </button>
                    </div>
                </form>
                 <div className="text-xs text-center text-neutral-500">
                    Sua chave de API é armazenada apenas no seu navegador e nunca é enviada para nossos servidores.
                </div>
            </div>
        </div>
    );
};