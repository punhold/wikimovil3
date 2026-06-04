import React, { useRef, useEffect, useState } from 'react';
import { Bold, Italic, Underline, Palette, Mic } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange }) => {
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const [isListening, setIsListening] = useState(false);

  // Sync external value changes to innerHTML only if different (to avoid cursor jumping)
  useEffect(() => {
    if (contentEditableRef.current && contentEditableRef.current.innerHTML !== value) {
       // Only update if the content is significantly different to avoid loop
       if (value === '' && contentEditableRef.current.innerHTML !== '<br>') {
           contentEditableRef.current.innerHTML = '';
       } 
    }
  }, [value]);

  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    handleInput(); // Trigger update
    contentEditableRef.current?.focus();
  };

  const handleInput = () => {
    if (contentEditableRef.current) {
      onChange(contentEditableRef.current.innerHTML);
    }
  };

  const toggleSpeech = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Tu navegador no soporta reconocimiento de voz.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      execCommand('insertText', ` ${transcript} `);
    };

    recognition.start();
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm flex flex-col w-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center bg-white border border-gray-200 rounded-md shadow-sm">
            <button
            onClick={() => execCommand('bold')}
            className="p-2 hover:bg-gray-100 text-gray-700"
            title="Negrita"
            type="button"
            >
            <Bold size={18} />
            </button>
            <button
            onClick={() => execCommand('italic')}
            className="p-2 hover:bg-gray-100 text-gray-700"
            title="Cursiva"
            type="button"
            >
            <Italic size={18} />
            </button>
            <button
            onClick={() => execCommand('underline')}
            className="p-2 hover:bg-gray-100 text-gray-700"
            title="Subrayado"
            type="button"
            >
            <Underline size={18} />
            </button>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        <select 
            onChange={(e) => {
                execCommand('fontSize', e.target.value);
                e.target.value = ''; // Reset
            }}
            className="text-sm p-1.5 border border-gray-300 rounded focus:outline-none bg-white text-gray-800"
            title="Tamaño de letra"
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
                title="Color de texto"
            />
        </div>

        <div className="flex-1"></div>

        {/* Voice Button */}
        <button
            onClick={toggleSpeech}
            className={`p-2 rounded-full transition-all ${
                isListening 
                ? 'bg-red-100 text-red-600 animate-pulse' 
                : 'hover:bg-gray-200 text-gray-600'
            }`}
            title="Dictar por voz"
            type="button"
        >
            <Mic size={18} />
        </button>
      </div>

      {/* Editor Area */}
      <div
        ref={contentEditableRef}
        className="w-full p-4 focus:outline-none overflow-y-auto font-sans text-gray-900 bg-white text-base h-32"
        contentEditable
        onInput={handleInput}
      />
      
      {/* Status Bar */}
      <div className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-t flex justify-between">
        <span>Editor WYSIWYG activo</span>
        <span>{isListening ? 'Escuchando...' : 'Escribe o dicta arriba'}</span>
      </div>
    </div>
  );
};