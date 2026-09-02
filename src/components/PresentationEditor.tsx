import React, { useState } from 'react';
import { PresentationEditorStudio } from './PresentationEditorStudio';
import { PresentationProPanel } from './PresentationProPanel';
import { OrbitEditorFrame } from './orbit/OrbitEditorFrame';

export const PresentationEditor: React.FC<React.ComponentProps<typeof PresentationEditorStudio>> = (props) => {
  const [revision, setRevision] = useState(0);

  return (
    <OrbitEditorFrame
      kind="powerpoint"
      project={props.project}
      showNotification={props.showNotification}
      tools={(
        <PresentationProPanel
          project={props.project}
          onProjectChange={props.onProjectChange}
          onApplied={() => setRevision((value) => value + 1)}
          showNotification={props.showNotification}
        />
      )}
    >
      <PresentationEditorStudio key={`${props.project.id}:${revision}`} {...props} />
    </OrbitEditorFrame>
  );
};
