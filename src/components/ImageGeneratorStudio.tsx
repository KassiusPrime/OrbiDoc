import React, { useState, useRef } from 'react';
import { 
  Palette, ImagePlus, Download, Sparkles, Loader2, Search, Wand2, Edit3, Camera,
  Upload, Sliders, Image as ImageIcon, CheckCircle, RefreshCw, Layers
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

const EDIT_PRESETS = [
  { label: '✨ Remover Fundo', prompt: 'Remover o fundo da imagem deixando apenas o assunto principal com fundo transparente/limpo' },
  { label: '🎨 Pintura a Óleo', prompt: 'Transformar esta imagem em uma pintura a óleo clássica com pinceladas artísticas visíveis' },
  { label: '🌆 Estilo Cyberpunk', prompt: 'Aplicar estética futurista cyberpunk com iluminação neon azul e violeta na imagem' },
  { label: '☀️ Iluminação Mágica', prompt: 'Aprimorar a iluminação, cores e nitidez tornando a imagem viva e cinematográfica' },
  { label: '🖌️ Aquarela Suave', prompt: 'Converter esta foto em uma ilustração em aquarela delicada com tons suaves' },
  { label: '🕶️ Adicionar Óculos', prompt: 'Adicionar óculos de sol elegantes no personagem mantendo o resto da foto' },
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
  const [activeTab, setActiveTab] = useState<'generate' | 'edit'>('generate');
  const [prompt, setPrompt] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(STYLE_PRESETS[0]);
  const [selectedRatio, setSelectedRatio] = useState(ASPECT_RATIOS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState('');
  const [usedProvider, setUsedProvider] = useState('');

  // Image Edit source
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stock Photos
  const [stockQuery, setStockQuery] = useState('');
  const [stockPhotos, setStockPhotos] = useState<string[]>([]);
  const [isSearchingStock, setIsSearchingStock] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showNotification('A imagem deve ter no máximo 10MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setSourceImage(event.target?.result as string);
        showNotification('Imagem carregada para edição!', 'success');
      };
      reader.readAsDataURL(file);
    }
  };

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

  const handleEditImageWithAi = async () => {
    if (!sourceImage && !generatedImageUrl) {
      showNotification('Selecione ou envie uma imagem para editar.', 'error');
      return;
    }
    if (!editPrompt.trim()) {
      showNotification('Digite o comando de edição que deseja aplicar.', 'error');
      return;
    }

    setIsEditing(true);
    const targetImg = sourceImage || generatedImageUrl;

    try {
      const res = await fetch('/api/edit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: targetImg,
          prompt: editPrompt.trim()
        })
      });

      const data = await res.json();
      if (data && data.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
        setUsedProvider(data.provider || 'Gemini AI Edit');
        showNotification('Edição com IA concluída!', 'success');
        if (onSaveToHistory) {
          onSaveToHistory({
            type: 'image',
            title: `Edição: ${editPrompt.slice(0, 25)}...`,
            summary: `Instrução: ${editPrompt}`,
            mediaUrl: data.imageUrl
          });
        }
      } else {
        throw new Error('Servidor não retornou imagem editada.');
      }
    } catch (err) {
      showNotification('Erro ao editar imagem com IA.', 'error');
    } finally {
      setIsEditing(false);
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
      {/* Top Header & Mode Switcher */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Palette className="w-6 h-6 text-pink-600 dark:text-pink-400" />
            Estúdio Visual & Edição com IA
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Crie imagens do zero ou edite fotos existentes usando comandos em português alimentados pelo Gemini.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('generate')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'generate'
                ? 'bg-pink-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <ImagePlus className="w-4 h-4" />
            <span>Gerar Imagem</span>
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'edit'
                ? 'bg-pink-600 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <Wand2 className="w-4 h-4" />
            <span>Edição de Imagem IA</span>
          </button>
        </div>
      </div>

      {/* Main Mode View */}
      {activeTab === 'generate' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls Column */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">1. Descrição da Imagem</span>
                <button
                  onClick={handleRefinePromptAi}
                  className="text-[11px] text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Wand2 className="w-3 h-3" /> Otimizar Prompt IA
                </button>
              </div>

              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: 'Um dragão cristalino voando sobre uma cidade futurista em neon ao entardecer'..."
                className="w-full h-32 p-3.5 text-sm font-semibold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-2xl outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200 resize-none placeholder:text-slate-400 shadow-inner"
              />

              {/* Suggestions */}
              <div>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1.5">Sugestões Rápidas:</span>
                <div className="flex flex-wrap gap-1.5">
                  {SAMPLE_PROMPTS.slice(0, 4).map((sample, idx) => (
                    <button
                      key={idx}
                      onClick={() => setPrompt(sample.replace(/^[\u2000-\u3300\ud83c-\ud83e][\ufe0f]?\s*/, ''))}
                      className="text-[10px] bg-pink-50 dark:bg-pink-950/50 hover:bg-pink-100 text-pink-700 dark:text-pink-300 px-2 py-1 rounded-lg border border-pink-200 dark:border-pink-800 text-left truncate max-w-full font-medium"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style Presets */}
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block mb-2">2. Estilo Artístico</span>
                <div className="grid grid-cols-2 gap-2">
                  {STYLE_PRESETS.map(style => (
                    <button
                      key={style.id}
                      onClick={() => setSelectedStyle(style)}
                      className={`p-2 rounded-xl text-xs font-semibold text-left transition-all ${
                        selectedStyle.id === style.id
                          ? 'bg-pink-600 text-white shadow-md'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio */}
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block mb-2">3. Proporção</span>
                <div className="grid grid-cols-2 gap-2">
                  {ASPECT_RATIOS.map(ratio => (
                    <button
                      key={ratio.id}
                      onClick={() => setSelectedRatio(ratio)}
                      className={`p-2 rounded-xl text-xs font-semibold transition-all ${
                        selectedRatio.id === ratio.id
                          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-md'
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300'
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
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-6 min-h-[480px] flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Resultado do Estúdio Visual</span>
                {usedProvider && (
                  <span className="text-[10px] font-semibold bg-pink-100 dark:bg-pink-950 text-pink-700 dark:text-pink-300 px-2 py-0.5 rounded-full">
                    Provedor: {usedProvider}
                  </span>
                )}
              </div>

              <div className="my-auto flex items-center justify-center p-4">
                {isGenerating ? (
                  <div className="text-center space-y-3">
                    <Loader2 className="w-12 h-12 text-pink-600 animate-spin mx-auto" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sintetizando e renderizando os detalhes visuais...</p>
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
                      className="max-h-[420px] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 object-contain"
                    />
                    <div className="flex flex-wrap gap-2 justify-center">
                      <button
                        onClick={() => downloadImage(generatedImageUrl)}
                        className="px-4 py-2 bg-pink-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md hover:bg-pink-700"
                      >
                        <Download className="w-4 h-4" /> Baixar Imagem
                      </button>
                      <button
                        onClick={() => {
                          setSourceImage(generatedImageUrl);
                          setActiveTab('edit');
                          showNotification('Imagem carregada no modo de Edição!', 'success');
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md hover:bg-indigo-700"
                      >
                        <Wand2 className="w-4 h-4" /> Editar com IA
                      </button>
                      {onSendToCanva && (
                        <button
                          onClick={() => onSendToCanva(generatedImageUrl)}
                          className="px-4 py-2 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-purple-200"
                        >
                          <Edit3 className="w-4 h-4" /> Canva Studio
                        </button>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <div className="text-center text-slate-500 dark:text-slate-400 py-12 space-y-3">
                    <ImagePlus className="w-16 h-16 mx-auto opacity-30 text-pink-500" />
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Digite uma descrição e clique em "Gerar Imagem Agora"</p>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Suporta qualquer assunto: ilustrações, fotos conceituais, cenários, personagens e artes digitais.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Stock Photos Unsplash */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-indigo-600" /> Banco de Fotos Profissional
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={stockQuery}
                  onChange={(e) => setStockQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchStockPhotos()}
                  placeholder="Buscar foto real (ex: 'natureza', 'tecnologia', 'negócios')..."
                  className="flex-1 px-3.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
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
                    <div key={i} className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 aspect-video">
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
      ) : (
        /* AI Image Editing View */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-5 space-y-4">
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">1. Selecionar Imagem para Edição</span>

              {/* Upload Box */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-pink-500 dark:hover:border-pink-500 rounded-2xl p-4 text-center cursor-pointer transition-all bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center min-h-[140px]"
              >
                {sourceImage || generatedImageUrl ? (
                  <div className="relative group w-full flex flex-col items-center">
                    <img
                      src={sourceImage || generatedImageUrl}
                      alt="Imagem Fonte"
                      className="max-h-32 rounded-xl object-contain shadow-md"
                    />
                    <span className="text-[11px] font-bold text-pink-600 dark:text-pink-400 mt-2 flex items-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5" /> Clique para trocar imagem
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-8 h-8 text-pink-500 mx-auto opacity-70" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Envie uma imagem do seu dispositivo
                    </p>
                    <p className="text-[10px] text-slate-400">PNG, JPG, WEBP até 10MB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {/* Instruction Prompt */}
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block mb-2">
                  2. Comando de Edição com IA
                </span>
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  placeholder="Ex: 'Remova o fundo', 'Adicione óculos escuros', 'Mude o estilo para pintura a óleo'..."
                  className="w-full h-28 p-3 text-sm font-semibold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 border-2 border-slate-300 dark:border-slate-700 rounded-2xl outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200 resize-none shadow-inner"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-2">Comandos Rápidos:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {EDIT_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setEditPrompt(p.prompt)}
                      className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-pink-50 dark:hover:bg-pink-950/50 hover:text-pink-600 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-semibold text-left truncate transition-all"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleEditImageWithAi}
                disabled={isEditing || (!sourceImage && !generatedImageUrl) || !editPrompt.trim()}
                className="w-full py-3.5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 text-white font-bold rounded-2xl disabled:opacity-50 shadow-lg flex items-center justify-center gap-2 transition-all hover:opacity-95"
              >
                {isEditing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                {isEditing ? 'Processando Edição IA...' : 'Aplicar Edição com IA'}
              </button>
            </div>
          </div>

          {/* Edit Result Area */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 p-6 min-h-[480px] flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Resultado da Edição com IA</span>
                {usedProvider && (
                  <span className="text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                    IA: {usedProvider}
                  </span>
                )}
              </div>

              <div className="my-auto flex items-center justify-center p-4">
                {isEditing ? (
                  <div className="text-center space-y-3">
                    <Loader2 className="w-12 h-12 text-pink-600 animate-spin mx-auto" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Analisando imagem e aplicando modificações com o Gemini...
                    </p>
                  </div>
                ) : generatedImageUrl ? (
                  <div className="space-y-4 w-full flex flex-col items-center">
                    <img
                      src={generatedImageUrl}
                      alt="Imagem Editada"
                      className="max-h-[420px] rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 object-contain"
                    />
                    <div className="flex flex-wrap gap-2 justify-center">
                      <button
                        onClick={() => downloadImage(generatedImageUrl)}
                        className="px-4 py-2 bg-pink-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md hover:bg-pink-700"
                      >
                        <Download className="w-4 h-4" /> Baixar Resultado
                      </button>
                      {onSendToCanva && (
                        <button
                          onClick={() => onSendToCanva(generatedImageUrl)}
                          className="px-4 py-2 bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-purple-200"
                        >
                          <Edit3 className="w-4 h-4" /> Canva Studio
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-500 dark:text-slate-400 py-12 space-y-3">
                    <Wand2 className="w-16 h-16 mx-auto opacity-30 text-pink-500" />
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Envie uma foto e digite a instrução de edição</p>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      O Gemini processa a foto e gera uma nova versão adaptada ao seu pedido.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

