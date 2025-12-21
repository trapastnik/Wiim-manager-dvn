import { logWithMs } from '../utils/logger.js';

/**
 * Контроллер для управления конфигурацией
 */

export async function getConfig(req, res, storage) {
  try {
    const config = await storage.getConfig();
    res.json(config);
  } catch (error) {
    logWithMs(`Ошибка получения конфигурации: ${error.message}`);
    res.status(500).json({ error: 'Ошибка получения конфигурации' });
  }
}

export async function saveConfig(req, res, storage) {
  try {
    const config = req.body;
    await storage.saveConfig(config);
    logWithMs('Конфигурация сохранена');
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Ошибка сохранения конфигурации: ${error.message}`);
    res.status(500).json({ error: 'Ошибка сохранения конфигурации' });
  }
}

export async function getServerInfo(req, res, statsService) {
  try {
    const info = {
      version: '2.0.0',
      platform: process.platform,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      stats: statsService.getStats()
    };
    res.json(info);
  } catch (error) {
    logWithMs(`Ошибка получения информации о сервере: ${error.message}`);
    res.status(500).json({ error: 'Ошибка получения информации' });
  }
}

export async function getServerStats(req, res, statsService) {
  try {
    const stats = statsService.getStats();
    res.json(stats);
  } catch (error) {
    logWithMs(`Ошибка получения статистики: ${error.message}`);
    res.status(500).json({ error: 'Ошибка получения статистики' });
  }
}

export async function resetServerStats(req, res, statsService) {
  try {
    statsService.resetStats();
    logWithMs('Статистика сброшена');
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Ошибка сброса статистики: ${error.message}`);
    res.status(500).json({ error: 'Ошибка сброса статистики' });
  }
}
