
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SavedPetition } from '../types';

export const validateFile = (file: File, accept: string): { isValid: boolean, message: string | null } => {
    const fileName = file.name.toLowerCase();

    // 1. Explicitly block unsupported .doc format with a clear message.
    // This is a known incompatibility with the text extraction library.
    if (fileName.endsWith('.doc')) {
        return { 
            isValid: false, 
            message: `O formato .doc não é suportado. Por favor, salve o arquivo "${file.name}" como .docx antes de fazer o upload.` 
        };
    }

    // If accept is not defined or allows all, validation passes.
    if (!accept || accept === '*/*') {
        return { isValid: true, message: null };
    }

    // 2. Prepare lists of accepted extensions and MIME types from the 'accept' string.
    const acceptedValues = accept.split(',').map(v => v.trim().toLowerCase());
    const acceptedExtensions = acceptedValues.filter(v => v.startsWith('.'));
    const acceptedMimePatterns = acceptedValues.filter(v => !v.startsWith('.'));

    // 3. Get file info
    const fileParts = fileName.split('.');
    const fileExtension = fileParts.length > 1 ? `.${fileParts.pop()}` : '';
    const fileType = file.type.toLowerCase();

    // 4. Validate by extension first (more reliable for documents).
    if (acceptedExtensions.length > 0 && acceptedExtensions.includes(fileExtension)) {
        return { isValid: true, message: null };
    }

    // 5. Validate by MIME type as a fallback (necessary for patterns like 'image/*').
    if (acceptedMimePatterns.length > 0) {
        for (const pattern of acceptedMimePatterns) {
            if (pattern.endsWith('/*') && fileType.startsWith(pattern.slice(0, -1))) {
                return { isValid: true, message: null };
            }
            if (pattern === fileType) {
                return { isValid: true, message: null };
            }
        }
    }
    
    // 6. If validation fails, provide a clear error message listing the accepted extensions.
    const acceptedExtensionsFormatted = acceptedValues
        .filter(ext => ext.startsWith('.') || ext.endsWith('/*'))
        .join(', ');
    return { 
        isValid: false, 
        message: `Tipo de arquivo não suportado: ${file.name}.\n\nFormatos aceitos: ${acceptedExtensionsFormatted}` 
    };
};


export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`bg-neutral-900 border border-amber-800 rounded-lg p-6 shadow-lg ${className}`}>
    {children}
  </div>
);

export const Spinner: React.FC = () => (
    <div className="flex justify-center items-center">
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  id: string;
  accept?: string;
  className?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, onFileRemove, id, accept="image/*", className="" }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = (file: File | undefined, inputElement?: HTMLInputElement) => {
    if (!file) return;

    const validation = validateFile(file, accept);
    if (!validation.isValid) {
        alert(validation.message);
        if (inputElement) {
            inputElement.value = '';
        }
        return;
    }

    onFileSelect(file);
    setFileName(file.name);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0], event.target);
  };

  const handleDragOver = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    handleFile(event.dataTransfer.files?.[0]);
  }, [accept, onFileSelect]);

  const handleRemove = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setPreview(null);
      setFileName(null);
      onFileRemove();
      const input = document.getElementById(id) as HTMLInputElement;
      if (input) {
        input.value = "";
      }
  };

  return (
    <div className="w-full relative">
      <label
        htmlFor={id}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`flex justify-center items-center w-full h-40 px-4 transition bg-neutral-900 border-2 border-neutral-700 border-dashed rounded-md appearance-none cursor-pointer hover:border-amber-600 focus:outline-none ${className}`}
      >
        {(preview || fileName) ? (
          <>
            {preview ? (
                 <img src={preview} alt="Preview" className="object-contain h-full w-full" />
            ) : (
                <div className="text-center text-neutral-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="mt-2 text-sm font-semibold truncate">{fileName}</p>
                </div>
            )}
            <button 
                onClick={handleRemove}
                className="absolute top-1 right-1 bg-black bg-opacity-60 rounded-full p-1.5 text-white hover:bg-opacity-80 transition-colors z-10"
                aria-label="Remover arquivo"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
          </>
        ) : (
          <span className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span className="font-medium text-neutral-400">
              Arraste arquivos para Anexar, ou
              <span className="text-amber-400 underline ml-1">procure</span>
            </span>
          </span>
        )}
        <input type="file" id={id} name="file_upload" className="hidden" accept={accept} onChange={handleFileChange} />
      </label>
    </div>
  );
};


const FileIcon: React.FC<{ file: File }> = ({ file }) => {
    const name = file.name.toLowerCase();
    const type = file.type;

    if (type.startsWith("image/")) {
        return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
    }
    if (type === "application/pdf") {
        return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
    }
    if (name.endsWith('.docx')) {
        return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
    }
     if (name.endsWith('.xlsx')) {
        return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
    }
    return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
}


