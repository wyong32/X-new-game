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

  // P0-4: STARTUP SAFETY CHECK
  const settings = await store.getSettings();
  const isLive = settings.x_data_mode === 'live' || process.env.X_DATA_MODE === 'live';

  if (isLive) {
    const password = process.env.APP_PASSWORD;
    if (!password || password.trim() === '') {
      console.error('FATAL: LIVE mode is enabled but APP_PASSWORD is not configured. Refusing to start server.');
      process.exit(1);
    }
  }

  // Auto-seed mock pipeline ONLY when in 'mock' mode and database has no posts
  if (!isLive && settings.x_data_mode === 'mock') {
    try {
      const posts = await store.getPosts();
      if (posts.length === 0) {
        console.log('🌱 Initializing X Game Discovery Lab with mock fixtures (mock mode)...');
        await seedAndRunMockWorkflow(store);
        console.log('✅ Initial mock pipeline completed.');
      }
    } catch (err) {
      console.warn('Mock seeding encountered an issue:', err);
    }
  } else {
    console.log('🔒 LIVE mode active (or existing data found). Startup completed safely without external API calls.');
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
