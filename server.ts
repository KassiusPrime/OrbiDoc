import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nexusAI } from './api/_lib/nexusAI.js';
import { NEXUS_FREE_MODELS } from './api/_lib/nexusFreeAI.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(express.json({ limit: '20mb' }));

app.get('/api/ai/status', (_req, res) => {
  const status = nexusAI.status();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    assistant: status.assistant,
    gateway: status.gateway,
    configured: status.configured,
    freeOnly: status.freeOnly,
    healthyModels: status.circuits.filter((circuit) => circuit.failures < 3).length,
    unavailableModels: status.circuits.filter((circuit) => circuit.failures >= 3).length,
    totalModels: status.circuits.length,
  });
});

app.get('/api/health', (_req, res) => {
  const status = nexusAI.status();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    assistant: status.assistant,
    gateway: status.gateway,
    configured: status.configured,
    freeOnly: status.freeOnly,
    userSelectableModels: false,
    internalPoolSize: NEXUS_FREE_MODELS.length,
  });
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Orbit server listening on ${port}`));
