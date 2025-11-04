import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SavedPetition, Feature, AITool } from '@/src/types';

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={`bg-[#2a2a2a] border border-neutral-800 rounded-xl p-6 shadow-lg ${className}`}>
        {children}
    </div>
);

export const Spinner: React.FC = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-400"></div>
);

interface FileUploadProps {
    onFileSelect: (file: File | null) => void;
    onFileRemove: () => void;
    id: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, onFileRemove, id }) => {
    const [file, setFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0] || null;
        setFile(selectedFile);
        onFileSelect(selectedFile);
    };

    const handleRemoveFile = () => {
        setFile(null);
        onFileRemove();
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="w-full p-4 bg-neutral-900 border-2 border-neutral-700 border-dashed rounded-md text-center">
            {!file ? (
                <>
                    <label htmlFor={id} className="cursor-pointer text-amber-400 hover:text-amber-300 font-semibold">
                        Escolha um arquivo
                    </label>
                    <input type="file" id={id} ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    <p className="text-xs text-neutral-500 mt-1">ou arraste e solte aqui</p>
                </>
            ) : (
                <div className="flex items-center justify-between">
                    <span className="text-sm text-yellow-100 truncate">{file.name}</span>
                    <button onClick={handleRemoveFile} className="text-red-500 hover:text-red-400 text-sm font-bold">Remover</button>
                </div>
            )}
        </div>
    );
};

interface ModalProps {
    src: string;
    onClose: () => void;
}

export const Modal: React.FC<ModalProps> = ({ src, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50" onClick={onClose}>
            <div className="relative max-w-4xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
                <img src={src} alt="Visualização ampliada" className="w-full h-auto object-contain max-h-[85vh]" />
                <button onClick={onClose} className="absolute top-0 right-0 mt-2 mr-2 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        </div>
    );
};

export const validateFile = (file: File, acceptedFormats: string) => {
    const acceptedTypes = acceptedFormats.split(',').map(t => t.trim());
    const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    
    if (!acceptedTypes.includes(fileExtension) && !acceptedTypes.some(type => type.endsWith('/*') && file.type.startsWith(type.slice(0, -2)))) {
        return { isValid: false, message: `Formato de arquivo inválido. Por favor, use um dos seguintes formatos: ${acceptedFormats}` };
    }
    return { isValid: true, message: '' };
};

interface DocumentUploadProps {
    onFileChange: (files: File[]) => void;
    id: string;
    accept: string;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ onFileChange, id, accept }) => {
    const [files, setFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFiles = (newFiles: FileList | null) => {
        if (!newFiles) return;
        const newFileArray = Array.from(newFiles);
        const updatedFiles = [...files, ...newFileArray];
        setFiles(updatedFiles);
        onFileChange(updatedFiles);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        handleFiles(event.target.files);
    };

    const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        handleFiles(event.dataTransfer.files);
    };

    const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
    };

    const handleRemoveFile = (index: number) => {
        const updatedFiles = files.filter((_, i) => i !== index);
        setFiles(updatedFiles);
        onFileChange(updatedFiles);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-3">
            <label
                htmlFor={id}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="flex justify-center w-full h-32 px-4 transition bg-neutral-900 border-2 border-neutral-700 border-dashed rounded-md appearance-none cursor-pointer hover:border-amber-600 focus:outline-none"
            >
                <span className="flex items-center space-x-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    <span className="font-medium text-neutral-400">
                        Arraste os arquivos ou{' '}
                        <span className="text-amber-400 underline">procure</span>
                    </span>
                </span>
                <input type="file" id={id} multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} accept={accept} />
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {files.map((file, index) => (
                    <div key={index} className="relative group bg-neutral-800 p-2 rounded-md text-center">
                        <p className="text-xs text-yellow-100 truncate">{file.name}</p>
                        <button onClick={() => handleRemoveFile(index)} className="absolute -top-1 -right-1 p-0.5 text-neutral-300 hover:text-white bg-black/60 rounded-full z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const TabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void; }> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-semibold transition-colors duration-200 border-b-2
        ${isActive ? 'text-amber-400 border-amber-400' : 'text-neutral-400 border-transparent hover:text-white'}`}
    >
        {label}
    </button>
);

interface BottomNavProps {
    activeFeature: Feature;
    onFeatureSelect: (feature: Feature) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeFeature, onFeatureSelect }) => {
    const navItems = [
        { id: Feature.Dashboard, label: "Dashboard", icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
        { id: Feature.MeuHistorico, label: "Histórico", icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> },
        { id: Feature.FerramentasIA, label: "IA Tools", icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg> },
    ];

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#2a2a2a] border-t border-neutral-800 flex justify-around items-center h-16 z-40">
            {navItems.map(item => {
                const isActive = activeFeature === item.id;
                return (
                    <button
                        key={item.id}
                        onClick={() => onFeatureSelect(item.id)}
                        className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
                            isActive ? 'text-[#d4af37]' : 'text-neutral-400 hover:text-white'
                        }`}
                    >
                        {item.icon}
                        <span className="text-xs mt-1">{item.label}</span>
                    </button>
                );
            })}
        </nav>
    );
};

interface FABProps {
    onClick: () => void;
}

export const FAB: React.FC<FABProps> = ({ onClick }) => {
    return (
        <button
            onClick={onClick}
            className="lg:hidden fixed bottom-20 right-4 bg-[#d4af37] text-black rounded-full p-4 shadow-lg hover:bg-[#c8a35f] transition-colors z-40"
            aria-label="Nova Petição"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
        </button>
    );
};