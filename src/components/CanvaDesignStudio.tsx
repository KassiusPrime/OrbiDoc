import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Pencil, Eraser, Square, Circle, Type, Image as ImageIcon,
  RotateCcw, Download, Trash2, Palette, Sparkles, Send, Star,
  Highlighter, PaintBucket, MoveRight, LayoutTemplate, ShieldCheck,
  Zap, Compass, Layers, Check, Heart, Award, Rocket, Crown,
  Flame, Lightbulb, Bell, Target, Globe, Lock, Users, ShoppingBag,
  Gift, ThumbsUp, Tag, MessageSquare, Shield, Smile, CheckCircle,
  Plus, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Grid,
  Eye, MousePointer
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

type CanvaTab = 'templates' | 'text' | 'elements' | 'draw' | 'media';

type CanvasTool = 
  | 'pencil' 
  | 'highlighter' 
  | 'eraser' 
  | 'rectangle' 
  | 'circle' 
  | 'line' 
  | 'arrow' 
  | 'star' 
  | 'bubble'
  | 'text' 
  | 'element'
  | 'bucket';

// Model Templates Definition
const CANVA_TEMPLATES = [
  { id: 'post', name: 'Post Redes Sociais', category: 'Instagram / LinkedIn', desc: 'Arte para post quadrado (1000x600 px)', color: 'bg-indigo-500' },
  { id: 'banner', name: 'Banner Promocional', category: 'Ofertas & Vendas', desc: 'Banner escuro com destaque verde neon', color: 'bg-emerald-500' },
  { id: 'business_card', name: 'Cartão de Visita', category: 'Corporativo', desc: 'Layout profissional e clean', color: 'bg-blue-600' },
  { id: 'infographic', name: 'Infográfico / Fluxo', category: 'Apresentação', desc: 'Diagrama visual em 3 etapas', color: 'bg-purple-600' },
  { id: 'certificate', name: 'Certificado de Conclusão', category: 'Educação', desc: 'Modelo elegante com moldura dourada', color: 'bg-amber-600' },
  { id: 'quote', name: 'Cartaz de Citação', category: 'Redes Sociais', desc: 'Layout minimalista com frase em destaque', color: 'bg-rose-500' },
];

// Pre-styled Text Presets
const TEXT_PRESETS = [
  { id: 'title', label: 'Título de Impacto', font: 'sans-serif', size: 42, bold: true, color: '#0f172a', bg: '#ffffff', border: false },
  { id: 'subtitle', label: 'Subtítulo Moderno', font: 'sans-serif', size: 24, bold: false, color: '#4f46e5', bg: 'transparent', border: false },
  { id: 'badge', label: 'Selo Promocional', font: 'sans-serif', size: 18, bold: true, color: '#ffffff', bg: '#f59e0b', border: true },
  { id: 'neon', label: 'Tag Neon Destaque', font: 'monospace', size: 20, bold: true, color: '#ffffff', bg: '#10b981', border: true },
  { id: 'script', label: 'Citação Elegante', font: 'serif', size: 28, bold: false, italic: true, color: '#475569', bg: 'transparent', border: false },
  { id: 'cta', label: 'Botão Chamada para Ação', font: 'sans-serif', size: 20, bold: true, color: '#ffffff', bg: '#4f46e5', border: true },
];

