import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  IconPencil, IconEraser, IconSquare, IconCircle, IconLetterT as Type, IconPhoto as ImageIcon,
  IconRotate, IconDownload, IconTrash, IconPalette, IconSparkles, IconSend, IconStar,
  IconPaint, IconArrowRight, IconLayout, IconShieldCheck,
  IconBolt, IconCompass, IconStack2 as Layers, IconCheck, IconHeart, IconTrophy, IconRocket, IconCrown,
  IconFlame, IconBulb, IconBell, IconTarget, IconGlobe, IconLock, IconUsers, IconShoppingBag,
  IconGift, IconThumbUp, IconTag, IconMessage, IconMoodSmile as IconSmile, IconCircleCheck,
  IconPlus, IconAlignLeft, IconAlignCenter, IconAlignRight, IconBold, IconItalic, IconLayoutGrid as Grid,
  IconEye, IconPointer as MousePointer, IconMaximize, IconMinimize, IconWand, IconRefresh, IconCopy,
  IconAdjustmentsHorizontal as Sliders, IconFileExport, IconCamera, IconVideo, IconMusic, IconBuilding, IconUser, IconMail, IconPhone, IconMapPin,
  IconHistory, IconFolder, IconUpload, IconCloud, IconVideoPlus, IconDeviceDesktop, IconPlayerPlay, IconBrandGoogleDrive
} from '@tabler/icons-react';
import { saveAs } from 'file-saver';
import pptxgen from 'pptxgenjs';
import { jsPDF } from 'jspdf';
import { HistoryItem } from '../types';
import { SmartGraphicsLibrary, GraphicItem } from './SmartGraphicsLibrary';

interface CanvaDesignStudioProps {
  initialTemplate?: string;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  showNotification?: (msg: string, type?: 'success' | 'error') => void;
  onSendToOcr?: (textOrImage: string) => void;
  engineProvider?: string;
  engineModel?: string;
}

type CanvaTab = 'templates' | 'ai' | 'graphics' | 'text' | 'layers' | 'history' | 'animations' | 'export' | 'settings';

export interface CanvasObject {
  id: string;
  type: 'text' | 'shape' | 'icon' | 'image' | 'badge';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  blurFilter: number;
  contrastFilter: number;
  brightnessFilter: number;
  hueRotateFilter: number;
  content: string; // Text string or Image Data URL or icon shape key
  zIndex: number;
  locked: boolean;
  fontFamily: string;
  fontSize: number;
  isBold: boolean;
  isItalic: boolean;
  textAlign: 'left' | 'center' | 'right';
  animation: 'none' | 'fade' | 'slide_up' | 'zoom' | 'spin' | 'bounce';
}

interface CanvasVersion {
  id: string;
  timestamp: string;
  label: string;
  objects: CanvasObject[];
  bg: string;
}

const CANVAS_PRESETS = [
  { id: 'banner', name: 'Banner Padrão (1000x600)', width: 1000, height: 600 },
  { id: 'square', name: 'Post Quadrado Instagram (1000x1000)', width: 1000, height: 1000 },
  { id: 'story', name: 'Story / Reel (600x1000)', width: 600, height: 1000 },
  { id: 'youtube', name: 'YouTube Thumbnail (1280x720)', width: 1280, height: 720 },
  { id: 'presentation', name: 'Slide de Apresentação (1920x1080)', width: 1920, height: 1080 },
  { id: 'business_card', name: 'Cartão de Visita (800x500)', width: 800, height: 500 },
];

const BACKGROUND_GRADIENTS = [
  { id: 'solid_white', name: 'Branco Puro', value: '#ffffff' },
  { id: 'solid_dark', name: 'Escuro Minimalista', value: '#0f172a' },
  { id: 'sunset', name: 'Sunset Violet', value: 'linear-gradient(135deg, #4f46e5, #7c3aed, #db2777)' },
  { id: 'emerald', name: 'Emerald Luxury', value: 'linear-gradient(135deg, #064e3b, #059669, #34d399)' },
  { id: 'gold', name: 'Royal Gold', value: 'linear-gradient(135deg, #78350f, #d97706, #fef3c7)' },
  { id: 'cyberpunk', name: 'Cyberpunk Dark', value: 'linear-gradient(135deg, #0f172a, #1e1b4b, #312e81)' },
];

