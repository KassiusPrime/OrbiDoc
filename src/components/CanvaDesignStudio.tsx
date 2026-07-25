import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Pencil, Eraser, Square, Circle, Type, Image as ImageIcon,
  RotateCcw, Download, Trash2, Palette, Sparkles, Send, Star,
  Highlighter, PaintBucket, MoveRight, LayoutTemplate, ShieldCheck,
  Zap, Compass, Layers, Check
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { HistoryItem } from '../types';

interface CanvaDesignStudioProps {
  initialTemplate?: string;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  showNotification?: (msg: string, type?: 'success' | 'error') => void;
  onSendToOcr?: (textOrImage: string) => void;
  engineProvider?: string;
  engineModel?: string;
}

type CanvasTool = 
  | 'pencil' 
  | 'highlighter' 
  | 'eraser' 
  | 'rectangle' 
  | 'circle' 
  | 'line' 
  | 'arrow' 
  | 'star' 
  | 'text' 
  | 'bucket';

const CANVA_TEMPLATES = [
  { id: 'post', name: 'Post Redes Sociais', desc: 'Arte para Instagram/LinkedIn (1080x1080)' },
  { id: 'banner', name: 'Banner Promocional', desc: 'Banner de ofertas e novidades' },
  { id: 'business_card', name: 'Cartão de Visita', desc: 'Layout minimalista e corporativo' },
  { id: 'infographic', name: 'Infográfico / Fluxo', desc: 'Diagrama visual de 3 etapas' },
  { id: 'certificate', name: 'Certificado de Conclusão', desc: 'Modelo elegante com moldura dourada' },
];

