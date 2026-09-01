import React from 'react';
import { SpreadsheetEditorFortune } from './SpreadsheetEditorFortune';
import { StudioPowerBar } from './StudioPowerBar';

export const SpreadsheetEditor: React.FC<React.ComponentProps<typeof SpreadsheetEditorFortune>> = (props) => (
  <div className="orbidoc-productivity-shell min-w-0">
    <StudioPowerBar project={props.project} kind="excel" showNotification={props.showNotification} />
    <SpreadsheetEditorFortune {...props} />
  </div>
);
