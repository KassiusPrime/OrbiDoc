import React, { useMemo } from 'react';
import { DocumentEditor } from './DocumentEditor';
import { HistoryItem, SavedProject } from '../types';

interface WordEditorProps {
  initialContent?: string;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  showNotification?: (msg: string, type?: 'success' | 'error') => void;
  engineProvider?: string;
  engineModel?: string;
}

const PROJECTS_KEY = 'orbidoc_projects_v1';
const ACTIVE_KEY = 'orbidoc_active_word_project';

const plainToHtml = (value: string) => {
  if (!value.trim()) return '';
  if (/<(?:p|h1|h2|h3|ul|ol|table|div|blockquote|pre|img)\b/i.test(value)) return value;
  const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return value.split(/\r?\n/).map((line) => {
    const text = line.trim();
    if (!text) return '<p><br></p>';
    if (/^###\s+/.test(text)) return `<h3>${escape(text.replace(/^###\s+/, ''))}</h3>`;
    if (/^##\s+/.test(text)) return `<h2>${escape(text.replace(/^##\s+/, ''))}</h2>`;
    if (/^#\s+/.test(text)) return `<h1>${escape(text.replace(/^#\s+/, ''))}</h1>`;
    if (/^[-*•]\s+/.test(text)) return `<p>• ${escape(text.replace(/^[-*•]\s+/, ''))}</p>`;
    return `<p>${escape(line)}</p>`;
  }).join('');
};

const resolveProject = (initialContent?: string): SavedProject => {
  let projects: SavedProject[] = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
    if (Array.isArray(parsed)) projects = parsed;
  } catch { /* use empty list */ }

  const preferredId = localStorage.getItem(ACTIVE_KEY);
  const preferred = projects.find((project) => project.id === preferredId && project.type === 'word');
  const latest = projects
    .filter((project) => project.type === 'word')
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
  const now = new Date().toISOString();
  const project = preferred || latest || {
    id: crypto.randomUUID(),
    type: 'word' as const,
    title: 'Novo documento',
    createdAt: now,
    updatedAt: now,
    content: '',
    tags: [],
  };

  localStorage.setItem(ACTIVE_KEY, project.id);
  if (initialContent?.trim()) return { ...project, content: plainToHtml(initialContent), updatedAt: now };
  return project;
};

export const WordEditor: React.FC<WordEditorProps> = ({
  initialContent,
  onSaveToHistory,
  showNotification,
  engineProvider,
  engineModel,
}) => {
  const project = useMemo(() => resolveProject(initialContent), []);

  const updateProject = (updated: SavedProject) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
      const projects: SavedProject[] = Array.isArray(parsed) ? parsed : [];
      const exists = projects.some((item) => item.id === updated.id);
      const next = exists
        ? projects.map((item) => item.id === updated.id ? updated : item)
        : [updated, ...projects];
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(next));
      localStorage.setItem(ACTIVE_KEY, updated.id);
      window.dispatchEvent(new CustomEvent('orbidoc:projects-updated', { detail: updated }));
    } catch (error) {
      console.warn('Falha ao atualizar projeto do documento:', error);
    }
  };

  return (
    <DocumentEditor
      project={project}
      onProjectChange={updateProject}
      onSaveToHistory={onSaveToHistory}
      showNotification={showNotification}
      engineProvider={engineProvider}
      engineModel={engineModel}
    />
  );
};
