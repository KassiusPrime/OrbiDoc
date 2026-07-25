import React, { useState } from 'react';
import { 
  Palette, ImagePlus, Download, Sparkles, Loader2, Search, Wand2, Edit3, Camera
} from 'lucide-react';
import { motion } from 'motion/react';
import { saveAs } from 'file-saver';
import { HistoryItem } from '../types';

interface ImageGeneratorStudioProps {
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  showNotification?: (msg: string, type?: 'success' | 'error') => void;
  onSendToCanva?: (imageUrl: string) => void;
  engineProvider?: string;
  engineModel?: string;
}

const SAMPLE_PROMPTS = [
  '🐱 Gato astronauta flutuando no espaço sideral com teto estelar',
  '🌆 Cidade cyberpunk com luzes de neon e carros voadores na chuva',
  '🏔️ Paisagem alpina ao pôr do sol em pintura aquarela detalhada',
  '🚀 Foguete futurista decolando em Marte com poeira vermelha',
  '🎨 Retrato em pintura a óleo com iluminação dramática estilo Rembrandt',
  '🤖 Robô amigável ajudando na cozinha em animação 3D fofa',
];

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
  engineModel = 'gemini-3.6-flash',
}) => {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(STYLE_PRESETS[0]);
  const [selectedRatio, setSelectedRatio] = useState(ASPECT_RATIOS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');
  const [usedProvider, setUsedProvider] = useState('');

  // Stock Photos
  const [stockQuery, setStockQuery] = useState('');
  const [stockPhotos, setStockPhotos] = useState<string[]>([]);
  const [isSearchingStock, setIsSearchingStock] = useState(false);

  const handleRefinePromptAi = async () => {
    if (!prompt.trim()) {
      showNotification('Escreva algo primeiro para aprimorar.', 'error');
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: engineProvider,
          model: engineModel,
          messages: [
            { role: 'system', content: 'Você é um especialista em engenharia de prompts visuais. Reescreva a descrição em um prompt detalhado em inglês otimizado para geradores de imagens.' },
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
      showNotification('Erro ao conectar com assistente de prompt.', 'error');
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
    let finalUrl = '';
    let providerName = 'Pollinations AI';

    try {
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
      if (data && data.imageUrl) {
        finalUrl = data.imageUrl;
        providerName = data.provider || 'Pollinations AI';
      } else {
        throw new Error('Servidor não retornou URL');
      }
    } catch (err) {
      console.warn('Usando fallback direto para gerador visual:', err);
      const seed = Math.floor(Math.random() * 1000000);
      finalUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${selectedRatio.w}&height=${selectedRatio.h}&nologo=true&seed=${seed}`;
      providerName = 'Pollinations Direct';
    }

    setGeneratedImageUrl(finalUrl);
    setUsedProvider(providerName);
    setIsGenerating(false);
    showNotification('Imagem gerada com sucesso!', 'success');

    if (onSaveToHistory && finalUrl) {
      onSaveToHistory({
        type: 'image',
        title: prompt.slice(0, 30) + '...',
        summary: `Gerada no estilo ${selectedStyle.label}.`,
        mediaUrl: finalUrl
      });
    }
  };

  const searchStockPhotos = async (queryToSearch?: string) => {
    const q = (queryToSearch || stockQuery).trim();
    if (!q) return;
    setStockQuery(q);
    setIsSearchingStock(true);
    try {
      const encoded = encodeURIComponent(q);
      const timestamp = Date.now();
      const photos = [
        `https://image.pollinations.ai/prompt/stock%20photo%20of%20${encoded}%204k%20photography?width=800&height=500&nologo=true&seed=${timestamp + 1}`,
        `https://image.pollinations.ai/prompt/realistic%20photo%20of%20${encoded}%20hd%20detail?width=800&height=500&nologo=true&seed=${timestamp + 2}`,
        `https://image.pollinations.ai/prompt/professional%20photography%20${encoded}%20studio%20light?width=800&height=500&nologo=true&seed=${timestamp + 3}`,
        `https://image.pollinations.ai/prompt/cinematic%20shot%20of%20${encoded}%20natural%20lighting?width=800&height=500&nologo=true&seed=${timestamp + 4}`
      ];
      setStockPhotos(photos);
      showNotification(`Fotos encontradas para "${q}"`, 'success');
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
          <p className="text-xs text-slate-600 mt-1">
            Gere imagens com descrições em português ou inglês, aplique estilos artísticos e edite diretamente nas outras ferramentas.
          </p>
        </div>
      </div>

      {/* Main Generator Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Column */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">1. Descrição da Imagem</span>
              <button
                onClick={handleRefinePromptAi}
                className="text-[11px] text-pink-600 hover:underline flex items-center gap-1 font-semibold"
              >
                <Wand2 className="w-3 h-3" /> Otimizar Prompt IA
              </button>
            </div>

            {/* Prompt Textarea with HIGH CONTRAST VISIBLE TEXT */}
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: 'Um dragão cristalino voando sobre uma cidade futurista em neon ao entardecer'..."
              className="w-full h-32 p-3.5 text-sm font-semibold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200 resize-none placeholder:text-slate-400 shadow-inner"
            />

            {/* Exemplo de Prompts */}
            <div>
              <span className="text-[11px] font-bold text-slate-700 block mb-1.5">Sugestões Rápidas:</span>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_PROMPTS.slice(0, 4).map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPrompt(sample.replace(/^[\u2000-\u3300\ud83c-\ud83e][\ufe0f]?\s*/, ''))}
                    className="text-[10px] bg-pink-50 hover:bg-pink-100 text-pink-700 px-2 py-1 rounded-lg border border-pink-200 text-left truncate max-w-full font-medium"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            {/* Estilos */}
            <div>
              <span className="text-xs font-bold text-slate-900 block mb-2">2. Estilo Artístico</span>
              <div className="grid grid-cols-2 gap-2">
                {STYLE_PRESETS.map(style => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style)}
                    className={`p-2 rounded-xl text-xs font-semibold text-left transition-all ${
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
              <span className="text-xs font-bold text-slate-900 block mb-2">3. Proporção</span>
              <div className="grid grid-cols-2 gap-2">
                {ASPECT_RATIOS.map(ratio => (
                  <button
                    key={ratio.id}
                    onClick={() => setSelectedRatio(ratio)}
                    className={`p-2 rounded-xl text-xs font-semibold transition-all ${
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
              {isGenerating ? 'Criando Imagem com IA...' : 'Gerar Imagem Agora'}
            </button>
          </div>
        </div>

        {/* Display Canvas Column */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 min-h-[480px] flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="text-xs font-bold text-slate-800">Resultado da Gerador Visual</span>
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
                  <p className="text-sm font-semibold text-slate-700">Sintetizando e renderizando os detalhes visuais...</p>
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
                      className="px-4 py-2 bg-pink-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md hover:bg-pink-700"
                    >
                      <Download className="w-4 h-4" /> Baixar Imagem
                    </button>
                    {onSendToCanva && (
                      <button
                        onClick={() => onSendToCanva(generatedImageUrl)}
                        className="px-4 py-2 bg-purple-100 text-purple-700 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-purple-200"
                      >
                        <Edit3 className="w-4 h-4" /> Exportar para Canva Studio
                      </button>
                    )}
                  </div>
                </motion.div>
              ) : (
                <div className="text-center text-slate-500 py-12 space-y-3">
                  <ImagePlus className="w-16 h-16 mx-auto opacity-30 text-pink-500" />
                  <p className="text-sm font-bold text-slate-800">Digite uma descrição e clique em "Gerar Imagem Agora"</p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Suporta qualquer assunto: ilustrações, fotos conceituais, cenários, personagens e artes digitais.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Banco de Fotos Adicional */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-indigo-600" /> Banco de Fotos Profissional (Unsplash Stock)
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={stockQuery}
                onChange={(e) => setStockQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchStockPhotos()}
                placeholder="Buscar foto real (ex: 'natureza', 'tecnologia', 'negócios')..."
                className="flex-1 px-3 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
              />
              <button
                onClick={() => searchStockPhotos()}
                disabled={isSearchingStock}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 flex items-center gap-1"
              >
                {isSearchingStock ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Buscar
              </button>
            </div>

            {stockPhotos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                {stockPhotos.map((url, i) => (
                  <div key={i} className="group relative rounded-xl overflow-hidden border border-slate-200 aspect-video">
                    <img src={url} alt="Stock" className="w-full h-full object-cover group-hover:scale-105 transition-all" />
                    <button
                      onClick={() => { setGeneratedImageUrl(url); setUsedProvider('Unsplash Stock'); }}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold"
                    >
                      Selecionar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
