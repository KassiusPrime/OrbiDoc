import React, { useState } from 'react';
import { 
  IconSearch, IconUpload, IconPhoto, IconSparkles, IconX,
  IconCheck, IconDownload, IconExternalLink, IconStack2 as IconLayers, IconLayoutGrid as IconGrid,
  IconBrandUnsplash, IconPalette, IconCircleCheck, IconLoader2, IconPlus
} from '@tabler/icons-react';

export interface GraphicItem {
  id: string;
  title: string;
  source: 'flaticon' | 'freepik' | 'icons8' | 'iconscout' | 'behance' | 'smashing' | 'unsplash' | 'pexels' | 'uploaded';
  type: 'icon' | 'vector' | 'photo' | 'badge';
  previewUrl: string;
  tags: string[];
}

interface SmartGraphicsLibraryProps {
  onSelectGraphic: (item: GraphicItem) => void;
  onDirectUpload?: (file: File) => void;
  showNotification?: (msg: string, type?: 'success' | 'error') => void;
}

// Curated high quality icons, vectors, stock photos across sources
const CURATED_GRAPHICS: GraphicItem[] = [
  // Flaticon / Icons
  {
    id: 'flaticon_rocket',
    title: 'Foguete 3D Launch',
    source: 'flaticon',
    type: 'icon',
    previewUrl: 'https://images.unsplash.com/photo-1517976487492-5750f3195933?w=300&auto=format&fit=crop&q=80',
    tags: ['rocket', 'launch', 'startup', 'tech', 'business']
  },
  {
    id: 'flaticon_brain',
    title: 'Cérebro IA & Inovação',
    source: 'flaticon',
    type: 'icon',
    previewUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80',
    tags: ['ai', 'brain', 'tech', 'smart', 'future']
  },

  // Freepik / Vectors
  {
    id: 'freepik_dashboard',
    title: 'Dashboard Vector UI',
    source: 'freepik',
    type: 'vector',
    previewUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=300&auto=format&fit=crop&q=80',
    tags: ['dashboard', 'chart', 'analytics', 'data']
  },
  {
    id: 'freepik_gradient',
    title: 'Background Gradiente Neon',
    source: 'freepik',
    type: 'vector',
    previewUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=300&auto=format&fit=crop&q=80',
    tags: ['gradient', 'background', 'abstract', 'art']
  },

  // Icons8 / 3D Icons
  {
    id: 'icons8_shield',
    title: 'Escudo Segurança 3D',
    source: 'icons8',
    type: 'icon',
    previewUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=300&auto=format&fit=crop&q=80',
    tags: ['shield', 'security', 'protection', 'lock']
  },
  {
    id: 'icons8_target',
    title: 'Alvo de Vendas & Metas',
    source: 'icons8',
    type: 'icon',
    previewUrl: 'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=300&auto=format&fit=crop&q=80',
    tags: ['target', 'goals', 'marketing', 'sales']
  },

  // Unsplash Photography
  {
    id: 'unsplash_workspace',
    title: 'Workspace Minimalista',
    source: 'unsplash',
    type: 'photo',
    previewUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=500&auto=format&fit=crop&q=80',
    tags: ['laptop', 'code', 'workspace', 'office', 'minimal']
  },
  {
    id: 'unsplash_meeting',
    title: 'Reunião Corporativa',
    source: 'unsplash',
    type: 'photo',
    previewUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=500&auto=format&fit=crop&q=80',
    tags: ['team', 'business', 'people', 'meeting']
  },
  {
    id: 'unsplash_tech',
    title: 'Rede Neural & Dados',
    source: 'unsplash',
    type: 'photo',
    previewUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500&auto=format&fit=crop&q=80',
    tags: ['tech', 'data', 'matrix', 'cyber']
  },

  // Pexels Photography
  {
    id: 'pexels_nature',
    title: 'Paisagem Elegante Natureza',
    source: 'pexels',
    type: 'photo',
    previewUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=500&auto=format&fit=crop&q=80',
    tags: ['nature', 'forest', 'calm', 'wallpaper']
  },
  {
    id: 'pexels_design',
    title: 'Paleta de Cores e Croquis',
    source: 'pexels',
    type: 'photo',
    previewUrl: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=500&auto=format&fit=crop&q=80',
    tags: ['design', 'colors', 'art', 'creative']
  }
];

