import express from 'express';
import { createPlayersRouter } from './players.routes.js';
import { createMediaRouter } from './media.routes.js';
import { createConfigRouter } from './config.routes.js';
import { createScannerRouter } from './scanner.routes.js';

/**
 * Главный роутер приложения
 * Объединяет все маршруты
 */
export function createApiRouter(dependencies) {
  const router = express.Router();

  const {
    wiimClient,
    storage,
    networkScanner,
    statsService
  } = dependencies;

  // Подключение всех роутеров
  router.use('/players', createPlayersRouter(wiimClient, storage));
  router.use('/media', createMediaRouter(storage));
  router.use('/config', createConfigRouter(storage, statsService));
  router.use('/scanner', createScannerRouter(networkScanner));

  return router;
}
