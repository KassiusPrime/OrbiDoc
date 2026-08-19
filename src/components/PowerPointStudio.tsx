import React, { useMemo } from 'react';
import { PresentationEditor } from './PresentationEditor';
import { HistoryItem, SavedProject } from '../types';

interface PowerPointStudioProps {
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  showNotification?: (msg: string, type?: 'success' | 'error') => void;
  engineProvider?: string;
  engineModel?: string;
}

const PROJECTS_KEY = 'orbidoc_projects_v1';
const ACTIVE_KEY = 'orbidoc_active_powerpoint_project';

const resolveProject = (): SavedProject => {
  let projects: SavedProject[] = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
    if (Array.isArray(parsed)) projects = parsed;
  } catch { /* use empty list */ }
  const preferredId = localStorage.getItem(ACTIVE_KEY);
  const preferred = projects.find((project) => project.id === preferredId && project.type === 'powerpoint');
  const latest = projects.filter((project) => project.type === 'powerpoint').slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
  const now = new Date().toISOString();
  const project = preferred || latest || { id: crypto.randomUUID(), type: 'powerpoint' as const, title: 'Nova apresentação', createdAt: now, updatedAt: now, tags: [] };
  localStorage.setItem(ACTIVE_KEY, project.id);
  return project;
};

export const PowerPointStudio: React.FC<PowerPointStudioProps> = ({ onSaveToHistory, showNotification, engineProvider, engineModel }) => {
  const project = useMemo(resolveProject, []);
  const updateProject = (updated: SavedProject) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
      const projects: SavedProject[] = Array.isArray(parsed) ? parsed : [];
      const exists = projects.some((item) => item.id === updated.id);
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(exists ? projects.map((item) => item.id === updated.id ? updated : item) : [updated, ...projects]));
      localStorage.setItem(ACTIVE_KEY, updated.id);
      window.dispatchEvent(new CustomEvent('orbidoc:projects-updated', { detail: updated }));
    } catch (error) {
      console.warn('Falha ao atualizar projeto da apresentação:', error);
    }
  };
  return <PresentationEditor project={project} onProjectChange={updateProject} onSaveToHistory={onSaveToHistory} showNotification={showNotification} engineProvider={engineProvider} engineModel={engineModel} />;
};
