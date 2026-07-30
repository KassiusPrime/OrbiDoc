import React from 'react';
import { 
  IconRobot as Bot, IconFileText as FileText, IconPhotoPlus as ImagePlus, IconMicrophone as Mic, 
  IconFolder as FolderKanban, IconSparkles as Sparkles, IconLayoutColumns as SplitSquareHorizontal, 
  IconFileSpreadsheet as FileSpreadsheet, IconPresentation as Presentation, IconPencil as PenTool, 
  IconHistory as History, IconChartBar as BarChart2, IconVolume as Volume2, IconArrowRight as ArrowRight, 
  IconClock as Clock, IconPlus as Plus, IconDatabase as HardDrive, IconCircleCheck as CheckCircle2, 
  IconChevronRight as ChevronRight, IconStack2 as Layers, IconLayoutGrid as Grid, IconEdit as Edit3, 
  IconShieldCheck as ShieldCheck
} from '@tabler/icons-react';
import { motion } from 'motion/react';
import { TabType, HistoryItem, SavedProject, ChatSession, GoogleUserProfile, MicrosoftUserProfile } from '../types';

interface HomeDashboardProps {
  onNavigate: (tab: TabType) => void;
  onNewChat: () => void;
  recentHistory: HistoryItem[];
  recentProjects: SavedProject[];
  recentChats: ChatSession[];
  googleUser: GoogleUserProfile | null;
  microsoftUser: MicrosoftUserProfile | null;
  activeEngineLabel: string;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onNavigate,
  onNewChat,
  recentHistory,
  recentProjects,
  recentChats,
  googleUser,
  microsoftUser,
  activeEngineLabel,
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const userName = googleUser?.name || microsoftUser?.name || 'Kaíque';

