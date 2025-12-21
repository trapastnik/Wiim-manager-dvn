import express from 'express';
import * as configController from '../controllers/config.controller.js';

/**
 * Маршруты для управления конфигурацией
 */
export function createConfigRouter(storage, statsService) {
  const router = express.Router();

  // Получить конфигурацию
  router.get('/', (req, res) =>
    configController.getConfig(req, res, storage)
  );

  // Сохранить конфигурацию
  router.post('/', (req, res) =>
    configController.saveConfig(req, res, storage)
  );

  // Получить информацию о сервере
  router.get('/server-info', (req, res) =>
    configController.getServerInfo(req, res, statsService)
  );

  // Получить статистику сервера
  router.get('/stats', (req, res) =>
    configController.getServerStats(req, res, statsService)
  );

  // Сбросить статистику
  router.post('/stats/reset', (req, res) =>
    configController.resetServerStats(req, res, statsService)
  );

  return router;
}
