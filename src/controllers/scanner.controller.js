import { logWithMs } from '../utils/logger.js';
import * as scanProgressService from '../services/scan-progress.service.js';

/**
 * Контроллер для сканирования сети
 */

export async function scanNetwork(req, res, networkScanner) {
  try {
    logWithMs('Запуск сканирования сети...');

    // Запускаем сканирование с callback для прогресса
    scanProgressService.startScan();

    const devices = await networkScanner.quickScan((progress) => {
      scanProgressService.updateProgress(progress);
    });

    scanProgressService.completeScan(devices);
    logWithMs(`Найдено устройств: ${devices.length}`);
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
