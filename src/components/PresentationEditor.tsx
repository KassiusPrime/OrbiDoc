import React from 'react';
import { PresentationEditorStudio } from './PresentationEditorStudio';
import { StudioPowerBar } from './StudioPowerBar';

export const PresentationEditor: React.FC<React.ComponentProps<typeof PresentationEditorStudio>> = (props) => <div><StudioPowerBar project={props.project} kind="powerpoint" showNotification={props.showNotification} /><PresentationEditorStudio {...props} /></div>;