export const CanvaDesignStudio: React.FC<CanvaDesignStudioProps> = ({
  initialTemplate,
  onSaveToHistory,
  showNotification = () => {},
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTool, setActiveTool] = useState<CanvasTool>('pencil');
  const [strokeColor, setStrokeColor] = useState('#6366f1');
  const [fillColor, setFillColor] = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState(4);
  const [fontSize, setFontSize] = useState(28);
  const [canvasBg, setCanvasBg] = useState('#ffffff');
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);

  // Undo History Stack
  const [history, setHistory] = useState<ImageData[]>([]);
  const snapshotRef = useRef<ImageData | null>(null);

  // Get exact coordinate considering scale
  const getCanvasCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    const touchEvent = e as React.TouchEvent;
    if (touchEvent.touches && touchEvent.touches.length > 0) {
      clientX = touchEvent.touches[0].clientX;
      clientY = touchEvent.touches[0].clientY;
    } else if (touchEvent.changedTouches && touchEvent.changedTouches.length > 0) {
      clientX = touchEvent.changedTouches[0].clientX;
      clientY = touchEvent.changedTouches[0].clientY;
    } else {
      const mouseEvent = e as React.MouseEvent;
      clientX = mouseEvent.clientX;
      clientY = mouseEvent.clientY;
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const saveCanvasState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory(prev => [...prev.slice(-20), data]);
  }, []);

  const undo = () => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const lastState = history[history.length - 1];
    ctx.putImageData(lastState, 0, 0);
    setHistory(prev => prev.slice(0, prev.length - 1));
    showNotification('Ação desfeita com sucesso!', 'success');
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    saveCanvasState();
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    showNotification('Canvas limpo!', 'success');
  };

  // Render Premade Templates
  const loadTemplate = useCallback((templateId: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    saveCanvasState();
    const w = canvas.width;
    const h = canvas.height;

    if (templateId === 'post' || templateId === 'Post Redes Sociais') {
      // Instagram / LinkedIn Post Template
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#4f46e5');
      grad.addColorStop(0.5, '#7c3aed');
      grad.addColorStop(1, '#db2777');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Card Container
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.roundRect ? ctx.roundRect(60, 60, w - 120, h - 120, 24) : ctx.fillRect(60, 60, w - 120, h - 120);
      ctx.fill();

      // Badge
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(90, 95, 180, 36);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('⚡ NOVIDADE', 110, 119);

      // Title
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('Design Gráfico Profissional', 90, 190);

      // Subtitle
      ctx.fillStyle = '#475569';
      ctx.font = '20px sans-serif';
      ctx.fillText('Crie posts impactantes em segundos com o Canva Studio', 90, 230);

      // Call to action button
      ctx.fillStyle = '#4f46e5';
      ctx.fillRect(90, 330, 240, 50);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('Saiba Mais →', 140, 362);

    } else if (templateId === 'banner' || templateId === 'Banner Promocional') {
      // Banner Promocional
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      // Accent Circle
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(w - 100, 100, 220, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 44px sans-serif';
      ctx.fillText('OFERTA ESPECIAL 50% OFF', 60, 160);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '22px sans-serif';
      ctx.fillText('Garanta acesso às melhores ferramentas do mercado agora mesmo.', 60, 210);

      // Discount Tag
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(60, 260, 200, 54);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('CUPOM: CANVA50', 75, 295);

    } else if (templateId === 'business_card' || templateId === 'Cartão de Visita') {
      // Business Card
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, h);

      // Side Color Bar
      ctx.fillStyle = '#6366f1';
      ctx.fillRect(0, 0, 24, h);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 38px sans-serif';
      ctx.fillText('Cassiano Kaique', 70, 160);

      ctx.fillStyle = '#6366f1';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('Executivo de Tecnologia & Inovação', 70, 200);

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(70, 240);
      ctx.lineTo(w - 100, 240);
      ctx.stroke();

      ctx.fillStyle = '#475569';
      ctx.font = '18px sans-serif';
      ctx.fillText('📧 contato@empresa.com.br  |  📱 +55 (11) 99999-8888', 70, 290);
      ctx.fillText('🌐 www.docutools.pro  |  📍 São Paulo, Brasil', 70, 330);

    } else if (templateId === 'infographic' || templateId === 'Infográfico') {
      // Infographic 3 Steps
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      // Header
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('3 Passos para o Sucesso', 60, 80);

      const steps = [
        { num: '1', title: 'Ideação', color: '#6366f1', text: 'Defina a visão e metas do projeto.' },
        { num: '2', title: 'Execução', color: '#ec4899', text: 'Desenvolva com precisão e velocidade.' },
        { num: '3', title: 'Lançamento', color: '#10b981', text: 'Entregue valor aos usuários finais.' },
      ];

      steps.forEach((s, i) => {
        const cx = 130 + i * 260;
        const cy = 250;

        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(cx, cy, 50, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText(s.num, cx - 10, cy + 12);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(s.title, cx - 40, cy + 90);

        ctx.fillStyle = '#64748b';
        ctx.font = '14px sans-serif';
        ctx.fillText(s.text, cx - 80, cy + 120);
      });

    } else if (templateId === 'certificate' || templateId === 'Certificado de Conclusão') {
      // Certificate
      ctx.fillStyle = '#fffbe2';
      ctx.fillRect(0, 0, w, h);

      // Gold Frame
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 12;
      ctx.strokeRect(30, 30, w - 60, h - 60);

      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2;
      ctx.strokeRect(42, 42, w - 84, h - 84);

      ctx.fillStyle = '#78350f';
      ctx.font = 'bold 40px serif';
      ctx.fillText('CERTIFICADO DE EXCELÊNCIA', 150, 130);

      ctx.fillStyle = '#92400e';
      ctx.font = '20px sans-serif';
      ctx.fillText('Certificamos com louvor que o profissional concluiu o treinamento de', 130, 190);

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('DESIGN GRÁFICO & PRODUTIVIDADE', 170, 250);

      ctx.fillStyle = '#b45309';
      ctx.font = '18px sans-serif';
      ctx.fillText('Emitido em 2026 • DocuTools Pro Certification', 230, 320);

      ctx.beginPath();
      ctx.moveTo(w / 2 - 120, 380);
      ctx.lineTo(w / 2 + 120, 380);
      ctx.stroke();
      ctx.fillText('Assinatura do Diretor', w / 2 - 80, 410);
    }

    showNotification(`Modelo "${templateId}" carregado!`, 'success');
  }, [saveCanvasState, showNotification]);

  // Handle Initial Template if passed
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (initialTemplate) {
      loadTemplate(initialTemplate);
    } else {
      loadTemplate('post');
    }
  }, [initialTemplate, canvasBg, loadTemplate]);

  // Drawing Actions
  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoordinates(e);

    saveCanvasState();
    setIsDrawing(true);
    setStartPos(coords);

    // Save snapshot for real-time shape preview
    snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (activeTool === 'bucket') {
      ctx.fillStyle = fillColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setCanvasBg(fillColor);
      setIsDrawing(false);
      showNotification('Fundo preenchido com a cor selecionada!', 'success');
      return;
    }

    if (activeTool === 'text') {
      const text = prompt('Digite o texto a ser inserido no Canva:');
      if (text) {
        ctx.fillStyle = strokeColor;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillText(text, coords.x, coords.y);
        showNotification('Texto adicionado!', 'success');
      }
      setIsDrawing(false);
      return;
    }

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.strokeStyle = activeTool === 'eraser' ? canvasBg : strokeColor;
    ctx.lineWidth = activeTool === 'eraser' ? lineWidth * 4 : activeTool === 'highlighter' ? lineWidth * 3 : lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (activeTool === 'highlighter') {
      ctx.globalAlpha = 0.35;
    } else {
      ctx.globalAlpha = 1.0;
    }
  };

  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || !startPos) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoordinates(e);

    if (activeTool === 'pencil' || activeTool === 'eraser' || activeTool === 'highlighter') {
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    } else if (snapshotRef.current) {
      // Shape real-time preview: restore snapshot before drawing preview shape
      ctx.putImageData(snapshotRef.current, 0, 0);

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.fillStyle = fillColor;
      ctx.globalAlpha = 1.0;

      if (activeTool === 'rectangle') {
        ctx.strokeRect(startPos.x, startPos.y, coords.x - startPos.x, coords.y - startPos.y);
      } else if (activeTool === 'circle') {
        const radius = Math.hypot(coords.x - startPos.x, coords.y - startPos.y);
        ctx.beginPath();
        ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (activeTool === 'line') {
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
      } else if (activeTool === 'arrow') {
        // Draw line with arrowhead
        const headlen = 15;
        const dx = coords.x - startPos.x;
        const dy = coords.y - startPos.y;
        const angle = Math.atan2(dy, dx);

        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.lineTo(coords.x - headlen * Math.cos(angle - Math.PI / 6), coords.y - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(coords.x, coords.y);
        ctx.lineTo(coords.x - headlen * Math.cos(angle + Math.PI / 6), coords.y - headlen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      } else if (activeTool === 'star') {
        // Draw 5-pointed star
        const radius = Math.hypot(coords.x - startPos.x, coords.y - startPos.y);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * radius + startPos.x, -Math.sin((18 + i * 72) * Math.PI / 180) * radius + startPos.y);
          ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * (radius / 2) + startPos.x, -Math.sin((54 + i * 72) * Math.PI / 180) * (radius / 2) + startPos.y);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  };

  const handleStopDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalAlpha = 1.0;
    setStartPos(null);
    snapshotRef.current = null;
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
        ctx.drawImage(img, 100, 100, 320, 220);
        showNotification('Imagem adicionada ao canvas!', 'success');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    saveAs(dataUrl, 'Canva_Design_Studio_Art.png');
    showNotification('Design exportado com sucesso como PNG HD!', 'success');

    if (onSaveToHistory) {
      onSaveToHistory({
        type: 'canva',
        title: 'Arte Canva Studio',
        summary: 'Design gráfico exportado em formato PNG HD.',
        mediaUrl: dataUrl
      });
    }
  };

  return (
    <div className="space-y-4 animate-[fadeIn_0.3s_ease]">
      {/* Top Header Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-rose-500 text-white flex items-center justify-center font-extrabold shadow-lg shadow-purple-500/20 text-xl">
            C
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Canva Design Studio & Marcador
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                PRO INTERATIVO
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Crie artes, cartazes, infográficos e desenhe ou marque documentos em tempo real
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={undo}
            disabled={history.length === 0}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-semibold disabled:opacity-40 flex items-center gap-1.5 transition-all"
            title="Desfazer Última Ação"
          >
            <RotateCcw className="w-4 h-4 text-purple-600" />
            <span className="hidden sm:inline">Desfazer</span>
          </button>

          <button
            onClick={clearCanvas}
            className="p-2.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 hover:bg-rose-100 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition-all"
            title="Limpar Canvas"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Limpar</span>
          </button>

          <button
            onClick={exportImage}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-500/25 transition-all"
          >
            <Download className="w-4 h-4" />
            Exportar PNG HD
          </button>
        </div>
      </div>

      {/* Model Templates Quick Selector */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-4 text-white shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="w-5 h-5 text-amber-300" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Modelos de Design Prontos:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {CANVA_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => loadTemplate(tpl.id)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/15 backdrop-blur-md transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              {tpl.name}
            </button>
          ))}
        </div>
      </div>

      {/* Canva Tools & Palette Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-3 sm:p-4 space-y-3">
        {/* Row 1: Drawing & Shape Tools */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'pencil' as CanvasTool, label: 'Lápis / Caneta', icon: Pencil },
              { id: 'highlighter' as CanvasTool, label: 'Marca-Texto', icon: Highlighter, badge: 'Marcar' },
              { id: 'eraser' as CanvasTool, label: 'Borracha', icon: Eraser },
              { id: 'rectangle' as CanvasTool, label: 'Retângulo', icon: Square },
              { id: 'circle' as CanvasTool, label: 'Círculo', icon: Circle },
              { id: 'line' as CanvasTool, label: 'Linha', icon: MoveRight },
              { id: 'arrow' as CanvasTool, label: 'Seta', icon: MoveRight },
              { id: 'star' as CanvasTool, label: 'Estrela', icon: Star },
              { id: 'text' as CanvasTool, label: 'Texto', icon: Type },
              { id: 'bucket' as CanvasTool, label: 'Preencher', icon: PaintBucket },
            ].map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTool(t.id)}
                  className={`px-3 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    activeTool === t.id
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden md:inline">{t.label}</span>
                  {t.badge && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-400 text-slate-950 font-black">
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Upload Image / Asset */}
          <label className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl text-xs font-bold cursor-pointer flex items-center gap-2 transition-all">
            <ImageIcon className="w-4 h-4" />
            Inserir Foto / Logo
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>
        </div>

        {/* Row 2: Color Palette & Line Width Controls */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          {/* Quick Preset Colors */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Cores:</span>
            {['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#000000', '#ffffff'].map(color => (
              <button
                key={color}
                onClick={() => setStrokeColor(color)}
                className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                  strokeColor === color ? 'ring-2 ring-purple-600 ring-offset-2 scale-110 border-white' : 'border-slate-300'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => setStrokeColor(e.target.value)}
              className="w-8 h-8 rounded-xl cursor-pointer border-none bg-transparent"
              title="Cor Customizada"
            />
          </div>

          {/* Line Width Slider */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Espessura:</span>
              <input
                type="range"
                min="1"
                max="30"
                value={lineWidth}
                onChange={(e) => setLineWidth(Number(e.target.value))}
                className="w-24 accent-purple-600 cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 w-6">
                {lineWidth}px
              </span>
            </div>

            {activeTool === 'text' && (
              <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-3">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Fonte:</span>
                <input
                  type="range"
                  min="12"
                  max="72"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-20 accent-pink-600 cursor-pointer"
                />
                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                  {fontSize}pt
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Canvas Interactive Studio Stage */}
      <div className="bg-slate-200 dark:bg-slate-950 rounded-3xl p-4 sm:p-8 flex justify-center shadow-inner overflow-hidden border border-slate-300/80 dark:border-slate-800">
        <canvas
          ref={canvasRef}
          width={1000}
          height={600}
          onMouseDown={handleStartDraw}
          onMouseMove={handleDraw}
          onMouseUp={handleStopDraw}
          onMouseLeave={handleStopDraw}
          onTouchStart={handleStartDraw}
          onTouchMove={handleDraw}
          onTouchEnd={handleStopDraw}
          className="bg-white rounded-2xl shadow-2xl cursor-crosshair border border-slate-300 dark:border-slate-700 max-w-full touch-none select-none"
        />
      </div>
    </div>
  );
};
