import React from 'react';
import { DocumentEditorStudio } from './DocumentEditorStudio';
import { DocumentFindReplaceBar } from './DocumentFindReplaceBar';
import { DocumentProPanel } from './DocumentProPanel';
import { StudioPowerBar } from './StudioPowerBar';

/**
 * Orbit Nova (documentos) — hierarquia estilo Google Docs.
 *
 * A folha é a protagonista: nada é empilhado acima dela por padrão. As
 * ferramentas avançadas (Localizar/Substituir, Documento Pro e Studio Pro)
 * vivem no drawer lateral do DocumentEditorStudio, aberto pelo botão flutuante
 * "Avançado" ou por Ctrl/Cmd+H. Os painéis continuam operando sobre a classe
 * `.orbidoc-rich-editor`, então autosave/undo permanecem intactos.
 */
export const DocumentEditor: React.FC<React.ComponentProps<typeof DocumentEditorStudio>> = (props) => (
  <DocumentEditorStudio
    {...props}
    advancedTools={(
      <>
        <DocumentFindReplaceBar embedded showNotification={props.showNotification} />
        <DocumentProPanel defaultOpen showNotification={props.showNotification} />
        <StudioPowerBar project={props.project} kind="word" layout="stack" showNotification={props.showNotification} />
      </>
    )}
  />
);
