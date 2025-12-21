/**
 * API для работы с плеерами
 */

import { get, post, del } from './base-api.js';

/**
 * Получить список всех плееров
 * @returns {Promise<{players: Array}>}
 */
export async function getPlayers() {
  return await get('/api/players');
}

/**
 * Сканировать сеть для поиска плееров
 * @param {string} subnet - подсеть для сканирования (опционально)
 * @returns {Promise<Array>}
 */
export async function scanPlayers(subnet = null) {
  return await post('/api/scanner/scan', subnet ? { subnet } : {});
}

/**
 * Добавить плеер вручную
 * @param {string} ip - IP адрес плеера
 * @param {string} name - имя плеера (опционально)
 * @returns {Promise<{success: boolean, player: Object}>}
 */
export async function addPlayer(ip, name = '') {
  return await post('/api/players', { ip, name });
}

/**
 * Удалить плеер
 * @param {string} playerId - ID плеера
 * @returns {Promise<{success: boolean}>}
 */
export async function removePlayer(playerId) {
  return await del(`/api/players/${playerId}`);
}

/**
 * Активировать плеер
 * @param {string} playerId - ID плеера
 * @returns {Promise<{success: boolean}>}
 */
export async function activatePlayer(playerId) {
  return await post(`/api/players/${playerId}/activate`);
}

/**
 * Получить статус плеера
 * @param {string} playerId - ID плеера
 * @returns {Promise<Object>}
 */
export async function getPlayerStatus(playerId) {
  return await get(`/api/players/${playerId}/status`);
}

/**
 * Воспроизвести медиа на плеере
 * @param {string} playerId - ID плеера
 * @param {string} fileUrl - URL медиа файла
 * @returns {Promise<{success: boolean}>}
 */
export async function playMedia(playerId, fileUrl) {
  return await post(`/api/players/${playerId}/play`, { fileUrl });
}

/**
 * Пауза воспроизведения
 * @param {string} playerId - ID плеера
 * @returns {Promise<{success: boolean}>}
 */
export async function pausePlayer(playerId) {
  return await post(`/api/players/${playerId}/pause`);
}

/**
 * Остановить воспроизведение
 * @param {string} playerId - ID плеера
 * @returns {Promise<{success: boolean}>}
 */
export async function stopPlayer(playerId) {
  return await post(`/api/players/${playerId}/stop`);
}

/**
 * Изменить громкость
 * @param {string} playerId - ID плеера
 * @param {number} volume - уровень громкости (0-100)
 * @returns {Promise<{success: boolean}>}
 */
export async function setVolume(playerId, volume) {
  return await post(`/api/players/${playerId}/volume`, { volume });
}

/**
 * Включить/выключить режим повтора
 * @param {string} playerId - ID плеера
 * @param {number} mode - режим (0=off, 1=single loop)
 * @returns {Promise<{success: boolean}>}
 */
export async function setLoopMode(playerId, mode) {
  return await post(`/api/players/${playerId}/loopmode`, { mode });
}

/**
 * Проиграть звуковой сигнал на плеере
 * @param {string} playerId - ID плеера
 * @param {string} soundFile - файл звука (опционально)
 * @returns {Promise<{success: boolean}>}
 */
export async function playBeep(playerId, soundFile = null) {
  return await post(`/api/players/${playerId}/beep`, soundFile ? { soundFile } : {});
}
