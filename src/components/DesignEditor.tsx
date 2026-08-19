import React, { useEffect, useMemo, useRef } from 'react';
import { DesignEditorPro } from './DesignEditorPro';

export const DesignEditor: React.FC<React.ComponentProps<typeof DesignEditorPro>> = (props) => {
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
    const alreadyHasObjects = current && Array.isArray(current.objects) && current.objects.length > 0;
    const image = importedImageRef.current;
    if (!image || alreadyHasObjects) return props.project;

    const width = 1080;
    const height = 1080;
    return {
      ...props.project,
      content: {
        title: props.project.title || 'Novo design',
        width,
        height,
        background: '#ffffff',
        objects: [{
          id: crypto.randomUUID(),
          type: 'image',
          x: 120,
          y: 180,
          width: 840,
          height: 620,
          rotation: 0,
          opacity: 1,
          fill: '#ffffff',
          content: image,
          fontSize: 16,
          fontFamily: 'Inter',
          fontWeight: 400,
          textAlign: 'left',
        }],
      },
      previewSnippet: 'Imagem importada do Estúdio de Imagens.',
      updatedAt: new Date().toISOString(),
    };
  }, [props.project.id]);

  useEffect(() => {
    if (hydratedProject !== props.project) props.onProjectChange(hydratedProject);
  }, [hydratedProject, props.project, props.onProjectChange]);

  return <DesignEditorPro {...props} project={hydratedProject} />;
};