// Element Library Items
const ELEMENT_ITEMS = [
  { id: 'star', name: 'Estrela', icon: Star, category: 'icons' },
  { id: 'heart', name: 'Coração', icon: Heart, category: 'icons' },
  { id: 'check', name: 'Verificado', icon: CheckCircle, category: 'icons' },
  { id: 'shield', name: 'Escudo / Proteção', icon: ShieldCheck, category: 'icons' },
  { id: 'trophy', name: 'Troféu / Prêmio', icon: Award, category: 'icons' },
  { id: 'rocket', name: 'Foguete', icon: Rocket, category: 'icons' },
  { id: 'crown', name: 'Coroa Premium', icon: Crown, category: 'icons' },
  { id: 'flame', name: 'Fogo / Em Alta', icon: Flame, category: 'icons' },
  { id: 'idea', name: 'Lâmpada / Ideia', icon: Lightbulb, category: 'icons' },
  { id: 'bell', name: 'Notificação', icon: Bell, category: 'icons' },
  { id: 'target', name: 'Alvo / Meta', icon: Target, category: 'icons' },
  { id: 'cart', name: 'Carrinho de Compras', icon: ShoppingBag, category: 'icons' },
  { id: 'gift', name: 'Presente', icon: Gift, category: 'icons' },
  { id: 'like', name: 'Curtida', icon: ThumbsUp, category: 'icons' },
  { id: 'tag', name: 'Etiqueta / Desconto', icon: Tag, category: 'icons' },
  { id: 'smile', name: 'Sorriso / Emoji', icon: Smile, category: 'icons' },
  { id: 'sparkles', name: 'Brilho / Magia', icon: Sparkles, category: 'icons' },
  { id: 'zap', name: 'Raio / Energia', icon: Zap, category: 'icons' },
  { id: 'globe', name: 'Global / Web', icon: Globe, category: 'icons' },
  { id: 'lock', name: 'Cadeado / Segurança', icon: Lock, category: 'icons' },

  { id: 'badge_offer', name: 'Selo 50% OFF', category: 'badges', label: '50% OFF', bg: '#ef4444', text: '#ffffff' },
  { id: 'badge_new', name: 'Selo NOVIDADE', category: 'badges', label: '⚡ NOVIDADE', bg: '#f59e0b', text: '#ffffff' },
  { id: 'badge_vip', name: 'Selo EXCLUSIVO', category: 'badges', label: '👑 VIP', bg: '#7c3aed', text: '#ffffff' },
  { id: 'badge_ok', name: 'Selo APROVADO', category: 'badges', label: '✅ APROVADO', bg: '#10b981', text: '#ffffff' },
  { id: 'badge_free', name: 'Selo GRÁTIS', category: 'badges', label: '🎁 GRÁTIS', bg: '#2563eb', text: '#ffffff' },

  { id: 'rect_filled', name: 'Caixa / Container', category: 'shapes', type: 'rect' },
  { id: 'circle_filled', name: 'Círculo de Destaque', category: 'shapes', type: 'circle' },
  { id: 'speech_bubble', name: 'Balão de Fala', category: 'shapes', type: 'bubble' },
];

