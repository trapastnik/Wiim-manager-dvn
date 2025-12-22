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

  // Синхронизация конфигурации (playerSelections, groups, volumes)
  router.post('/sync', (req, res) =>
    configController.syncConfig(req, res, storage)
  );

  // Сохранить loop modes
  router.post('/loop-modes', (req, res) =>
    configController.saveLoopModes(req, res, storage)
  );

  // Сохранить настройки приложения
  router.post('/settings', (req, res) =>
    configController.saveSettings(req, res, storage)
  );

  // Сохранить ширину панели
  router.post('/panel-width', (req, res) =>
    configController.savePanelWidth(req, res, storage)
  );

  // Сохранить экспериментальные настройки loop
  router.post('/loop-experimental', (req, res) =>
    configController.saveLoopExperimentalSettings(req, res, storage)
  );

  // Очистка битых состояний
  router.post('/cleanup', (req, res) =>
    configController.cleanupBrokenStates(req, res, storage)
  );

  return router;
}
