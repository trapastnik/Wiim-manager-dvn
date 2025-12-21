import { logWithMs } from '../utils/logger.js';

/**
 * Контроллер для сканирования сети
 */

export async function scanNetwork(req, res, networkScanner) {
  try {
    logWithMs('Запуск сканирования сети...');
    const devices = await networkScanner.scan();
    logWithMs(`Найдено устройств: ${devices.length}`);
    res.json(devices);
  } catch (error) {
    logWithMs(`Ошибка сканирования сети: ${error.message}`);
    res.status(500).json({ error: 'Ошибка сканирования сети' });
  }
}