export const CanvaDesignStudio: React.FC<CanvaDesignStudioProps> = ({
  initialTemplate,
  onSaveToHistory,
  showNotification = () => {},
  onSendToOcr
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<CanvaTab>('templates');

  // Active Tool & Drawing State
  const [activeTool, setActiveTool] = useState<CanvasTool>('pencil');
  const [strokeColor, setStrokeColor] = useState('#6366f1');
  const [fillColor, setFillColor] = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState(4);
  const [canvasBg, setCanvasBg] = useState('#ffffff');
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);

  // Text Customization State
  const [textInput, setTextInput] = useState('Texto Exemplo');
  const [fontFamily, setFontFamily] = useState('sans-serif');
  const [fontSize, setFontSize] = useState(32);
  const [isBold, setIsBold] = useState(true);
  const [isItalic, setIsItalic] = useState(false);
  const [textColor, setTextColor] = useState('#0f172a');
  const [textBgColor, setTextBgColor] = useState('transparent');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');

  // Element Customization State
  const [selectedElement, setSelectedElement] = useState<string>('star');
  const [elementColor, setElementColor] = useState('#f59e0b');
  const [elementSize, setElementSize] = useState(60);
  const [elementSearchTerm, setElementSearchTerm] = useState('');
  const [elementCategoryFilter, setElementCategoryFilter] = useState<'all' | 'icons' | 'badges' | 'shapes'>('all');

  // Undo History Stack
  const [history, setHistory] = useState<ImageData[]>([]);
  const snapshotRef = useRef<ImageData | null>(null);

  // Get exact coordinate considering canvas display scale
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

  // Render Vector Elements on Canvas
  const drawVectorElement = useCallback((ctx: CanvasRenderingContext2D, elemId: string, x: number, y: number, size: number, color: string) => {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;

    if (elemId === 'star') {
      const spikes = 5;
      const outerRadius = size / 2;
      const innerRadius = size / 4;
      let rot = (Math.PI / 2) * 3;
      let cx = x;
      let cy = y;
      let step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        cx = x + Math.cos(rot) * outerRadius;
        cy = y + Math.sin(rot) * outerRadius;
        ctx.lineTo(cx, cy);
        rot += step;

        cx = x + Math.cos(rot) * innerRadius;
        cy = y + Math.sin(rot) * innerRadius;
        ctx.lineTo(cx, cy);
        rot += step;
      }
      ctx.lineTo(x, y - outerRadius);
      ctx.closePath();
      ctx.fill();

    } else if (elemId === 'heart') {
      const topCurveHeight = size * 0.3;
      ctx.beginPath();
      ctx.moveTo(x, y + size * 0.25);
      ctx.bezierCurveTo(x, y, x - size / 2, y, x - size / 2, y + topCurveHeight);
      ctx.bezierCurveTo(x - size / 2, y + (size + topCurveHeight) / 2, x, y + size * 0.8, x, y + size);
      ctx.bezierCurveTo(x, y + size * 0.8, x + size / 2, y + (size + topCurveHeight) / 2, x + size / 2, y + topCurveHeight);
      ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + size * 0.25);
      ctx.closePath();
      ctx.fill();

    } else if (elemId === 'check') {
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = size * 0.12;
      ctx.beginPath();
      ctx.moveTo(x - size * 0.2, y);
      ctx.lineTo(x - size * 0.05, y + size * 0.18);
      ctx.lineTo(x + size * 0.22, y - size * 0.18);
      ctx.stroke();

    } else if (elemId === 'shield') {
      const w = size;
      const h = size * 1.2;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y - h / 2);
      ctx.lineTo(x + w / 2, y - h / 2);
      ctx.lineTo(x + w / 2, y);
      ctx.quadraticCurveTo(x + w / 2, y + h / 2, x, y + h / 2);
      ctx.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y);
      ctx.closePath();
      ctx.fill();

    } else if (elemId === 'trophy') {
      ctx.fillRect(x - size * 0.2, y + size * 0.3, size * 0.4, size * 0.2);
      ctx.fillRect(x - size * 0.35, y + size * 0.48, size * 0.7, size * 0.1);
      ctx.beginPath();
      ctx.arc(x, y - size * 0.1, size * 0.3, 0, Math.PI);
      ctx.fill();
      ctx.fillRect(x - size * 0.3, y - size * 0.4, size * 0.6, size * 0.35);

    } else if (elemId === 'flame') {
      ctx.beginPath();
      ctx.moveTo(x, y + size * 0.5);
      ctx.quadraticCurveTo(x + size * 0.4, y + size * 0.3, x + size * 0.3, y - size * 0.1);
      ctx.quadraticCurveTo(x + size * 0.1, y - size * 0.5, x, y - size * 0.5);
      ctx.quadraticCurveTo(x - size * 0.2, y - size * 0.1, x - size * 0.3, y + size * 0.1);
      ctx.quadraticCurveTo(x - size * 0.4, y + size * 0.4, x, y + size * 0.5);
      ctx.closePath();
      ctx.fill();

    } else if (elemId === 'bubble') {
      const w = size * 1.8;
      const h = size * 1.1;
      const r = 16;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x - w / 2, y - h / 2, w, h, r) : ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 10, y + h / 2);
      ctx.lineTo(x - 25, y + h / 2 + 18);
      ctx.lineTo(x + 5, y + h / 2);
      ctx.closePath();
      ctx.fill();

    } else {
      // Default Circle / Badge shape
      ctx.beginPath();
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }, []);

  // Draw Styled Text Block on Canvas
  const drawStyledTextOnCanvas = useCallback((
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    font: string,
    size: number,
    bold: boolean,
    italic: boolean,
    color: string,
    bgColor: string,
    align: 'left' | 'center' | 'right'
  ) => {
    ctx.save();
    const fontStyle = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${size}px ${font}`;
    ctx.font = fontStyle;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const paddingX = 18;
    const paddingY = 12;

    // Calculate background box rect depending on alignment
    let bgX = x - paddingX;
    if (align === 'center') bgX = x - textWidth / 2 - paddingX;
    if (align === 'right') bgX = x - textWidth - paddingX;
    const bgY = y - size / 2 - paddingY / 2;
    const bgWidth = textWidth + paddingX * 2;
    const bgHeight = size + paddingY;

    // Render background badge if background color is set
    if (bgColor && bgColor !== 'transparent') {
      ctx.fillStyle = bgColor;
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgWidth, bgHeight, 12);
        ctx.fill();
      } else {
        ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
      }
    }

    // Render text
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }, []);

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
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.roundRect ? ctx.roundRect(60, 50, w - 120, h - 100, 24) : ctx.fillRect(60, 50, w - 120, h - 100);
      ctx.fill();

      // Badge
      ctx.fillStyle = '#f59e0b';
      ctx.roundRect ? ctx.roundRect(90, 85, 180, 40, 10) : ctx.fillRect(90, 85, 180, 40);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('⚡ NOVIDADE 2026', 110, 110);

      // Title
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText('Design Gráfico & Artes com IA', 90, 185);

      // Subtitle
      ctx.fillStyle = '#475569';
      ctx.font = '22px sans-serif';
      ctx.fillText('Crie posts, selos, marcas e documentos com perfeição no Canva Studio.', 90, 235);

      // Decorative vector star
      drawVectorElement(ctx, 'star', w - 140, 150, 70, '#f59e0b');

      // Call to action button
      ctx.fillStyle = '#4f46e5';
      ctx.roundRect ? ctx.roundRect(90, 320, 260, 54, 14) : ctx.fillRect(90, 320, 260, 54);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('Começar Agora →', 130, 355);

    } else if (templateId === 'banner' || templateId === 'Banner Promocional') {
      // Banner Promocional
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      // Accent Circle
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(w - 100, 100, 240, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px sans-serif';
      ctx.fillText('OFERTA IMPERDÍVEL 50% OFF', 60, 160);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '24px sans-serif';
      ctx.fillText('Garanta acesso vitalício ao pacote completo de ferramentas de produtividade.', 60, 220);

      // Discount Tag
      ctx.fillStyle = '#ef4444';
      ctx.roundRect ? ctx.roundRect(60, 280, 260, 60, 14) : ctx.fillRect(60, 280, 260, 60);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('CUPOM: CANVA50', 85, 318);

      drawVectorElement(ctx, 'crown', w - 160, 260, 80, '#f59e0b');

    } else if (templateId === 'business_card' || templateId === 'Cartão de Visita') {
      // Business Card
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, h);

      // Side Color Bar
      ctx.fillStyle = '#6366f1';
      ctx.fillRect(0, 0, 28, h);

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 42px sans-serif';
      ctx.fillText('DocuTools Pro Studio', 70, 150);

      ctx.fillStyle = '#6366f1';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('Soluções em Inteligência e Documentação', 70, 195);

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(70, 235);
      ctx.lineTo(w - 100, 235);
      ctx.stroke();

      ctx.fillStyle = '#475569';
      ctx.font = '20px sans-serif';
      ctx.fillText('📧 contato@docutools.pro  |  📱 +55 (11) 99999-8888', 70, 290);
      ctx.fillText('🌐 www.docutools.pro  |  📍 São Paulo, SP - Brasil', 70, 335);

      drawVectorElement(ctx, 'shield', w - 120, 160, 80, '#6366f1');

    } else if (templateId === 'infographic' || templateId === 'Infográfico') {
      // Infographic 3 Steps
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      // Header
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('3 Passos para o Sucesso Visual', 60, 80);

      const steps = [
        { num: '1', title: 'Planejamento', color: '#6366f1', text: 'Escolha um modelo ou canvas em branco.' },
        { num: '2', title: 'Criação', color: '#ec4899', text: 'Adicione textos, formas e ícones marcantes.' },
        { num: '3', title: 'Exportação', color: '#10b981', text: 'Gere sua arte em altíssima resolução PNG.' },
      ];

      steps.forEach((s, i) => {
        const cx = 160 + i * 280;
        const cy = 260;

        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(cx, cy, 55, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(s.num, cx, cy + 12);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(s.title, cx, cy + 95);

        ctx.fillStyle = '#64748b';
        ctx.font = '15px sans-serif';
        ctx.fillText(s.text, cx, cy + 130);
      });
      ctx.textAlign = 'left';

    } else if (templateId === 'certificate' || templateId === 'Certificado de Conclusão') {
      // Certificate
      ctx.fillStyle = '#fffbe2';
      ctx.fillRect(0, 0, w, h);

      // Gold Frame
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 14;
      ctx.strokeRect(30, 30, w - 60, h - 60);

      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 2;
      ctx.strokeRect(44, 44, w - 88, h - 88);

      ctx.fillStyle = '#78350f';
      ctx.font = 'bold 42px serif';
      ctx.textAlign = 'center';
      ctx.fillText('CERTIFICADO DE EXCELÊNCIA', w / 2, 130);

      ctx.fillStyle = '#92400e';
      ctx.font = '22px sans-serif';
      ctx.fillText('Certificamos com louvor que o usuário concluiu com êxito a formação em', w / 2, 195);

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 34px sans-serif';
      ctx.fillText('DESIGN GRÁFICO & PRODUTIVIDADE COM IA', w / 2, 260);

      ctx.fillStyle = '#b45309';
      ctx.font = '18px sans-serif';
      ctx.fillText('Emitido em 2026 • DocuTools Pro Certification', w / 2, 330);

      drawVectorElement(ctx, 'trophy', w / 2, 420, 60, '#d97706');
      ctx.textAlign = 'left';

    } else if (templateId === 'quote' || templateId === 'Cartaz de Citação') {
      // Quote Poster
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#6366f1';
      ctx.font = 'bold 120px serif';
      ctx.fillText('“', 80, 160);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'italic 32px serif';
      ctx.fillText('A simplicidade é o último grau de sofisticação.', 100, 240);

      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('— Leonardo da Vinci', 100, 310);
    }

    showNotification(`Modelo "${templateId}" carregado no Canva!`, 'success');
  }, [drawVectorElement, saveCanvasState, showNotification]);

  // Handle Initial Template
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

  // Place Text on Canvas Center
  const placeTextAtCenter = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    saveCanvasState();
    drawStyledTextOnCanvas(
      ctx,
      textInput,
      canvas.width / 2,
      canvas.height / 2,
      fontFamily,
      fontSize,
      isBold,
      isItalic,
      textColor,
      textBgColor,
      textAlign
    );
    showNotification('Texto adicionado ao centro do canvas!', 'success');
  };

  // Place Selected Element at Canvas Center
  const placeElementAtCenter = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    saveCanvasState();
    drawVectorElement(
      ctx,
      selectedElement,
      canvas.width / 2,
      canvas.height / 2,
      elementSize,
      elementColor
    );
    showNotification('Elemento adicionado ao centro do canvas!', 'success');
  };

  // Drawing & Placement Events
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
      showNotification('Fundo preenchido com sucesso!', 'success');
      return;
    }

    if (activeTool === 'text') {
      drawStyledTextOnCanvas(
        ctx,
        textInput,
        coords.x,
        coords.y,
        fontFamily,
        fontSize,
        isBold,
        isItalic,
        textColor,
        textBgColor,
        textAlign
      );
      setIsDrawing(false);
      showNotification('Texto inserido!', 'success');
      return;
    }

    if (activeTool === 'element') {
      drawVectorElement(
        ctx,
        selectedElement,
        coords.x,
        coords.y,
        elementSize,
        elementColor
      );
      setIsDrawing(false);
      showNotification('Elemento inserido!', 'success');
      return;
    }

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.strokeStyle = activeTool === 'eraser' ? canvasBg : strokeColor;
    ctx.lineWidth = activeTool === 'eraser' ? lineWidth * 4 : activeTool === 'highlighter' ? lineWidth * 3.5 : lineWidth;
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
      // Shape real-time preview
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
        const headlen = 16;
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
        drawVectorElement(ctx, 'star', coords.x, coords.y, Math.hypot(coords.x - startPos.x, coords.y - startPos.y) * 2, strokeColor);
      } else if (activeTool === 'bubble') {
        drawVectorElement(ctx, 'bubble', coords.x, coords.y, Math.hypot(coords.x - startPos.x, coords.y - startPos.y) * 2, strokeColor);
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
        ctx.drawImage(img, 100, 100, 360, 240);
        showNotification('Imagem adicionada ao canvas com sucesso!', 'success');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const exportImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    saveAs(dataUrl, 'Canva_Studio_Design.png');
    showNotification('Design exportado em PNG HD com sucesso!', 'success');

    if (onSaveToHistory) {
      onSaveToHistory({
        type: 'canva',
        title: 'Arte do Canva Studio',
        summary: 'Design gráfico criado com modelos, texto e biblioteca de ícones.',
        mediaUrl: dataUrl
      });
    }
  };

  const handleSendToOcrAction = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    if (onSendToOcr) {
      onSendToOcr(dataUrl);
      showNotification('Arte enviada para a ferramenta de OCR!', 'success');
    }
  };

  return (
    <div className="space-y-5 animate-[fadeIn_0.3s_ease]">
      {/* Top Main Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-600 to-indigo-600 text-white flex items-center justify-center font-extrabold shadow-lg shadow-purple-500/20 text-xl">
            C
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              DocuSwiss Canva Studio Pro
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300">
                MODELOS & ÍCONES
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Crie artes, adicione textos personalizados sobre modelos e insira elementos gráficos
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

          {onSendToOcr && (
            <button
              onClick={handleSendToOcrAction}
              className="px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all border border-indigo-200 dark:border-indigo-800"
            >
              <Eye className="w-4 h-4" />
              Enviar para OCR
            </button>
          )}

          <button
            onClick={exportImage}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 hover:from-purple-700 hover:to-rose-700 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-500/25 transition-all"
          >
            <Download className="w-4 h-4" />
            Exportar PNG HD
          </button>
        </div>
      </div>

      {/* Main Studio Interactive Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Control Panel / Tabs (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Section Navigation Tabs */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
            {[
              { id: 'templates' as CanvaTab, label: 'Modelos', icon: LayoutTemplate },
              { id: 'text' as CanvaTab, label: 'Texto', icon: Type },
              { id: 'elements' as CanvaTab, label: 'Ícones', icon: Sparkles },
              { id: 'draw' as CanvaTab, label: 'Pincel', icon: Pencil },
              { id: 'media' as CanvaTab, label: 'Mídia', icon: ImageIcon },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === 'text') setActiveTool('text');
                    if (tab.id === 'elements') setActiveTool('element');
                    if (tab.id === 'draw') setActiveTool('pencil');
                  }}
                  className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: MODELOS PRONTOS */}
          {activeTab === 'templates' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-5 space-y-3">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <LayoutTemplate className="w-4 h-4 text-purple-500" />
                Modelos de Design Prontos
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Escolha um modelo base para aplicar instantaneamente no canvas:
              </p>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {CANVA_TEMPLATES.map(tpl => (
                  <div
                    key={tpl.id}
                    onClick={() => loadTemplate(tpl.id)}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/60 hover:bg-purple-50 dark:hover:bg-purple-950/30 border border-slate-200/80 dark:border-slate-700/80 hover:border-purple-300 rounded-2xl cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${tpl.color}`} />
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">
                          {tpl.name}
                        </h5>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {tpl.desc}
                      </p>
                    </div>
                    <Sparkles className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: TEXTO EM CIMA DO CANVAS & MODELOS */}
          {activeTab === 'text' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Type className="w-4 h-4 text-purple-500" />
                  Texto Personalizado em Cima do Modelo
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-700 font-bold">
                  MODO TEXTO
                </span>
              </div>

              {/* Text Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Conteúdo do Texto:
                </label>
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Digite seu texto aqui..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>

              {/* Typography Options */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-500">Fonte:</label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none"
                  >
                    <option value="sans-serif">Sans-Serif (Moderno)</option>
                    <option value="serif">Serif (Elegante)</option>
                    <option value="monospace">Monospace (Tech)</option>
                    <option value="Impact">Impact (Título Forte)</option>
                    <option value="Georgia">Georgia (Clássico)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500">Tamanho ({fontSize}px):</label>
                  <input
                    type="range"
                    min="14"
                    max="96"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full mt-2 accent-purple-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Style Controls (Bold, Italic, Align) */}
              <div className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex gap-1">
                  <button
                    onClick={() => setIsBold(!isBold)}
                    className={`p-1.5 rounded-xl text-xs font-bold ${isBold ? 'bg-purple-600 text-white' : 'text-slate-600'}`}
                    title="Negrito"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsItalic(!isItalic)}
                    className={`p-1.5 rounded-xl text-xs font-bold ${isItalic ? 'bg-purple-600 text-white' : 'text-slate-600'}`}
                    title="Itálico"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex gap-1">
                  <button
                    onClick={() => setTextAlign('left')}
                    className={`p-1.5 rounded-xl ${textAlign === 'left' ? 'bg-purple-600 text-white' : 'text-slate-600'}`}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setTextAlign('center')}
                    className={`p-1.5 rounded-xl ${textAlign === 'center' ? 'bg-purple-600 text-white' : 'text-slate-600'}`}
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setTextAlign('right')}
                    className={`p-1.5 rounded-xl ${textAlign === 'right' ? 'bg-purple-600 text-white' : 'text-slate-600'}`}
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Color Controls */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-500">Cor do Texto:</label>
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-full h-8 mt-1 rounded-xl cursor-pointer border-none bg-transparent"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">Cor do Fundo (Selo):</label>
                  <div className="flex items-center gap-1.5 mt-1">
                    <input
                      type="color"
                      value={textBgColor === 'transparent' ? '#ffffff' : textBgColor}
                      onChange={(e) => setTextBgColor(e.target.value)}
                      className="w-full h-8 rounded-xl cursor-pointer border-none bg-transparent"
                    />
                    <button
                      onClick={() => setTextBgColor('transparent')}
                      className="px-2 py-1 bg-slate-200 text-[10px] font-bold rounded-lg"
                    >
                      Sem Fundo
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={placeTextAtCenter}
                  className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar ao Centro do Canvas
                </button>
                
                <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                  💡 Ou clique diretamente em qualquer ponto do canvas para posicionar o texto!
                </p>
              </div>

              {/* Text Presets Grid */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Estilos de Texto Rápidos:
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {TEXT_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setFontFamily(preset.font);
                        setFontSize(preset.size);
                        setIsBold(preset.bold);
                        setIsItalic(!!preset.italic);
                        setTextColor(preset.color);
                        setTextBgColor(preset.bg);
                        setTextInput(preset.label);
                        setActiveTool('text');
                        showNotification(`Estilo "${preset.label}" aplicado!`, 'success');
                      }}
                      className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-purple-50 text-slate-700 dark:text-slate-300 text-[11px] font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-left truncate"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BIBLIOTECA DE ÍCONES E ELEMENTOS */}
          {activeTab === 'elements' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  Biblioteca de Ícones & Elementos
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-700 font-bold">
                  ELEMENTOS
                </span>
              </div>

              {/* Search Bar & Category Filter */}
              <div className="space-y-2">
                <input
                  type="text"
                  value={elementSearchTerm}
                  onChange={(e) => setElementSearchTerm(e.target.value)}
                  placeholder="Pesquisar ícone ou selo..."
                  className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs rounded-xl outline-none focus:ring-2 focus:ring-purple-500"
                />

                <div className="flex gap-1 overflow-x-auto pb-1">
                  {[
                    { id: 'all', label: 'Todos' },
                    { id: 'icons', label: 'Ícones' },
                    { id: 'badges', label: 'Selos' },
                    { id: 'shapes', label: 'Formas' },
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setElementCategoryFilter(cat.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                        elementCategoryFilter === cat.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Element Color & Size */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-500">Cor do Elemento:</label>
                  <input
                    type="color"
                    value={elementColor}
                    onChange={(e) => setElementColor(e.target.value)}
                    className="w-full h-8 mt-1 rounded-xl cursor-pointer border-none bg-transparent"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">Tamanho ({elementSize}px):</label>
                  <input
                    type="range"
                    min="20"
                    max="160"
                    value={elementSize}
                    onChange={(e) => setElementSize(Number(e.target.value))}
                    className="w-full mt-2 accent-purple-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Icons Grid */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500">Ícones Disponíveis:</label>
                <div className="grid grid-cols-5 gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {ELEMENT_ITEMS
                    .filter(e => e.icon)
                    .filter(e => elementCategoryFilter === 'all' || elementCategoryFilter === 'icons')
                    .filter(e => !elementSearchTerm || e.name.toLowerCase().includes(elementSearchTerm.toLowerCase()))
                    .map(item => {
                      const IconElem = item.icon!;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setSelectedElement(item.id);
                            setActiveTool('element');
                            showNotification(`Ícone "${item.name}" selecionado! Clique no canvas para aplicar.`, 'success');
                          }}
                          className={`p-3 rounded-2xl flex items-center justify-center transition-all ${
                            selectedElement === item.id
                              ? 'bg-purple-600 text-white shadow-md'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                          title={item.name}
                        >
                          <IconElem className="w-5 h-5" />
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* Badges & Stamps Presets */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-[11px] font-bold text-slate-500">Selos & Badges Prontos:</label>
                <div className="grid grid-cols-2 gap-2">
                  {ELEMENT_ITEMS
                    .filter(e => e.category === 'badges')
                    .filter(e => elementCategoryFilter === 'all' || elementCategoryFilter === 'badges')
                    .filter(e => !elementSearchTerm || e.name.toLowerCase().includes(elementSearchTerm.toLowerCase()))
                    .map(badge => (
                    <button
                      key={badge.id}
                      onClick={() => {
                        setTextInput(badge.label!);
                        setTextBgColor(badge.bg!);
                        setTextColor(badge.text!);
                        setFontSize(22);
                        setIsBold(true);
                        setActiveTool('text');
                        showNotification(`Selo "${badge.name}" pronto! Clique no canvas para colar.`, 'success');
                      }}
                      className="p-2 rounded-xl text-xs font-bold text-white text-center shadow-sm hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: badge.bg }}
                    >
                      {badge.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={placeElementAtCenter}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md"
              >
                <Plus className="w-4 h-4" />
                Inserir Ícone no Centro
              </button>
            </div>
          )}

          {/* TAB 4: PINCEIS, MARCADOR & FORMAS */}
          {activeTab === 'draw' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-5 space-y-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-purple-500" />
                Ferramentas de Desenho & Marcação
              </h4>

              {/* Tools Selection Grid */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'pencil' as CanvasTool, label: 'Lápis', icon: Pencil },
                  { id: 'highlighter' as CanvasTool, label: 'Marca-Texto', icon: Highlighter },
                  { id: 'eraser' as CanvasTool, label: 'Borracha', icon: Eraser },
                  { id: 'rectangle' as CanvasTool, label: 'Retângulo', icon: Square },
                  { id: 'circle' as CanvasTool, label: 'Círculo', icon: Circle },
                  { id: 'line' as CanvasTool, label: 'Linha', icon: MoveRight },
                  { id: 'arrow' as CanvasTool, label: 'Seta', icon: MoveRight },
                  { id: 'bucket' as CanvasTool, label: 'Preencher', icon: PaintBucket },
                ].map(t => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTool(t.id)}
                      className={`p-2.5 rounded-2xl text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                        activeTool === t.id
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Color & Thickness Sliders */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="text-[11px] font-bold text-slate-500">Cor do Pincel:</label>
                  <div className="flex items-center gap-2 mt-1">
                    {['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#000000', '#ffffff'].map(c => (
                      <button
                        key={c}
                        onClick={() => setStrokeColor(c)}
                        className={`w-6 h-6 rounded-full border ${strokeColor === c ? 'ring-2 ring-purple-600 scale-110' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <input
                      type="color"
                      value={strokeColor}
                      onChange={(e) => setStrokeColor(e.target.value)}
                      className="w-7 h-7 rounded-xl cursor-pointer border-none bg-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500">Espessura ({lineWidth}px):</label>
                  <input
                    type="range"
                    min="1"
                    max="40"
                    value={lineWidth}
                    onChange={(e) => setLineWidth(Number(e.target.value))}
                    className="w-full mt-1 accent-purple-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: MIDIA E UPLOAD */}
          {activeTab === 'media' && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-5 space-y-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-500" />
                Upload de Imagens & Fotos
              </h4>

              <label className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-purple-500 rounded-3xl cursor-pointer flex flex-col items-center justify-center gap-2 text-center transition-all group">
                <ImageIcon className="w-8 h-8 text-purple-500 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Clique para carregar imagem
                </span>
                <span className="text-[11px] text-slate-400">
                  PNG, JPG, WEBP ou SVG
                </span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-[11px] font-bold text-slate-500">Cor do Fundo do Canvas:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={canvasBg}
                    onChange={(e) => {
                      setCanvasBg(e.target.value);
                      const canvas = canvasRef.current;
                      if (canvas) {
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                          ctx.fillStyle = e.target.value;
                          ctx.fillRect(0, 0, canvas.width, canvas.height);
                        }
                      }
                    }}
                    className="w-full h-8 rounded-xl cursor-pointer border-none bg-transparent"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Canvas Interactive Stage (8 Cols) */}
        <div className="lg:col-span-8 space-y-3">
          
          {/* Top Canvas Instruction Banner */}
          <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 rounded-2xl px-4 py-2.5 flex items-center justify-between text-xs text-purple-800 dark:text-purple-300 font-medium">
            <div className="flex items-center gap-2">
              <MousePointer className="w-4 h-4 text-purple-600 animate-pulse" />
              <span>
                Ferramenta Ativa: <strong className="uppercase">{activeTool}</strong>. Clique ou arraste no canvas para criar.
              </span>
            </div>
            <span className="text-[11px] font-bold text-purple-600 bg-white dark:bg-slate-900 px-2.5 py-0.5 rounded-full">
              1000 x 600 px
            </span>
          </div>

          {/* Interactive Canvas Stage */}
          <div className="bg-slate-900 rounded-3xl p-4 sm:p-6 flex justify-center items-center shadow-2xl border border-slate-800 min-h-[520px] overflow-hidden relative group">
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
              className="bg-white rounded-2xl shadow-2xl cursor-crosshair border border-slate-700 max-w-full touch-none select-none transition-transform"
            />
          </div>
        </div>

      </div>
    </div>
  );
};
