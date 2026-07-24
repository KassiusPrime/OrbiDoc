import React, { useState } from 'react';
import { 
  Palette, ImagePlus, Download, Sparkles, Loader2, Copy, RefreshCw,
  Sliders, Search, Send, Layers, Check, ExternalLink, Wand2, Edit3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { saveAs } from 'file-saver';
import { HistoryItem } from '../types';

interface ImageGeneratorStudioProps {
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  showNotification?: (msg: string, type?: 'success' | 'error') => void;
  onSendToCanva?: (imageUrl: string) => void;
  engineProvider?: string;
  engineModel?: string;
}

const STYLE_PRESETS = [
  { id: 'realistic', label: 'Fotorrealista', promptSuffix: ', ultra high resolution 8k photo, photorealistic, cinematic lighting' },
  { id: 'cyberpunk', label: 'Cyberpunk', promptSuffix: ', cyberpunk style, neon lights, futuristic city, detailed digital art' },
  { id: 'anime', label: 'Anime / Manga', promptSuffix: ', japanese anime artwork, vibrant colors, studio ghibli style, detailed line art' },
  { id: '3d', label: 'Render 3D Pixar', promptSuffix: ', 3d render, pixar style, cute 3d illustration, octane render' },
  { id: 'vector', label: 'Vetor Minimalista', promptSuffix: ', minimalist vector illustration, flat design, clean lines, modern graphic' },
  { id: 'oil', label: 'Pintura a Óleo', promptSuffix: ', oil painting style, visible brush strokes, dramatic lighting, masterpiece' },
];

const ASPECT_RATIOS = [
  { id: '1:1', label: 'Quadrado (1:1)', w: 768, h: 768 },
  { id: '16:9', label: 'Widescreen (16:9)', w: 1024, h: 576 },
  { id: '9:16', label: 'Status/Story (9:16)', w: 576, h: 1024 },
  { id: '4:3', label: 'Padrão (4:3)', w: 800, h: 600 },
];

export const ImageGeneratorStudio: React.FC<ImageGeneratorStudioProps> = ({
  onSaveToHistory,
  showNotification = () => {},
  onSendToCanva,
  engineProvider = 'gemini',
  engineModel = 'gemini-2.5-flash',
}) => {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(STYLE_PRESETS[0]);
  const [selectedRatio, setSelectedRatio] = useState(ASPECT_RATIOS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');
  const [usedProvider, setUsedProvider] = useState('');

  // Unsplash Stock Photos state
  const [stockQuery, setStockQuery] = useState('');
  const [stockPhotos, setStockPhotos] = useState<string[]>([]);
  const [isSearchingStock, setIsSearchingStock] = useState(false);

  const handleRefinePromptAi = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: engineProvider,
          model: engineModel,
          messages: [
            { role: 'system', content: 'Você é um especialista em prompts artísticos. Reescreva o comando em um prompt rico e detalhado em inglês para geradores de imagens.' },
            { role: 'user', content: prompt }
          ]
        })
      });
      const data = await res.json();
      if (res.ok && data.answer) {
        setPrompt(data.answer);
        showNotification('Prompt aprimorado com sucesso!', 'success');
      }
    } catch {
      showNotification('Não foi possível aprimorar o prompt.', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!prompt.trim()) {
      showNotification('Digite uma descrição para a imagem.', 'error');
      return;
    }

    setIsGenerating(true);
    setGeneratedImageUrl('');

    const fullPrompt = `${prompt.trim()}${selectedStyle.promptSuffix}`;

    try {
      // Primary: Server route
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          width: selectedRatio.w,
          height: selectedRatio.h,
          model: 'flux',
        })
      });

      const data = await response.json();
      if (data.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
        setUsedProvider(data.provider || 'Pollinations AI');
      } else {
        throw new Error('Falha na rota do servidor');
      }
    } catch (err) {
      console.warn('Fallback para streaming direto do Pollinations:', err);
      const seed = Math.floor(Math.random() * 1000000);
      const directUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${selectedRatio.w}&height=${selectedRatio.h}&nologo=true&seed=${seed}`;
      setGeneratedImageUrl(directUrl);
      setUsedProvider('Pollinations Direct');
    } finally {
      setIsGenerating(false);
      showNotification('Imagem gerada com sucesso!', 'success');

      if (onSaveToHistory) {
        onSaveToHistory({
          type: 'image',
          title: prompt.slice(0, 30) + '...',
          summary: `Gerada no estilo ${selectedStyle.label}.`,
          mediaUrl: generatedImageUrl
        });
      }
    }
  };

  const searchStockPhotos = async () => {
    if (!stockQuery.trim()) return;
    setIsSearchingStock(true);
    try {
      const q = encodeURIComponent(stockQuery.trim());
      // Unsplash source image placeholders
      const photos = [
        `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80&sig=${Math.random()}`,
        `https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80&sig=${Math.random()}`,
        `https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=800&q=80&sig=${Math.random()}`,
        `https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=800&q=80&sig=${Math.random()}`
      ];
      setStockPhotos(photos);
    } finally {
      setIsSearchingStock(false);
    }
  };

  const downloadImage = (url: string) => {
    saveAs(url, `Arte_Gerada_${Date.now()}.png`);
    showNotification('Download da imagem iniciado!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Palette className="w-6 h-6 text-pink-600" />
            Estúdio Visual & Gerador de Imagens IA
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Gere artes ultradetalhadas com modelos de difusão de última geração ou busque banco de imagens profissional.
          </p>
        </div>
      </div>

      {/* Main Generator Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">1. Descrição / Prompt</span>
              <button
                onClick={handleRefinePromptAi}
                className="text-[11px] text-pink-600 hover:underline flex items-center gap-1 font-semibold"
              >
                <Wand2 className="w-3 h-3" /> Aprimorar com IA
              </button>
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: 'Um dragão cristalino voando sobre uma cidade futurista em neon ao entardecer'..."
              className="w-full h-32 p-3 text-xs bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-pink-500 resize-none"
            />

            {/* Estilos */}
            <div>
              <span className="text-xs font-bold text-slate-800 block mb-2">2. Estilo Artístico</span>
              <div className="grid grid-cols-2 gap-2">
                {STYLE_PRESETS.map(style => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style)}
                    className={`p-2 rounded-xl text-xs font-medium text-left transition-all ${
                      selectedStyle.id === style.id
                        ? 'bg-pink-600 text-white shadow-md'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Aspect Ratio */}
            <div>
              <span className="text-xs font-bold text-slate-800 block mb-2">3. Proporção da Tela</span>
              <div className="grid grid-cols-2 gap-2">
                {ASPECT_RATIOS.map(ratio => (
                  <button
                    key={ratio.id}
                    onClick={() => setSelectedRatio(ratio)}
                    className={`p-2 rounded-xl text-xs font-medium transition-all ${
                      selectedRatio.id === ratio.id
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {ratio.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerateImage}
              disabled={isGenerating || !prompt.trim()}
              className="w-full py-3.5 bg-gradient-to-r from-pink-600 to-rose-600 text-white font-bold rounded-2xl disabled:opacity-50 shadow-lg flex items-center justify-center gap-2 transition-all hover:opacity-95"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
              {isGenerating ? 'Criando Obra de Arte...' : 'Gerar Imagem de Alta Resolução'}
            </button>
          </div>
        </div>

        {/* Display Canvas Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 min-h-[480px] flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-700">Resultado Gerado</span>
              {usedProvider && (
                <span className="text-[10px] font-semibold bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full">
                  Provedor: {usedProvider}
                </span>
              )}
            </div>

            <div className="my-auto flex items-center justify-center p-4">
              {isGenerating ? (
                <div className="text-center space-y-3">
                  <Loader2 className="w-12 h-12 text-pink-600 animate-spin mx-auto" />
                  <p className="text-xs text-slate-500">Renderizando os detalhes artísticos...</p>
                </div>
              ) : generatedImageUrl ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-4 w-full flex flex-col items-center"
                >
                  <img
                    src={generatedImageUrl}
                    alt="Arte Gerada"
                    className="max-h-[420px] rounded-2xl shadow-xl border border-slate-200 object-contain"
                  />
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={() => downloadImage(generatedImageUrl)}
                      className="px-4 py-2 bg-pink-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
                    >
                      <Download className="w-4 h-4" /> Baixar Imagem
                    </button>
                    {onSendToCanva && (
                      <button
                        onClick={() => onSendToCanva(generatedImageUrl)}
                        className="px-4 py-2 bg-purple-100 text-purple-700 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Edit3 className="w-4 h-4" /> Editar no Canva Studio
                      </button>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="text-center text-slate-400 py-12">
                  <ImagePlus className="w-16 h-16 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Preencha o prompt ao lado para gerar sua arte visual.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
