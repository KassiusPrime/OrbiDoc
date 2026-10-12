import React from 'react';
import { ImageWorkspace } from './ImageWorkspace';
import { HistoryItem } from '../types';

interface ImageGeneratorStudioProps {
  onSaveToHistory?: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  showNotification?: (message: string, type?: 'success' | 'error') => void;
  engineProvider?: string;
  engineModel?: string;
}

export const ImageGeneratorStudio: React.FC<ImageGeneratorStudioProps> = ({
  onSaveToHistory,
  showNotification,
}) => (
  <ImageWorkspace
    onSaveToHistory={onSaveToHistory}
    showNotification={showNotification}
  />
);