const FilePreviewCard: React.FC<{ file: File, onRemove: () => void }> = ({ file, onRemove }) => {
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

    return (
        <div className="relative group flex flex-col items-center justify-center text-center bg-neutral-800 p-2 rounded-md w-20 h-20">
            <button onClick={onRemove} className="absolute -top-1 -right-1 p-0.5 text-neutral-300 hover:text-white bg-black/60 rounded-full z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="w-full h-full flex items-center justify-center overflow-hidden rounded-sm">
                {previewUrl ? (
                    <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
                ) : (
                    <FileIcon file={file} />
                )}
            </div>
             {!previewUrl && (
                <span className="text-[10px] text-yellow-100/80 truncate w-full absolute bottom-1 px-1" title={file.name}>
                    {file.name}
                </span>
            )}
        </div>
    );
};


interface DocumentUploadProps {
  onFileChange: (files: File[]) => void;
  id: string;
  accept?: string;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ onFileChange, id, accept = "*/*" }) => {
    const [files, setFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFiles = useCallback((newFilesArray: File[]) => {
        const supportedFiles: File[] = [];
        const validationErrors: string[] = [];
        
        newFilesArray.forEach(file => {
            const validation = validateFile(file, accept);
            if (validation.isValid) {
                supportedFiles.push(file);
            } else {
                validationErrors.push(validation.message || `Arquivo inválido: ${file.name}`);
            }
        });

        if (validationErrors.length > 0) {
            alert(validationErrors.join('\n\n'));
        }

        if (supportedFiles.length > 0) {
            setFiles(prevFiles => {
                // Prevent duplicates
                const newUniqueFiles = supportedFiles.filter(sf => !prevFiles.some(pf => pf.name === sf.name && pf.lastModified === sf.lastModified));
                const updatedFiles = [...prevFiles, ...newUniqueFiles];
                onFileChange(updatedFiles);
                return updatedFiles;
            });
        }
    }, [onFileChange, accept]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newFiles = Array.from(event.target.files || []);
        if (newFiles.length > 0) {
            handleFiles(newFiles);
            if (fileInputRef.current) {
                fileInputRef.current.value = ''; // Reset to allow re-uploading the same file
            }
        }
    };

    const handleRemoveFile = (index: number) => {
        setFiles(prevFiles => {
            const updatedFiles = prevFiles.filter((_, i) => i !== index);
            onFileChange(updatedFiles);
            return updatedFiles;
        });
    };

    const handleDragOver = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
    }, []);



    const handleDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        const droppedFiles = Array.from(event.dataTransfer.files || []);
        if (droppedFiles.length > 0) {
            handleFiles(droppedFiles);
        }
    }, [handleFiles]);

    return (
        <div className="flex gap-4 items-start">
            <label
                htmlFor={id}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="flex flex-col justify-center items-center w-48 h-32 p-4 transition bg-neutral-900 border-2 border-neutral-700 border-dashed rounded-md appearance-none cursor-pointer hover:border-amber-600 focus:outline-none flex-shrink-0"
            >
                <div className="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto w-8 h-8 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                       <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <p className="mt-2 font-medium text-neutral-400 text-xs">
                        Arraste e solte<br />ou <span className="text-amber-400 underline cursor-pointer">clique</span>
                    </p>
                </div>
                <input type="file" id={id} multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} accept={accept} />
            </label>
            {files.length > 0 && (
                <div className="flex-grow w-full min-h-[8rem] overflow-y-auto p-2 border border-neutral-700 rounded-md bg-neutral-950/50">
                    <div className="flex flex-wrap gap-2">
                        {files.map((file, index) => (
                           <FilePreviewCard 
                                key={`${file.name}-${index}`} 
                                file={file} 
                                onRemove={() => handleRemoveFile(index)} 
                           />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};


interface TabButtonProps {
    label: string;
    isActive: boolean;
    onClick: () => void;
}
export const TabButton: React.FC<TabButtonProps> = ({ label, isActive, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 text-sm font-semibold rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-amber-500 transition-colors duration-200 ${
                isActive
                    ? 'bg-amber-600 text-black'
                    : 'bg-neutral-800 text-amber-200 hover:bg-neutral-700'
            }`}
        >
            {label}
        </button>
    );
};

export const Modal: React.FC<{ src: string; onClose: () => void }> = ({ src, onClose }) => {
    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-80 flex justify-center items-center z-50"
            onClick={onClose}
        >
            <div className="relative max-w-4xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
                <img src={src} alt="Visualização ampliada" className="object-contain max-w-full max-h-full rounded-lg shadow-2xl" />
                <button 
                    onClick={onClose}
                    className="absolute -top-2 -right-2 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 focus:outline-none focus:ring-2 focus:ring-white"
                    aria-label="Fechar visualização"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
};