  return (
    <div className="space-y-8 pb-12 animate-fadeIn">
      {/* Greeting Banner & User Welcome */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-500/20">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-semibold text-indigo-100">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>DocSwiss Workspace • {activeEngineLabel}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
              {getGreeting()}, <span className="text-indigo-200">{userName}</span>
            </h1>
            <p className="text-sm sm:text-base text-indigo-100/90 font-medium max-w-xl">
              O que você quer criar ou analisar hoje? Seu espaço de trabalho inteligente está pronto.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onNewChat}
              className="px-5 py-3 bg-white text-indigo-700 hover:bg-indigo-50 font-bold rounded-2xl shadow-lg flex items-center gap-2 text-sm transition-all"
            >
              <Bot className="w-4.5 h-4.5 text-indigo-600" />
              <span>Novo Chat IA</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => onNavigate('extract')}
              className="px-4 py-3 bg-white/15 hover:bg-white/25 border border-white/20 text-white font-semibold rounded-2xl backdrop-blur-md flex items-center gap-2 text-sm transition-all"
            >
              <FileText className="w-4.5 h-4.5" />
              <span>Escanear OCR</span>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Quick Action Grid (Primary Flow Entrypoints) */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 px-1">
          Ações Rápidas
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            { 
              title: 'Novo Chat IA', 
              desc: 'Assistente inteligente', 
              icon: Bot, 
              color: 'from-indigo-500 to-purple-600', 
              action: onNewChat 
            },
            { 
              title: 'Escanear OCR', 
              desc: 'PDFs & Imagens', 
              icon: FileText, 
              color: 'from-blue-500 to-cyan-600', 
              action: () => onNavigate('extract') 
            },
            { 
              title: 'Documento Word', 
              desc: 'Editor completo', 
              icon: Edit3, 
              color: 'from-emerald-500 to-teal-600', 
              action: () => onNavigate('word') 
            },
            { 
              title: 'Gerar Imagem', 
              desc: 'Arte com IA', 
              icon: ImagePlus, 
              color: 'from-pink-500 to-rose-600', 
              action: () => onNavigate('image') 
            },
          ].map((item, idx) => (
            <motion.button
              key={idx}
              whileTap={{ scale: 0.96 }}
              onClick={item.action}
              className="group p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 rounded-2xl text-left shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-32"
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}>
                <item.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  {item.desc}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Continue Your Work (Recent Activity Flow) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            Continue seu trabalho
          </h2>
          <button 
            onClick={() => onNavigate('history')}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <span>Ver tudo</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentChats.length === 0 && recentProjects.length === 0 && recentHistory.length === 0 ? (
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl text-center space-y-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Nenhuma atividade recente registrada ainda.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Inicie um chat, escaneie um documento ou crie uma arte para começar seu histórico de trabalho.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            {/* Recent Chat */}
            {recentChats.length > 0 && (
              <motion.div
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigate('chat')}
                className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-500/50 rounded-2xl cursor-pointer shadow-sm hover:shadow-md transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/50 flex items-center gap-1">
                    <Bot className="w-3 h-3" />
                    Última conversa
                  </span>
                  <span className="text-[10px] text-slate-400">Chat IA</span>
                </div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm line-clamp-1">
                  "{recentChats[0].title || 'Conversa sem título'}"
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                  {recentChats[0].messages[recentChats[0].messages.length - 1]?.content || 'Conversa iniciada'}
                </p>
                <div className="pt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                  <span>Continuar chat</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </motion.div>
            )}

            {/* Recent Project */}
            {recentProjects.length > 0 && (
              <motion.div
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigate(recentProjects[0].type as TabType)}
                className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 rounded-2xl cursor-pointer shadow-sm hover:shadow-md transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/50 flex items-center gap-1">
                    <FolderKanban className="w-3 h-3" />
                    Último projeto
                  </span>
                  <span className="text-[10px] text-slate-400 capitalize">{recentProjects[0].type}</span>
                </div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm line-clamp-1">
                  {recentProjects[0].title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                  {recentProjects[0].previewSnippet || 'Projeto em andamento'}
                </p>
                <div className="pt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span>Abrir projeto</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </motion.div>
            )}

            {/* Recent History Item */}
            {recentHistory.length > 0 && (
              <motion.div
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigate('history')}
                className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-purple-500/50 rounded-2xl cursor-pointer shadow-sm hover:shadow-md transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-900/50 flex items-center gap-1">
                    <History className="w-3 h-3" />
                    Registro recente
                  </span>
                  <span className="text-[10px] text-slate-400">{recentHistory[0].timestamp}</span>
                </div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm line-clamp-1">
                  {recentHistory[0].title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                  {recentHistory[0].summary}
                </p>
                <div className="pt-2 text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                  <span>Ver registro</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Main Feature Cards / Flow Clusters */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 px-1">
          Explore os Módulos do DocSwiss
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: IA & Chat */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/50">
                  Gemini & ChatGPT
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Inteligência Artificial Multi-Modelo
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Converse com assistentes avançados, faça upload de PDFs e planilhas para análise profunda, ou compare respostas lado a lado na Arena de Modelos.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
              <button
                onClick={onNewChat}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Chat IA</span>
              </button>
              <button
                onClick={() => onNavigate('compare')}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <SplitSquareHorizontal className="w-3.5 h-3.5 text-indigo-500" />
                <span>Arena</span>
              </button>
              <button
                onClick={() => onNavigate('ai')}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                <span>Studio de Texto</span>
              </button>
            </div>
          </div>

          {/* Card 2: Suíte Office & Documentos */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Grid className="w-6 h-6" />
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/50">
                  Microsoft 365 & Canva
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Criação & Edição de Documentos Pro
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Editor DOCX nativo Word Pro, planilhas inteligentes no Excel Pro, gerador de slides no PowerPoint Pro e Canva Visual Studio em uma única central.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
              <button
                onClick={() => onNavigate('word')}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Word Pro</span>
              </button>
              <button
                onClick={() => onNavigate('excel')}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel Pro</span>
              </button>
              <button
                onClick={() => onNavigate('powerpoint')}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Presentation className="w-3.5 h-3.5" />
                <span>PowerPoint</span>
              </button>
              <button
                onClick={() => onNavigate('canva')}
                className="px-3.5 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Canva</span>
              </button>
            </div>
          </div>

          {/* Card 3: Digitalização & OCR */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 border border-cyan-200/50 dark:border-cyan-900/50">
                  OCR & Tesseract
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Scanner & Extrator de Texto
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Extraia texto de fotos, comprovantes e arquivos PDF com motor OCR local e nuvem. Limpeza automática de artefatos e exportação para Word e PDF.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
              <button
                onClick={() => onNavigate('extract')}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Abrir Scanner OCR</span>
              </button>
            </div>
          </div>

          {/* Card 4: Mídia, Arte & Áudio */}
          <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <ImagePlus className="w-6 h-6" />
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-900/50">
                  Imagens & Áudio
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Criação de Arte & Laboratório de Voz
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Gere ilustrações e banners visuais em alta resolução com Pollinations AI, sintetize textos para voz humana ou faça transcrição instantânea de reuniões.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
              <button
                onClick={() => onNavigate('image')}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                <span>Gerar Arte</span>
              </button>
              <button
                onClick={() => onNavigate('audio')}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Volume2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Áudio Lab</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
