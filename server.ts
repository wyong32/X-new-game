import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { apiRouter } from './server/routes/api.js';
import { store } from './server/db/store.js';
import { seedAndRunMockWorkflow } from './server/services/queryRunner.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Mount API router
  app.use('/api', apiRouter);

  // Auto-seed mock pipeline on initial launch if database is fresh
  try {
    if (store.getPosts().length === 0) {
      console.log('🌱 Initializing X Game Discovery Lab with mock fixtures...');
      await seedAndRunMockWorkflow();
      console.log('✅ Initial mock pipeline completed.');
    }
  } catch (err) {
    console.warn('Mock seeding encountered an issue:', err);
  }

  // Vite middleware in dev mode, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 X Game Discovery Lab running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
