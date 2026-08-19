import React, { useMemo } from 'react';
import { DesignEditor } from './DesignEditor';
import { HistoryItem, SavedProject } from '../types';

interface CanvaDesignStudioProps {
  initialTemplate?: string;
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  showNotification?: (msg: string, type?: 'success' | 'error') => void;
  onSendToOcr?: (textOrImage: string) => void;
  engineProvider?: string;
  engineModel?: string;
}

const PROJECTS_KEY = 'docswiss_projects_v1';
const ACTIVE_KEY = 'docswiss_active_canva_project';

const resolveProject = (): SavedProject => {
  let projects: SavedProject[] = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
    if (Array.isArray(parsed)) projects = parsed;
  } catch { /* use empty */ }
  const preferredId = localStorage.getItem(ACTIVE_KEY);
  const preferred = projects.find((project) => project.id === preferredId && project.type === 'canva');
  const latest = projects.filter((project) => project.type === 'canva').slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
  const now = new Date().toISOString();
  const project = preferred || latest || { id: crypto.randomUUID(), type: 'canva' as const, title: 'Novo design', createdAt: now, updatedAt: now, tags: [] };
  localStorage.setItem(ACTIVE_KEY, project.id);
  return project;
};

export const CanvaDesignStudio: React.FC<CanvaDesignStudioProps> = ({
  onSaveToHistory,
  showNotification,
  onSendToOcr,
  engineProvider,
  engineModel,
}) => {
  const project = useMemo(resolveProject, []);
  const updateProject = (updated: SavedProject) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
      const projects: SavedProject[] = Array.isArray(parsed) ? parsed : [];
      const exists = projects.some((item) => item.id === updated.id);
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(exists ? projects.map((item) => item.id === updated.id ? updated : item) : [updated, ...projects]));
      localStorage.setItem(ACTIVE_KEY, updated.id);
      window.dispatchEvent(new CustomEvent('docswiss:projects-updated', { detail: updated }));
    } catch (error) {
      console.warn('Falha ao atualizar projeto de design:', error);
    }
  };
  return <DesignEditor project={project} onProjectChange={updateProject} onSaveToHistory={onSaveToHistory} showNotification={showNotification} onSendToOcr={onSendToOcr} engineProvider={engineProvider} engineModel={engineModel} />;
};
