import React from 'react';
import { SpreadsheetEditorStudio } from './SpreadsheetEditorStudio';
import { StudioPowerBar } from './StudioPowerBar';

export const SpreadsheetEditor: React.FC<React.ComponentProps<typeof SpreadsheetEditorStudio>> = (props) => <div><StudioPowerBar project={props.project} kind="excel" showNotification={props.showNotification} /><SpreadsheetEditorStudio {...props} /></div>;
