import React, { useState } from 'react';
import { PresentationEditorStudio } from './PresentationEditorStudio';
import { StudioPowerBar } from './StudioPowerBar';
import { PresentationProPanel } from './PresentationProPanel';

export const PresentationEditor: React.FC<React.ComponentProps<typeof PresentationEditorStudio>> = (props) => {
  const [revision, setRevision] = useState(0);
  return <div>
    <StudioPowerBar project={props.project} kind="powerpoint" showNotification={props.showNotification} />
    <PresentationProPanel project={props.project} onProjectChange={props.onProjectChange} onApplied={() => setRevision((value) => value + 1)} showNotification={props.showNotification} />
    <PresentationEditorStudio key={`${props.project.id}:${revision}`} {...props} />
  </div>;
};