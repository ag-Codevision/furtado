import React, { useState, useRef, useEffect } from 'react';

interface SingleFileUploadProps {
    id: string;
    onFileSelect: (file: File | null) => void;
    accept?: string;
}

const SingleFileUpload: React.FC<SingleFileUploadProps> = ({ id, onFileSelect, accept = "image/*" }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let objectUrl: string | null = null;
        if (file) {
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

    const handleFileChange = (selectedFile: File | undefined) => {
        if (selectedFile) {
            setFile(selectedFile);
            onFileSelect(selectedFile);
        }
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        handleFileChange(event.target.files?.[0]);
    };

    const handleRemoveFile = () => {
        setFile(null);
        onFileSelect(null);
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        handleFileChange(e.dataTransfer.files?.[0]);
    };

    return (
        <div className="w-full">
            <label
                htmlFor={id}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className={`
                    flex justify-center items-center w-full h-32 px-4 transition bg-neutral-900 border-2 border-neutral-700 border-dashed rounded-md appearance-none cursor-pointer
                    ${isDragging ? 'border-amber-500' : 'hover:border-amber-600'}
                `}
            >
                {file && previewUrl ? (
                    <div className="relative group w-full h-full p-2">
                        <img src={previewUrl} alt={file.name} className="w-full h-full object-contain rounded-md" />
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                handleRemoveFile();
                            }}
                            className="absolute -top-1 -right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-red-500"
                            aria-label="Remove file"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center space-y-2 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-sm font-medium text-neutral-400">
                            <span className="text-amber-400">Escolha um arquivo</span> ou arraste e solte aqui
                        </p>
                    </div>
                )}
                <input
                    id={id}
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    onChange={handleInputChange}
                    accept={accept}
                />
            </label>
        </div>
    );
};

export default SingleFileUpload;