export const SmartGraphicsLibrary: React.FC<SmartGraphicsLibraryProps> = ({
  onSelectGraphic,
  onDirectUpload,
  showNotification = () => {}
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSource, setActiveSource] = useState<string>('all');
  const [activeType, setActiveType] = useState<string>('all');
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [customGraphics, setCustomGraphics] = useState<GraphicItem[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (onDirectUpload) {
      onDirectUpload(file);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      const newItem: GraphicItem = {
        id: `upload_${Date.now()}`,
        title: file.name,
        source: 'uploaded',
        type: 'photo',
        previewUrl: url,
        tags: ['custom', 'uploaded']
      };
      setCustomGraphics(prev => [newItem, ...prev]);
      onSelectGraphic(newItem);
      showNotification(`Elemento "${file.name}" carregado com sucesso!`, 'success');
    };
    reader.readAsDataURL(file);
  };

  const allItems = [...customGraphics, ...CURATED_GRAPHICS];

  const filteredItems = allItems.filter(item => {
    const matchesSearch = !searchTerm.trim() || 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSource = activeSource === 'all' || item.source === activeSource;
    const matchesType = activeType === 'all' || item.type === activeType;

    return matchesSearch && matchesSource && matchesType;
  });

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-sm">
      
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <IconSearch className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Biblioteca de Ícones e Elementos Gráficos
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Pesquise bancos gratuitos: Flaticon, Freepik, Icons8, Unsplash, Pexels e insira no canvas.
          </p>
        </div>

        {/* Direct Upload Button */}
        <label className="cursor-pointer px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-2xl shadow-xs transition-all flex items-center gap-1.5 shrink-0">
          <IconUpload className="w-4 h-4" />
          <span>Upload Direto</span>
          <input
            type="file"
            accept="image/*,.svg"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Smart Search Bar */}
      <div className="relative">
        <IconSearch className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Pesquisar por termo (ex: foguete, 3d, tecnologia, negócios, relógio)..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-indigo-500 rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-200 outline-none"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
          >
            <IconX className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Provider Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] no-scrollbar">
        {[
          { id: 'all', label: 'Todos os Bancos' },
          { id: 'flaticon', label: 'Flaticon' },
          { id: 'freepik', label: 'Freepik' },
          { id: 'icons8', label: 'Icons8' },
          { id: 'iconscout', label: 'IconScout' },
          { id: 'unsplash', label: 'Unsplash' },
          { id: 'pexels', label: 'Pexels' },
          { id: 'behance', label: 'Behance' },
          { id: 'smashing', label: 'Smashing Mag' },
        ].map((provider) => (
          <button
            key={provider.id}
            onClick={() => setActiveSource(provider.id)}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
              activeSource === provider.id
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {provider.label}
          </button>
        ))}
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto pr-1">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            onClick={() => {
              onSelectGraphic(item);
              showNotification(`Elemento "${item.title}" selecionado para o Canva!`, 'success');
            }}
            className="group relative rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-950/60 cursor-pointer hover:border-indigo-500 hover:shadow-md transition-all flex flex-col"
          >
            <div className="h-28 w-full overflow-hidden bg-slate-200 dark:bg-slate-800 relative">
              <img
                src={item.previewUrl}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <span className="absolute top-2 right-2 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-900/80 text-white backdrop-blur-xs">
                {item.source}
              </span>
            </div>
            <div className="p-2 flex-1 flex flex-col justify-between">
              <h4 className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                {item.title}
              </h4>
              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                <span>{item.type}</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold group-hover:underline flex items-center gap-0.5">
                  <IconPlus className="w-3 h-3 inline" /> Inserir
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
