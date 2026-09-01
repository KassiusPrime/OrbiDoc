import React from 'react';

/**
 * Nexus AI no longer exposes provider/model/API-key controls in the product UI.
 *
 * The component remains mounted temporarily so older native shells can update
 * without a breaking import. It intentionally renders nothing. OpenRouter
 * credentials belong to the secure server runtime, never to the web frontend.
 */
export const NativeAiSettingsLauncher: React.FC = () => null;