const CANVA_TEMPLATES = [
  { id: 'post', name: 'Post Redes Sociais', desc: 'Arte profissional com badge e CTA', color: 'bg-indigo-500' },
  { id: 'banner', name: 'Banner Promocional', desc: 'Banner escuro com destaque verde neon 50% OFF', color: 'bg-emerald-500' },
  { id: 'business_card', name: 'Cartão de Visita', desc: 'Layout limpo com divisores e ícones de contato', color: 'bg-blue-600' },
  { id: 'infographic', name: 'Infográfico / Fluxo', desc: 'Diagrama visual em 3 etapas coloridas', color: 'bg-purple-600' },
  { id: 'certificate', name: 'Certificado de Conclusão', desc: 'Modelo elegante com moldura dourada e troféu', color: 'bg-amber-600' },
  { id: 'quote', name: 'Cartaz de Citação', desc: 'Layout minimalista com frase inspiradora', color: 'bg-rose-500' },
];

export const CanvaDesignStudio: React.FC<CanvaDesignStudioProps> = ({
  initialTemplate = 'post',
  onSaveToHistory,
  showNotification = () => {},
  onSendToOcr,
  engineProvider = 'gemini',
  engineModel = 'gemini-2.5-flash'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Studio Dimensions & Presets
  const [canvasWidth, setCanvasWidth] = useState(1000);
  const [canvasHeight, setCanvasHeight] = useState(600);
  const [canvasBg, setCanvasBg] = useState('#ffffff');
  const [activeTab, setActiveTab] = useState<CanvaTab>('templates');
  const [isExpansiveView, setIsExpansiveView] = useState(false);

  // Canvas Objects Engine State
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Snap Alignment Guide Lines
  const [showSnapGuides, setShowSnapGuides] = useState(false);
  const [snapLineX, setSnapLineX] = useState<number | null>(null);
  const [snapLineY, setSnapLineY] = useState<number | null>(null);

  // Custom Font Library & Loader
  const [fontList, setFontList] = useState<string[]>([
    'sans-serif', 'serif', 'monospace', 'Inter', 'Playfair Display',
    'Montserrat', 'Poppins', 'Roboto', 'Oswald', 'Dancing Script'
  ]);
  const [customFontName, setCustomFontName] = useState('');

  // Version History State
  const [versions, setVersions] = useState<CanvasVersion[]>([]);

  // Simulated Real-time Collaboration Editors
  const [collaborators] = useState([
    { name: 'Ana Souza', role: 'Editando Texto', avatarBg: 'bg-pink-500' },
    { name: 'Carlos M.', role: 'Adicionando Ícones', avatarBg: 'bg-indigo-500' },
  ]);

  // Selected Object Getter
  const activeObject = objects.find(o => o.id === selectedObjectId);

  // Record Version Snapshot
  const recordVersionSnapshot = useCallback((label: string = 'Alteração no Canvas') => {
    const newVersion: CanvasVersion = {
      id: `ver_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      label,
      objects: JSON.parse(JSON.stringify(objects)),
      bg: canvasBg,
    };
    setVersions(prev => [newVersion, ...prev.slice(0, 15)]);
  }, [objects, canvasBg]);

  // Add Object Helper
  const addObject = useCallback((newObj: Partial<CanvasObject>) => {
    const obj: CanvasObject = {
      id: `obj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: newObj.type || 'text',
      x: newObj.x ?? canvasWidth / 2 - 100,
      y: newObj.y ?? canvasHeight / 2 - 40,
      width: newObj.width || 200,
      height: newObj.height || 80,
      rotation: newObj.rotation || 0,
      opacity: newObj.opacity ?? 1,
      fill: newObj.fill || '#4f46e5',
      stroke: newObj.stroke || 'transparent',
      strokeWidth: newObj.strokeWidth || 0,
      shadowColor: newObj.shadowColor || 'rgba(0,0,0,0.2)',
      shadowBlur: newObj.shadowBlur || 0,
      shadowOffsetX: newObj.shadowOffsetX || 0,
      shadowOffsetY: newObj.shadowOffsetY || 0,
      blurFilter: newObj.blurFilter || 0,
      contrastFilter: newObj.contrastFilter || 100,
      brightnessFilter: newObj.brightnessFilter || 100,
      hueRotateFilter: newObj.hueRotateFilter || 0,
      content: newObj.content || 'Novo Texto',
      zIndex: objects.length + 1,
      locked: false,
      fontFamily: newObj.fontFamily || 'sans-serif',
      fontSize: newObj.fontSize || 32,
      isBold: newObj.isBold ?? true,
      isItalic: newObj.isItalic ?? false,
      textAlign: newObj.textAlign || 'center',
      animation: newObj.animation || 'none',
    };

    setObjects(prev => [...prev, obj]);
    setSelectedObjectId(obj.id);
    recordVersionSnapshot(`Adicionado ${obj.type}`);
    showNotification(`Elemento ${obj.type.toUpperCase()} inserido no Canvas!`, 'success');
  }, [canvasWidth, canvasHeight, objects.length, recordVersionSnapshot, showNotification]);

  // Custom Font File Upload Handler
  const handleFontFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fontName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_");
    const reader = new FileReader();

    reader.onload = (event) => {
      const fontUrl = event.target?.result as string;
      const newStyle = document.createElement('style');
      newStyle.appendChild(document.createTextNode(`
        @font-face {
          font-family: '${fontName}';
          src: url('${fontUrl}');
        }
      `));
      document.head.appendChild(newStyle);

      setFontList(prev => [...prev, fontName]);
      showNotification(`Fonte personalizada "${fontName}" carregada!`, 'success');
    };
    reader.readAsDataURL(file);
  };

  // Update Object Properties
  const updateActiveObject = (updates: Partial<CanvasObject>) => {
    if (!selectedObjectId) return;
    setObjects(prev => prev.map(o => o.id === selectedObjectId ? { ...o, ...updates } : o));
  };

  // Delete Active Object
  const deleteActiveObject = () => {
    if (!selectedObjectId) return;
    setObjects(prev => prev.filter(o => o.id !== selectedObjectId));
    setSelectedObjectId(null);
    showNotification('Objeto removido!', 'success');
  };

  // Duplicate Active Object
  const duplicateActiveObject = () => {
    if (!activeObject) return;
    const dup: CanvasObject = {
      ...activeObject,
      id: `obj_${Date.now()}`,
      x: activeObject.x + 20,
      y: activeObject.y + 20,
      zIndex: objects.length + 1,
    };
    setObjects(prev => [...prev, dup]);
    setSelectedObjectId(dup.id);
    showNotification('Objeto duplicado!', 'success');
  };

  // Layer Ordering Handlers
  const moveLayer = (direction: 'front' | 'back') => {
    if (!selectedObjectId) return;
    setObjects(prev => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex(o => o.id === selectedObjectId);
      if (idx === -1) return prev;

      if (direction === 'front' && idx < sorted.length - 1) {
        const temp = sorted[idx].zIndex;
        sorted[idx].zIndex = sorted[idx + 1].zIndex;
        sorted[idx + 1].zIndex = temp;
      } else if (direction === 'back' && idx > 0) {
        const temp = sorted[idx].zIndex;
        sorted[idx].zIndex = sorted[idx - 1].zIndex;
        sorted[idx - 1].zIndex = temp;
      }

      return [...sorted];
    });
  };

  // Load Premade Template
  const loadPremadeTemplate = useCallback((tplId: string) => {
    setObjects([]);
    setSelectedObjectId(null);

    if (tplId === 'post') {
      setCanvasWidth(1000);
      setCanvasHeight(600);
      setCanvasBg('linear-gradient(135deg, #4f46e5, #7c3aed, #db2777)');

      setObjects([
        {
          id: 'card_bg',
          type: 'shape',
          x: 50, y: 40, width: 900, height: 520, rotation: 0, opacity: 0.95,
          fill: '#ffffff', stroke: '#e2e8f0', strokeWidth: 2,
          shadowColor: 'rgba(0,0,0,0.15)', shadowBlur: 20, shadowOffsetX: 0, shadowOffsetY: 10,
          blurFilter: 0, contrastFilter: 100, brightnessFilter: 100, hueRotateFilter: 0,
          content: 'rect', zIndex: 1, locked: false, fontFamily: 'sans-serif', fontSize: 16,
          isBold: false, isItalic: false, textAlign: 'center', animation: 'fade'
        },
        {
          id: 'badge',
          type: 'badge',
          x: 90, y: 80, width: 180, height: 40, rotation: 0, opacity: 1,
          fill: '#f59e0b', stroke: 'transparent', strokeWidth: 0,
          shadowColor: 'transparent', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
          blurFilter: 0, contrastFilter: 100, brightnessFilter: 100, hueRotateFilter: 0,
          content: '⚡ NOVIDADE 2026', zIndex: 2, locked: false, fontFamily: 'sans-serif', fontSize: 15,
          isBold: true, isItalic: false, textAlign: 'center', animation: 'zoom'
        },
        {
          id: 'title',
          type: 'text',
          x: 90, y: 150, width: 700, height: 60, rotation: 0, opacity: 1,
          fill: '#0f172a', stroke: 'transparent', strokeWidth: 0,
          shadowColor: 'transparent', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
          blurFilter: 0, contrastFilter: 100, brightnessFilter: 100, hueRotateFilter: 0,
          content: 'Design Gráfico & Artes com IA', zIndex: 3, locked: false, fontFamily: 'sans-serif', fontSize: 38,
          isBold: true, isItalic: false, textAlign: 'left', animation: 'slide_up'
        },
        {
          id: 'subtitle',
          type: 'text',
          x: 90, y: 220, width: 700, height: 50, rotation: 0, opacity: 1,
          fill: '#475569', stroke: 'transparent', strokeWidth: 0,
          shadowColor: 'transparent', shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
          blurFilter: 0, contrastFilter: 100, brightnessFilter: 100, hueRotateFilter: 0,
          content: 'Crie posts, selos, marcas e documentos com o Canva Studio Pro.', zIndex: 4, locked: false, fontFamily: 'sans-serif', fontSize: 20,
          isBold: false, isItalic: false, textAlign: 'left', animation: 'fade'
        }
      ]);
    } else if (tplId === 'banner') {
      setCanvasWidth(1000);
      setCanvasHeight(600);
      setCanvasBg('#0f172a');

      setObjects([
        {
          id: 'banner_title',
          type: 'text',
          x: 60, y: 140, width: 880, height: 80, rotation: 0, opacity: 1,
          fill: '#ffffff', stroke: 'transparent', strokeWidth: 0,
          shadowColor: 'rgba(0,0,0,0.5)', shadowBlur: 10, shadowOffsetX: 2, shadowOffsetY: 2,
          blurFilter: 0, contrastFilter: 100, brightnessFilter: 100, hueRotateFilter: 0,
          content: 'OFERTA IMPERDÍVEL 50% OFF', zIndex: 1, locked: false, fontFamily: 'sans-serif', fontSize: 48,
          isBold: true, isItalic: false, textAlign: 'left', animation: 'slide_up'
        },
        {
          id: 'banner_cta',
          type: 'badge',
          x: 60, y: 280, width: 280, height: 60, rotation: 0, opacity: 1,
          fill: '#10b981', stroke: 'transparent', strokeWidth: 0,
          shadowColor: 'rgba(0,0,0,0.3)', shadowBlur: 8, shadowOffsetX: 0, shadowOffsetY: 4,
          blurFilter: 0, contrastFilter: 100, brightnessFilter: 100, hueRotateFilter: 0,
          content: 'CUPOM: CANVA50', zIndex: 2, locked: false, fontFamily: 'sans-serif', fontSize: 24,
          isBold: true, isItalic: false, textAlign: 'center', animation: 'zoom'
        }
      ]);
    }

    showNotification(`Modelo "${tplId}" carregado!`, 'success');
  }, [showNotification]);

  // Initial render setup
  useEffect(() => {
    loadPremadeTemplate(initialTemplate);
  }, [initialTemplate, loadPremadeTemplate]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set Resolution
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Draw Background
    if (canvasBg.startsWith('linear-gradient')) {
      const grad = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
      grad.addColorStop(0, '#4f46e5');
      grad.addColorStop(0.5, '#7c3aed');
      grad.addColorStop(1, '#db2777');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    } else {
      ctx.fillStyle = canvasBg;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // Render sorted objects by zIndex
    const sortedObjects = [...objects].sort((a, b) => a.zIndex - b.zIndex);

    sortedObjects.forEach(obj => {
      ctx.save();

      // CSS Style Filters
      let filterStr = '';
      if (obj.blurFilter > 0) filterStr += `blur(${obj.blurFilter}px) `;
      if (obj.contrastFilter !== 100) filterStr += `contrast(${obj.contrastFilter}%) `;
      if (obj.brightnessFilter !== 100) filterStr += `brightness(${obj.brightnessFilter}%) `;
      if (obj.hueRotateFilter > 0) filterStr += `hue-rotate(${obj.hueRotateFilter}deg) `;
      if (filterStr) ctx.filter = filterStr.trim();

      // Opacity
      ctx.globalAlpha = obj.opacity;

      // Transform Center
      const centerX = obj.x + obj.width / 2;
      const centerY = obj.y + obj.height / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((obj.rotation * Math.PI) / 180);

      // Shadow
      if (obj.shadowBlur > 0) {
        ctx.shadowColor = obj.shadowColor;
        ctx.shadowBlur = obj.shadowBlur;
        ctx.shadowOffsetX = obj.shadowOffsetX;
        ctx.shadowOffsetY = obj.shadowOffsetY;
      }

      const drawX = -obj.width / 2;
      const drawY = -obj.height / 2;

      if (obj.type === 'shape' || obj.type === 'badge') {
        ctx.fillStyle = obj.fill;
        ctx.strokeStyle = obj.stroke;
        ctx.lineWidth = obj.strokeWidth;

        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(drawX, drawY, obj.width, obj.height, 16);
          ctx.fill();
          if (obj.strokeWidth > 0) ctx.stroke();
        } else {
          ctx.fillRect(drawX, drawY, obj.width, obj.height);
        }

        if (obj.type === 'badge' && obj.content) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${obj.fontSize}px ${obj.fontFamily}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(obj.content, 0, 0);
        }

      } else if (obj.type === 'text') {
        ctx.fillStyle = obj.fill;
        ctx.font = `${obj.isItalic ? 'italic ' : ''}${obj.isBold ? 'bold ' : ''}${obj.fontSize}px ${obj.fontFamily}`;
        ctx.textAlign = obj.textAlign;
        ctx.textBaseline = 'middle';

        let textX = 0;
        if (obj.textAlign === 'left') textX = drawX + 10;
        if (obj.textAlign === 'right') textX = drawX + obj.width - 10;

        ctx.fillText(obj.content, textX, 0);

      } else if (obj.type === 'image' && obj.content) {
        const img = new Image();
        img.src = obj.content;
        if (img.complete) {
          ctx.drawImage(img, drawX, drawY, obj.width, obj.height);
        }
      }

      ctx.restore();

      // Draw Selection Bounding Box & Handles
      if (obj.id === selectedObjectId) {
        ctx.save();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);

        // Corner Handles
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#6366f1';
        const handleSize = 8;
        const corners = [
          { x: obj.x, y: obj.y },
          { x: obj.x + obj.width, y: obj.y },
          { x: obj.x, y: obj.y + obj.height },
          { x: obj.x + obj.width, y: obj.y + obj.height },
        ];

        corners.forEach(c => {
          ctx.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
          ctx.strokeRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize);
        });

        ctx.restore();
      }
    });

    // Draw Snap Alignment Lines
    if (showSnapGuides) {
      ctx.save();
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      if (snapLineX !== null) {
        ctx.beginPath();
        ctx.moveTo(snapLineX, 0);
        ctx.lineTo(snapLineX, canvasHeight);
        ctx.stroke();
      }
      if (snapLineY !== null) {
        ctx.beginPath();
        ctx.moveTo(0, snapLineY);
        ctx.lineTo(canvasWidth, snapLineY);
        ctx.stroke();
      }
      ctx.restore();
    }

  }, [canvasWidth, canvasHeight, canvasBg, objects, selectedObjectId, showSnapGuides, snapLineX, snapLineY]);

  // Handle Mouse Click/Drag on Canvas
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Find clicked object (topmost zIndex)
    const sorted = [...objects].sort((a, b) => b.zIndex - a.zIndex);
    const clicked = sorted.find(obj => 
      mouseX >= obj.x && mouseX <= obj.x + obj.width &&
      mouseY >= obj.y && mouseY <= obj.y + obj.height
    );

    if (clicked) {
      setSelectedObjectId(clicked.id);
      setIsDragging(true);
      setDragOffset({ x: mouseX - clicked.x, y: mouseY - clicked.y });
    } else {
      setSelectedObjectId(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedObjectId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;

    let newX = (e.clientX - rect.left) * scaleX - dragOffset.x;
    let newY = (e.clientY - rect.top) * scaleY - dragOffset.y;

    // Snap Alignment guides (Center snap)
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    let activeSnapX: number | null = null;
    let activeSnapY: number | null = null;

    if (Math.abs(newX + 100 - centerX) < 15) {
      newX = centerX - 100;
      activeSnapX = centerX;
    }
    if (Math.abs(newY + 30 - centerY) < 15) {
      newY = centerY - 30;
      activeSnapY = centerY;
    }

    setSnapLineX(activeSnapX);
    setSnapLineY(activeSnapY);
    setShowSnapGuides(activeSnapX !== null || activeSnapY !== null);

    setObjects(prev => prev.map(o => o.id === selectedObjectId ? { ...o, x: newX, y: newY } : o));
  };

  const handleCanvasMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      setShowSnapGuides(false);
      recordVersionSnapshot('Movimentação de Objeto');
    }
  };

  // Export PowerPoint PPTX using pptxgenjs!
  const exportPowerPointPptx = async () => {
    try {
      const pptx = new pptxgen();
      const slide = pptx.addSlide();

      // Slide Background
      slide.background = { color: canvasBg.startsWith('#') ? canvasBg.replace('#', '') : 'FFFFFF' };

      // Add objects to PowerPoint Slide
      objects.forEach(obj => {
        const xInches = (obj.x / canvasWidth) * 10;
        const yInches = (obj.y / canvasHeight) * 5.625;
        const wInches = (obj.width / canvasWidth) * 10;
        const hInches = (obj.height / canvasHeight) * 5.625;

        if (obj.type === 'text' || obj.type === 'badge') {
          slide.addText(obj.content, {
            x: xInches,
            y: yInches,
            w: wInches,
            h: hInches,
            fontSize: obj.fontSize,
            bold: obj.isBold,
            italic: obj.isItalic,
            color: obj.fill.replace('#', ''),
            align: obj.textAlign,
          });
        } else if (obj.type === 'image' && obj.content) {
          slide.addImage({
            data: obj.content,
            x: xInches,
            y: yInches,
            w: wInches,
            h: hInches,
          });
        }
      });

      await pptx.writeFile({ fileName: `DocSwiss_Apresentacao_${Date.now()}.pptx` });
      showNotification('Apresentação PowerPoint (.pptx) baixada com sucesso!', 'success');

      if (onSaveToHistory) {
        onSaveToHistory({
          type: 'canva',
          title: 'Apresentação PowerPoint Canva',
          summary: `Exportado com ${objects.length} camadas de objetos para PPTX.`,
        });
      }
    } catch (e) {
      console.error(e);
      showNotification('Erro ao gerar arquivo PPTX', 'error');
    }
  };

  // Export PDF HD
  const exportPdfHd = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imgData = canvas.toDataURL('image/png', 1.0);

    const pdf = new jsPDF({
      orientation: canvasWidth > canvasHeight ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvasWidth, canvasHeight]
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvasWidth, canvasHeight);
    pdf.save(`DocSwiss_Canva_HD_${Date.now()}.pdf`);
    showNotification('PDF de Alta Resolução exportado!', 'success');
  };

  // Export PNG Image
  const exportPngImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imgData = canvas.toDataURL('image/png');
    saveAs(imgData, `DocSwiss_Design_${Date.now()}.png`);
    showNotification('Imagem PNG baixada com sucesso!', 'success');
  };

  return (
    <div className={`space-y-5 ${isExpansiveView ? 'fixed inset-0 z-50 bg-slate-950 p-6 overflow-y-auto' : ''}`}>
      
      {/* Studio Header Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-purple-600 text-white rounded-2xl shadow-md">
            <IconPalette className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Canva Design Studio Pro 2026
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                Studio HD
              </span>
            </h2>
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <span>{canvasWidth} x {canvasHeight} px</span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <IconUsers className="w-3.5 h-3.5 inline" />
                2 Colaboradores Online
              </span>
            </p>
          </div>
        </div>

        {/* Action Header Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset Canvas Selector */}
          <select
            value={`${canvasWidth}x${canvasHeight}`}
            onChange={(e) => {
              const [w, h] = e.target.value.split('x').map(Number);
              setCanvasWidth(w);
              setCanvasHeight(h);
              showNotification(`Resolução ajustada para ${w}x${h} px`, 'success');
            }}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-2xl border border-transparent outline-none focus:border-indigo-500"
          >
            {CANVAS_PRESETS.map((p) => (
              <option key={p.id} value={`${p.width}x${p.height}`}>
                {p.name}
              </option>
            ))}
          </select>

          {/* Quick PPTX Export */}
          <button
            onClick={exportPowerPointPptx}
            className="px-3.5 py-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white font-bold text-xs rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
          >
            <IconFileExport className="w-4 h-4" />
            <span>Exportar PPTX</span>
          </button>

          {/* Quick PDF Export */}
          <button
            onClick={exportPdfHd}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-2xl shadow-md transition-all flex items-center gap-1.5"
          >
            <IconDownload className="w-4 h-4" />
            <span>Exportar PDF HD</span>
          </button>

          {/* Full Screen Expansive View */}
          <button
            onClick={() => setIsExpansiveView(!isExpansiveView)}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl hover:bg-slate-200 transition-colors"
            title={isExpansiveView ? 'Sair da Tela Cheia' : 'Modo Expansivo Tela Cheia'}
          >
            {isExpansiveView ? <IconMinimize className="w-4 h-4" /> : <IconMaximize className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Studio Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Sidebar Navigation & Controls (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Navigation Tabs */}
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl overflow-x-auto text-xs font-bold no-scrollbar">
            {[
              { id: 'templates' as const, label: 'Modelos', icon: IconLayout },
              { id: 'graphics' as const, label: 'Ícones & Fotos', icon: IconSparkles },
              { id: 'text' as const, label: 'Texto & Fontes', icon: Type },
              { id: 'layers' as const, label: 'Camadas', icon: Layers },
              { id: 'history' as const, label: 'Versões', icon: IconHistory },
              { id: 'export' as const, label: 'Exportar', icon: IconDownload },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Panel Content */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 min-h-[420px] max-h-[600px] overflow-y-auto space-y-4 shadow-xs">
            
            {/* MODELOS PRONTOS TAB */}
            {activeTab === 'templates' && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <IconLayout className="w-4 h-4 text-indigo-600" />
                  Modelos de Slides & Artes Prontas
                </h3>

                <div className="grid grid-cols-1 gap-2.5">
                  {CANVA_TEMPLATES.map((tpl) => (
                    <div
                      key={tpl.id}
                      onClick={() => loadPremadeTemplate(tpl.id)}
                      className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:border-indigo-500 cursor-pointer transition-all flex items-center justify-between"
                    >
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">{tpl.name}</h4>
                        <p className="text-[11px] text-slate-500">{tpl.desc}</p>
                      </div>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Usar →</span>
                    </div>
                  ))}
                </div>

                {/* Preset Background Gradients */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Cores e Gradientes de Fundo</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {BACKGROUND_GRADIENTS.map((bg) => (
                      <button
                        key={bg.id}
                        onClick={() => {
                          setCanvasBg(bg.value);
                          recordVersionSnapshot('Alteração de Fundo');
                        }}
                        className="h-10 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-[10px] text-slate-700 shadow-xs flex items-center justify-center p-1"
                        style={{ background: bg.value }}
                      >
                        <span className="bg-white/80 dark:bg-slate-900/80 px-1.5 py-0.5 rounded-md">
                          {bg.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ÍCONES & FOTOS SMART LIBRARY TAB */}
            {activeTab === 'graphics' && (
              <SmartGraphicsLibrary
                onSelectGraphic={(item) => {
                  if (item.type === 'photo') {
                    addObject({
                      type: 'image',
                      content: item.previewUrl,
                      width: 400,
                      height: 250,
                    });
                  } else {
                    addObject({
                      type: 'badge',
                      content: item.title,
                      width: 180,
                      height: 44,
                      fill: '#6366f1',
                    });
                  }
                }}
                showNotification={showNotification}
              />
            )}

            {/* TEXTO & FONTES TAB */}
            {activeTab === 'text' && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Type className="w-4 h-4 text-indigo-600" />
                  Biblioteca de Fontes e Caixas de Texto
                </h3>

                {/* Add Text Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => addObject({ type: 'text', content: 'Título de Impacto', fontSize: 42, isBold: true })}
                    className="p-3 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-xs font-bold text-indigo-900 dark:text-indigo-200 text-left hover:shadow-xs transition-all"
                  >
                    + Inserir Título
                  </button>
                  <button
                    onClick={() => addObject({ type: 'text', content: 'Subtítulo Explicativo', fontSize: 24, isBold: false })}
                    className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold text-slate-700 dark:text-slate-300 text-left hover:shadow-xs transition-all"
                  >
                    + Inserir Subtítulo
                  </button>
                </div>

                {/* Upload Custom Font File */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Upload de Fonte Personalizada (.ttf/.otf/.woff)</h4>
                  <label className="cursor-pointer block p-3 border-2 border-dashed border-indigo-300 dark:border-indigo-800 rounded-2xl text-center bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-50 transition-colors">
                    <IconUpload className="w-5 h-5 mx-auto text-indigo-600 mb-1" />
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Carregar Arquivo de Fonte</span>
                    <input type="file" accept=".ttf,.otf,.woff,.woff2" onChange={handleFontFileUpload} className="hidden" />
                  </label>
                </div>

                {/* Font Selector List */}
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-500">Fontes Disponíveis ({fontList.length})</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {fontList.map(font => (
                      <span key={font} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300" style={{ fontFamily: font }}>
                        {font}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* CAMADAS (LAYERS) TAB */}
            {activeTab === 'layers' && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Ordem de Camadas & Objetos
                </h3>

                <div className="space-y-2">
                  {[...objects].sort((a, b) => b.zIndex - a.zIndex).map(obj => (
                    <div
                      key={obj.id}
                      onClick={() => setSelectedObjectId(obj.id)}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                        obj.id === selectedObjectId
                          ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-500 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-xs font-black uppercase text-indigo-600 px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900">
                          {obj.type}
                        </span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {obj.content || 'Objeto'}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); moveLayer('front'); }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-xs"
                          title="Trazer para Frente"
                        >
                          ↑
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveLayer('back'); }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-xs"
                          title="Enviar para Trás"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HISTÓRICO DE VERSÕES TAB */}
            {activeTab === 'history' && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <IconHistory className="w-4 h-4 text-indigo-600" />
                  Histórico de Versões Salvas
                </h3>

                <div className="space-y-2">
                  {versions.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">Nenhuma alteração gravada ainda.</p>
                  ) : (
                    versions.map(ver => (
                      <div
                        key={ver.id}
                        onClick={() => {
                          setObjects(ver.objects);
                          setCanvasBg(ver.bg);
                          showNotification(`Versão "${ver.label}" restaurada!`, 'success');
                        }}
                        className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-indigo-500 cursor-pointer transition-all flex items-center justify-between"
                      >
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{ver.label}</h4>
                          <span className="text-[10px] text-slate-400">{ver.timestamp} • {ver.objects.length} camadas</span>
                        </div>
                        <span className="text-xs font-bold text-indigo-600">Restaurar</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* EXPORTAR TAB */}
            {activeTab === 'export' && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <IconDownload className="w-4 h-4 text-indigo-600" />
                  Opções Avançadas de Exportação
                </h3>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={exportPowerPointPptx}
                    className="p-3.5 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-2xl font-bold text-xs flex items-center justify-between shadow-md hover:shadow-lg transition-all"
                  >
                    <span>📊 PowerPoint (.pptx)</span>
                    <span>Baixar →</span>
                  </button>

                  <button
                    onClick={exportPdfHd}
                    className="p-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs flex items-center justify-between shadow-md transition-all"
                  >
                    <span>📄 Documento PDF HD (.pdf)</span>
                    <span>Baixar →</span>
                  </button>

                  <button
                    onClick={exportPngImage}
                    className="p-3.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-bold text-xs flex items-center justify-between shadow-md transition-all"
                  >
                    <span>🖼️ Imagem Transparente PNG (.png)</span>
                    <span>Baixar →</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Right Canvas Interactive Workspace (8 Cols) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Properties Panel for Selected Object */}
          {activeObject ? (
            <div className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-3xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4" />
                  Painel de Propriedades do Objeto ({activeObject.type})
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={duplicateActiveObject} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold text-slate-700" title="Duplicar">
                    <IconCopy className="w-4 h-4" />
                  </button>
                  <button onClick={deleteActiveObject} className="p-1.5 hover:bg-rose-100 rounded-xl text-xs font-bold text-rose-600" title="Excluir">
                    <IconTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Editable Content Input */}
              {(activeObject.type === 'text' || activeObject.type === 'badge') && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500">Texto do Objeto</label>
                  <input
                    type="text"
                    value={activeObject.content}
                    onChange={(e) => updateActiveObject({ content: e.target.value })}
                    className="w-full px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-indigo-500 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 outline-none"
                  />
                </div>
              )}

              {/* Controls Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-400">Cor de Preenchimento</label>
                  <input
                    type="color"
                    value={activeObject.fill}
                    onChange={(e) => updateActiveObject({ fill: e.target.value })}
                    className="w-full h-8 rounded-xl cursor-pointer border-none bg-transparent"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400">Opacidade ({Math.round(activeObject.opacity * 100)}%)</label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={activeObject.opacity}
                    onChange={(e) => updateActiveObject({ opacity: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400">Rotação ({activeObject.rotation}°)</label>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={activeObject.rotation}
                    onChange={(e) => updateActiveObject({ rotation: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400">Sombra Blur ({activeObject.shadowBlur}px)</label>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={activeObject.shadowBlur}
                    onChange={(e) => updateActiveObject({ shadowBlur: Number(e.target.value) })}
                    className="w-full accent-indigo-600"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-100 dark:bg-slate-900/60 rounded-3xl p-3 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800">
              Clique em qualquer elemento do canvas para abrir o Painel de Propriedades.
            </div>
          )}

          {/* Interactive HTML5 Canvas Container */}
          <div className="bg-slate-100/90 dark:bg-slate-950/90 rounded-3xl p-4 sm:p-8 flex items-center justify-center overflow-auto min-h-[500px] shadow-inner border border-slate-200/80 dark:border-slate-800">
            <canvas
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              className="shadow-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 cursor-crosshair max-w-full h-auto transition-transform"
            />
          </div>

        </div>

      </div>

    </div>
  );
};
