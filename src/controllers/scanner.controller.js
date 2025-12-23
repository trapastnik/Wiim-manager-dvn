import { logWithMs } from '../utils/logger.js';
import * as scanProgressService from '../services/scan-progress.service.js';

/**
 * Контроллер для сканирования сети
 */

export async function scanNetwork(req, res, networkScanner, storage) {
  try {
    logWithMs('Запуск сканирования сети...');

    // Запускаем сканирование с callback для прогресса
    scanProgressService.startScan();

    const devices = await networkScanner.quickScan((progress) => {
      scanProgressService.updateProgress(progress);
    });

    scanProgressService.completeScan(devices);
    logWithMs(`Найдено устройств: ${devices.length}`);

    // Автоматически сохраняем найденные плееры
    if (devices.length > 0 && storage) {
      const existingPlayers = await storage.getPlayers();
      const existingIPs = new Set(existingPlayers.map(p => p.ip));

      for (const device of devices) {
        // Добавляем только новые плееры (проверка по IP)
        if (!existingIPs.has(device.ip)) {
          const playerName = device.data?.DeviceName || `WiiM-${device.ip.split('.').pop()}`;
          await storage.addPlayer({
            ip: device.ip,
            name: playerName
          });
          logWithMs(`Добавлен новый плеер: ${playerName} (${device.ip})`);
        }
      }

      // Сохраняем изменения
      await storage.save();
    }

    res.json(devices);
  } catch (error) {
    scanProgressService.resetProgress();
    logWithMs(`Ошибка сканирования сети: ${error.message}`);
    res.status(500).json({ error: 'Ошибка сканирования сети' });
  }
}

export async function getScanProgress(req, res) {
  try {
    const progress = scanProgressService.getProgress();
    res.json(progress);
  } catch (error) {
    logWithMs(`Ошибка получения прогресса: ${error.message}`);
    res.status(500).json({ error: 'Ошибка получения прогресса' });
  }
}
