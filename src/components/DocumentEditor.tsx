import React from 'react';
import { DocumentEditorStudio } from './DocumentEditorStudio';
import { StudioPowerBar } from './StudioPowerBar';

export const DocumentEditor: React.FC<React.ComponentProps<typeof DocumentEditorStudio>> = (props) => <div><StudioPowerBar project={props.project} kind="word" showNotification={props.showNotification} /><DocumentEditorStudio {...props} /></div>;
