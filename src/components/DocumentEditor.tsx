import React from 'react';
import { DocumentEditorStudio } from './DocumentEditorStudio';
import { DocumentFindReplaceBar } from './DocumentFindReplaceBar';
import { DocumentProPanel } from './DocumentProPanel';
import { StudioPowerBar } from './StudioPowerBar';

export const DocumentEditor: React.FC<React.ComponentProps<typeof DocumentEditorStudio>> = (props) => (
  <div className="orbidoc-creator-shell" data-orbidoc-creator="word">
    <StudioPowerBar project={props.project} kind="word" showNotification={props.showNotification} />
    <DocumentFindReplaceBar showNotification={props.showNotification} />
    <DocumentProPanel showNotification={props.showNotification} />
    <DocumentEditorStudio {...props} />
  </div>
);
