import React, { useEffect, useMemo, useRef } from 'react';
import { DesignEditorStudio } from './DesignEditorStudio';
import { createStudioElement } from '../lib/officeStudio';

export const DesignEditor: React.FC<React.ComponentProps<typeof DesignEditorStudio>> = (props) => {
  const importedImageRef = useRef<string | null | undefined>(undefined);
  if (importedImageRef.current === undefined) {
    try {
      importedImageRef.current = sessionStorage.getItem('orbidoc_design_import_image');
      sessionStorage.removeItem('orbidoc_design_import_image');
    } catch {
      importedImageRef.current = null;
    }
  }

  const hydratedProject = useMemo(() => {
    const current = props.project.content as any;
    const alreadyHasElements = current && ((Array.isArray(current.elements) && current.elements.length > 0) || (Array.isArray(current.objects) && current.objects.length > 0));
    const image = importedImageRef.current;
    if (!image || alreadyHasElements) return props.project;

    const width = 1080;
    const height = 1080;
    return {
      ...props.project,
      content: {
        version: 4,
        title: props.project.title || 'Novo design',
        width,
        height,
        background: '#ffffff',
        elements: [createStudioElement('image', width, height, {
          x: 120,
          y: 180,
          width: 840,
          height: 620,
          content: image,
          fill: 'transparent',
        })],
      },
      previewSnippet: 'Imagem importada do Estúdio de Imagens.',
      updatedAt: new Date().toISOString(),
    };
  }, [props.project.id]);

  useEffect(() => {
    if (hydratedProject !== props.project) props.onProjectChange(hydratedProject);
  }, [hydratedProject, props.project, props.onProjectChange]);

  return <DesignEditorStudio {...props} project={hydratedProject} />;
};
