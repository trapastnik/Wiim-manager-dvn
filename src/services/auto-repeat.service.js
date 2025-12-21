/**
 * Сервис автоповтора треков
 * Отвечает за автоматический перезапуск треков при их завершении
 */

import { logCategory } from '../utils/logger.js';

// Хранилище состояния плееров для автоповтора
const autoRepeatState = new Map(); // playerId -> { lastUrl, monitoring: true/false, groupId: string|null }
const manualStops = new Set(); // playerId -> была ли ручная команда стоп

/**
 * Запустить мониторинг плеера для автоповтора
 * @param {string} playerId - ID плеера
 * @param {string} fileUrl - URL файла
 * @param {string} groupId - ID группы (опционально)
 * @param {Function} monitorFunc - функция мониторинга
 */
export function startMonitoring(playerId, fileUrl, groupId = null, monitorFunc) {
  logCategory('AUTO-REPEAT', `Starting monitor for player ${playerId}${groupId ? ` (group: ${groupId})` : ''}`);

  autoRepeatState.set(playerId, {
    lastUrl: fileUrl,
    monitoring: true,
    groupId: groupId
  });

  // Начинаем мониторинг через 1 секунду после запуска
  setTimeout(() => monitorFunc(playerId), 1000);
}

/**
 * Остановить мониторинг плеера
 * @param {string} playerId - ID плеера
 */
export function stopMonitoring(playerId) {
  const state = autoRepeatState.get(playerId);
  if (state) {
    state.monitoring = false;
    logCategory('AUTO-REPEAT', `Stopped monitor for player ${playerId}`);
  }
}

/**
 * Получить состояние автоповтора плеера
 * @param {string} playerId - ID плеера
 * @returns {Object|null}
 */
export function getMonitoringState(playerId) {
  return autoRepeatState.get(playerId);
}

/**
 * Проверить, мониторится ли плеер
 * @param {string} playerId - ID плеера
 * @returns {boolean}
 */
export function isMonitoring(playerId) {
  const state = autoRepeatState.get(playerId);
  return state ? state.monitoring : false;
}

/**
 * Отметить плеер как остановленный вручную
 * @param {string} playerId - ID плеера
 */
export function markManualStop(playerId) {
  manualStops.add(playerId);
}

/**
 * Снять отметку ручной остановки
 * @param {string} playerId - ID плеера
 */
export function unmarkManualStop(playerId) {
  manualStops.delete(playerId);
}

/**
 * Проверить, был ли плеер остановлен вручную
 * @param {string} playerId - ID плеера
 * @returns {boolean}
 */
export function isManualStop(playerId) {
  return manualStops.has(playerId);
}

/**
 * Получить все состояния автоповтора
 * @returns {Map}
 */
export function getAllStates() {
  return autoRepeatState;
}

/**
 * Очистить состояние плеера
 * @param {string} playerId - ID плеера
 */
export function clearState(playerId) {
  autoRepeatState.delete(playerId);
  manualStops.delete(playerId);
}

/**
 * Очистить все состояния
 */
export function clearAllStates() {
  autoRepeatState.clear();
  manualStops.clear();
}
