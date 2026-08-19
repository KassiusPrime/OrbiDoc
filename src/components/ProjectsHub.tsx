import React, { useEffect, useState } from 'react';
import { FilesWorkspace } from './FilesWorkspace';
import { SavedProject } from '../types';

interface ProjectsHubProps {
  onOpenProject: (project: SavedProject) => void;
  onCreateNewProject?: (type: SavedProject['type']) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
}

const PROJECTS_KEY = 'docswiss_projects_v1';

const readProjects = (): SavedProject[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const ProjectsHub: React.FC<ProjectsHubProps> = ({
  onOpenProject,
  onCreateNewProject,
  showNotification,
}) => {
  const [projects, setProjects] = useState<SavedProject[]>(readProjects);

  useEffect(() => {
    const refresh = () => setProjects(readProjects());
    window.addEventListener('docswiss:projects-updated', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('docswiss:projects-updated', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const commit = (next: SavedProject[]) => {
    setProjects(next);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('docswiss:projects-updated'));
  };

  const updateProject = (project: SavedProject) => {
    const exists = projects.some((item) => item.id === project.id);
    commit(exists ? projects.map((item) => item.id === project.id ? project : item) : [project, ...projects]);
  };

  const deleteProject = (id: string) => commit(projects.filter((project) => project.id !== id));

  return (
    <FilesWorkspace
      projects={projects}
      onOpenProject={onOpenProject}
      onCreateProject={(type) => onCreateNewProject?.(type)}
      onUpdateProject={updateProject}
      onDeleteProject={deleteProject}
      showNotification={showNotification}
    />
  );
};
