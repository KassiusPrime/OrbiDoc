import React, { useState, useRef, useEffect } from 'react';
import { 
  Pencil, Eraser, Square, Circle, Type, Image as ImageIcon,
  RotateCcw, Download, Trash2, Palette, Sparkles, Send, Layers, Star
} from 'lucide-react';
import { motion } from 'motion/react';
import { saveAs } from 'file-saver';
import { HistoryItem } from '../types';

interface CanvaDesignStudioProps {
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  showNotification?: (msg: string, type?: 'success' | 'error') => void;
  onSendToOcr?: (textOrImage: string) => void;
  engineProvider?: string;
  engineModel?: string;
}

type CanvasTool = 'pencil' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'text' | 'star';

export const CanvaDesignStudio: React.FC<CanvaDesignStudioProps> = ({
  onSaveToHistory,
  showNotification = () => {},
  onSendToOcr,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTool, setActiveTool] = useState<CanvasTool>('pencil');
  const [strokeColor, setStrokeColor] = useState('#6366f1');
  const [lineWidth, setLineWidth] = useState(4);
  const [canvasBg, setCanvasBg] = useState('#ffffff');
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);

  // Undo Stack
  const [history, setHistory] = useState<ImageData[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill initial canvas bg
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const saveCanvasState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => [...prev.slice(-15), data]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const lastState = history[history.length - 1];
    ctx.putImageData(lastState, 0, 0);
    setHistory(prev => prev.slice(0, prev.length - 1));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    saveCanvasState();
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    saveCanvasState();
    setIsDrawing(true);
    setStartPos({ x, y });

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = activeTool === 'eraser' ? canvasBg : strokeColor;
    ctx.lineWidth = activeTool === 'eraser' ? lineWidth * 3 : lineWidth;
    ctx.lineCap = 'round';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (activeTool === 'pencil' || activeTool === 'eraser') {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const stopDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.fillStyle = strokeColor;

    if (activeTool === 'rectangle') {
      ctx.strokeRect(startPos.x, startPos.y, x - startPos.x, y - startPos.y);
    } else if (activeTool === 'circle') {
      const radius = Math.hypot(x - startPos.x, y - startPos.y);
      ctx.beginPath();
      ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (activeTool === 'line') {
      ctx.beginPath();
      ctx.moveTo(startPos.x, startPos.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (activeTool === 'text') {
      const text = prompt('Insira o texto para a arte:');
      if (text) {
        ctx.font = `${lineWidth * 5}px sans-serif`;
        ctx.fillText(text, x, y);
      }
    }

    setStartPos(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        saveCanvasState();
        ctx.drawImage(img, 50, 50, 300, 200);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    saveAs(dataUrl, 'Canva_Design_Studio.png');
    showNotification('Design exportado como PNG!', 'success');

    if (onSaveToHistory) {
      onSaveToHistory({
        type: 'canva',
        title: 'Design Gráfico Canva',
        summary: 'Arte visual criada no Canva Studio.',
        mediaUrl: dataUrl
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 text-white flex items-center justify-center font-bold shadow-md">
            C
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Canva & Estúdio de Design</h3>
            <p className="text-xs text-slate-500">Criação visual, ilustrações e anotações interativas</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={undo}
            disabled={history.length === 0}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold disabled:opacity-40 flex items-center gap-1"
            title="Desfazer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={clearCanvas}
            className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-semibold flex items-center gap-1"
            title="Limpar Canvas"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={exportImage}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
          >
            <Download className="w-4 h-4" /> Exportar PNG
          </button>
        </div>
      </div>

      {/* Canva Tools Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-3 flex flex-wrap items-center justify-between gap-3">
        {/* Tools */}
        <div className="flex items-center gap-1">
          {[
            { id: 'pencil' as CanvasTool, label: 'Lápis', icon: <Pencil className="w-4 h-4" /> },
            { id: 'eraser' as CanvasTool, label: 'Borracha', icon: <Eraser className="w-4 h-4" /> },
            { id: 'rectangle' as CanvasTool, label: 'Retângulo', icon: <Square className="w-4 h-4" /> },
            { id: 'circle' as CanvasTool, label: 'Círculo', icon: <Circle className="w-4 h-4" /> },
            { id: 'text' as CanvasTool, label: 'Texto', icon: <Type className="w-4 h-4" /> },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activeTool === t.id
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
              }`}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Color Palette & Stroke Size */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#000000'].map(color => (
              <button
                key={color}
                onClick={() => setStrokeColor(color)}
                className={`w-6 h-6 rounded-full border-2 ${
                  strokeColor === color ? 'ring-2 ring-purple-600 ring-offset-2' : 'border-white'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => setStrokeColor(e.target.value)}
              className="w-7 h-7 rounded-lg cursor-pointer border-none bg-transparent"
            />
          </div>

          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <span className="text-xs text-slate-500 font-medium">Espessura:</span>
            <input
              type="range"
              min="1"
              max="20"
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="w-20 accent-purple-600"
            />
          </div>

          <label className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1">
            <ImageIcon className="w-4 h-4" />
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Canvas Workspace Stage */}
      <div className="bg-slate-100/90 rounded-3xl p-4 sm:p-8 flex justify-center shadow-inner overflow-hidden">
        <canvas
          ref={canvasRef}
          width={800}
          height={500}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          className="bg-white rounded-2xl shadow-xl cursor-crosshair border border-slate-200 max-w-full touch-none"
        />
      </div>
    </div>
  );
};
