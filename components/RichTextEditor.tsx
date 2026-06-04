import React, { useRef, useEffect, useState } from 'react';
import { Bold, Italic, Underline, Palette, Mic, Image as ImageIcon } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  onImageUpload?: (file: File) => Promise<string>;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, onImageUpload }) => {
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isListening, setIsListening] = useState(false);
  const [isInsertingImage, setIsInsertingImage] = useState(false);

  useEffect(() => {
    if (contentEditableRef.current && contentEditableRef.current.innerHTML !== value) {
      if (value === '' && contentEditableRef.current.innerHTML !== '<br>') {
        contentEditableRef.current.innerHTML = '';
      }
    }
  }, [value]);

  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    handleInput();
    contentEditableRef.current?.focus();
  };

  const handleInput = () => {
    if (contentEditableRef.current) {
      onChange(contentEditableRef.current.innerHTML);
    }
  };

  // Insertar imagen desde archivo
  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setIsInsertingImage(true);
    try {
      let src: string;
      if (onImageUpload) {
        // Si hay handler de upload, subir a Storage y usar URL
        src = await onImageUpload(file);
      } else {
        // Fallback: base64 inline
        src = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      }
      contentEditableRef.current?.focus();
      document.execCommand('insertHTML', false,
        `<img src="${src}" alt="${file.name}" style="max-width:100%;border-radius:8px;margin:8px 0;" />`
      );
      handleInput();
    } finally {
      setIsInsertingImage(false);
    }
  };

  // Pegar imagen desde clipboard
  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) await handleImageFile(file);
        return;
      }
    }
    // Si no es imagen, dejar que el paste normal ocurra
  };

  const toggleSpeech = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Tu navegador no soporta reconocimiento de voz.");
      return;
    }
    if (isListening) { setIsListening(false); return; }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      execCommand('insertText', ` ${event.results[0][0].transcript} `);
    };
    recognition.start();
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm flex flex-col w-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center bg-white border border-gray-200 rounded-md shadow-sm">
          <button onClick={() => execCommand('bold')} className="p-2 hover:bg-gray-100 text-gray-700" title="Negrita" type="button">
            <Bold size={18} />
          </button>
          <button onClick={() => execCommand('italic')} className="p-2 hover:bg-gray-100 text-gray-700" title="Cursiva" type="button">
            <Italic size={18} />
          </button>
          <button onClick={() => execCommand('underline')} className="p-2 hover:bg-gray-100 text-gray-700" title="Subrayado" type="button">
            <Underline size={18} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        <select
          onChange={(e) => { execCommand('fontSize', e.target.value); e.target.value = ''; }}
          className="text-sm p-1.5 border border-gray-300 rounded focus:outline-none bg-white text-gray-800"
        >
          <option value="">Tamaño</option>
          <option value="3">Normal</option>
          <option value="5">Grande</option>
          <option value="7">Gigante</option>
        </select>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        <div className="flex items-center gap-1 relative group">
          <label htmlFor="color-picker" className="p-2 hover:bg-gray-200 rounded cursor-pointer text-gray-700 flex items-center gap-1">
            <Palette size={18} />
            <span className="text-xs text-gray-500">Color</span>
          </label>
          <input
            id="color-picker"
            type="color"
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            onChange={(e) => execCommand('foreColor', e.target.value)}
          />
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Botón insertar imagen */}
        <button
          onClick={() => imageInputRef.current?.click()}
          disabled={isInsertingImage}
          className="p-2 hover:bg-gray-200 rounded text-gray-600 flex items-center gap-1 disabled:opacity-50"
          title="Insertar imagen (o pegar con Ctrl+V)"
          type="button"
        >
          <ImageIcon size={18} />
          <span className="text-xs">Imagen</span>
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageFile(file);
            e.target.value = '';
          }}
        />

        <div className="flex-1"></div>

        <button
          onClick={toggleSpeech}
          className={`p-2 rounded-full transition-all ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'hover:bg-gray-200 text-gray-600'}`}
          title="Dictar por voz"
          type="button"
        >
          <Mic size={18} />
        </button>
      </div>

      {/* Editor Area */}
      <div
        ref={contentEditableRef}
        className="w-full p-4 focus:outline-none overflow-y-auto font-sans text-gray-900 bg-white text-base h-40"
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
      />

      {/* Status Bar */}
      <div className="px-3 py-1.5 text-xs text-gray-400 bg-gray-50 border-t flex justify-between">
        <span>Podés pegar imágenes directamente con Ctrl+V</span>
        <span>{isListening ? 'Escuchando...' : isInsertingImage ? 'Insertando imagen...' : ''}</span>
      </div>
    </div>
  );
};
