import React, { useState } from 'react';
import { SpreadsheetEditorStudio } from './SpreadsheetEditorStudio';
import { StudioPowerBar } from './StudioPowerBar';
import { SpreadsheetProPanel } from './SpreadsheetProPanel';

export const SpreadsheetEditor: React.FC<React.ComponentProps<typeof SpreadsheetEditorStudio>> = (props) => {
  const [revision, setRevision] = useState(0);
  return <div>
    <StudioPowerBar project={props.project} kind="excel" showNotification={props.showNotification} />
    <SpreadsheetProPanel project={props.project} onProjectChange={props.onProjectChange} onApplied={() => setRevision((value) => value + 1)} showNotification={props.showNotification} />
    <SpreadsheetEditorStudio key={`${props.project.id}:${revision}`} {...props} />
  </div>;
};