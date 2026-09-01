import React from 'react';
import { DocumentEditorLexical } from './DocumentEditorLexical';
import { StudioPowerBar } from './StudioPowerBar';

export const DocumentEditor: React.FC<React.ComponentProps<typeof DocumentEditorLexical>> = (props) => (
  <div className="orbidoc-productivity-shell min-w-0">
    <StudioPowerBar project={props.project} kind="word" showNotification={props.showNotification} />
    <DocumentEditorLexical {...props} />
  </div>
);
