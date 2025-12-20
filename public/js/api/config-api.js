/**
 * API для работы с конфигурацией
 */

import { get, post } from './base-api.js';

/**
 * Получить всю конфигурацию
 * @returns {Promise<Object>}
 */
export async function getConfig() {
  return await get('/api/config');
}

/**
 * Сохранить режимы повтора для плееров
 * @param {Object} loopModes - объект с режимами повтора {playerId: mode}
 * @returns {Promise<{success: boolean}>}
 */
export async function saveLoopModes(loopModes) {
  return await post('/api/config/loop-modes', { loopModes });
}

/**
 * Сохранить настройки приложения
 * @param {Object} settings - объект с настройками
 * @returns {Promise<{success: boolean}>}
 */
export async function saveSettings(settings) {
  return await post('/api/config/settings', settings);
}

/**
 * Сохранить ширину панели
 * @param {number} width - ширина в пикселях
 * @returns {Promise<{success: boolean}>}
 */
export async function savePanelWidth(width) {
  return await post('/api/config/panel-width', { width });
}

/**
 * Сохранить экспериментальные настройки Loop режима
 * @param {Object} settings - настройки
 * @returns {Promise<{success: boolean}>}
 */
export async function saveLoopExperimentalSettings(settings) {
  return await post('/api/config/loop-experimental', settings);
}

/**
 * Очистить сломанные состояния
 * @returns {Promise<{success: boolean}>}
 */
export async function cleanupBrokenStates() {
  return await post('/api/config/cleanup');
}

/**
 * Синхронизировать конфигурацию
 * @returns {Promise<{success: boolean}>}
 */
export async function syncConfig() {
  return await post('/api/config/sync');
}

/**
 * Получить информацию о сервере
 * @returns {Promise<Object>}
 */
export async function getServerInfo() {
  return await get('/api/server-info');
}

/**
 * Получить статистику сервера
 * @returns {Promise<Object>}
 */
export async function getServerStats() {
  return await get('/api/stats');
}
