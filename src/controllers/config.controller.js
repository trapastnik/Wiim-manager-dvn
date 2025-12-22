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

export async function syncConfig(req, res, storage) {
  try {
    const { playerSelections, playerGroups, playerVolumes } = req.body;

    // Сохраняем playerSelections и playerGroups
    if (playerSelections !== undefined || playerGroups !== undefined) {
      const currentConfig = storage.getPlaybackConfig();
      const newSelections = playerSelections || currentConfig.playerSelections;
      const newGroups = playerGroups || currentConfig.playerGroups;
      storage.savePlaybackConfig(newSelections, newGroups);
    }

    // Сохраняем playerVolumes
    if (playerVolumes !== undefined) {
      const uiConfig = storage.getUIConfig();
      uiConfig.playerVolumes = { ...uiConfig.playerVolumes, ...playerVolumes };
      storage.saveUIConfig(uiConfig);
    }

    logWithMs('Config synced');
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Ошибка синхронизации конфигурации: ${error.message}`);
    res.status(500).json({ error: 'Ошибка синхронизации конфигурации' });
  }
}

export async function saveLoopModes(req, res, storage) {
  try {
    const { loopModes } = req.body;
    storage.updateLoopModes(loopModes);
    logWithMs('Loop modes saved');
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Ошибка сохранения loop modes: ${error.message}`);
    res.status(500).json({ error: 'Ошибка сохранения loop modes' });
  }
}

export async function saveSettings(req, res, storage) {
  try {
    const settings = req.body;
    storage.updateAppSettings(settings);
    logWithMs('Settings saved');
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Ошибка сохранения настроек: ${error.message}`);
    res.status(500).json({ error: 'Ошибка сохранения настроек' });
  }
}

export async function savePanelWidth(req, res, storage) {
  try {
    const { width } = req.body;
    storage.updateMessagesPanelWidth(width);
    logWithMs(`Panel width saved: ${width}px`);
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Ошибка сохранения ширины панели: ${error.message}`);
    res.status(500).json({ error: 'Ошибка сохранения ширины панели' });
  }
}

export async function saveLoopExperimentalSettings(req, res, storage) {
  try {
    const settings = req.body;
    storage.updateLoopExperimentalSettings(settings);
    logWithMs('Loop experimental settings saved');
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Ошибка сохранения loop experimental settings: ${error.message}`);
    res.status(500).json({ error: 'Ошибка сохранения loop experimental settings' });
  }
}

export async function cleanupBrokenStates(req, res, storage) {
  try {
    const result = storage.cleanupPlaybackState();
    logWithMs(`Cleanup: удалено ${result.removedSelections} selections, ${result.removedGroups} groups`);
    res.json(result);
  } catch (error) {
    logWithMs(`Ошибка очистки битых состояний: ${error.message}`);
    res.status(500).json({ error: 'Ошибка очистки битых состояний' });
  }
}
