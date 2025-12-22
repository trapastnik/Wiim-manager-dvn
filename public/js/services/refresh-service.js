/**
 * Сервис автообновления статусов плееров
 */

import { appState } from '../state/AppState.js';
import { refreshAllPlayers } from './player-service.js';

/**
 * Запустить адаптивное автообновление
 * Обновляет чаще когда плееры играют, реже когда стоят
 */
export function startAdaptiveRefresh() {
  // Останавливаем предыдущий таймер если есть
  stopAdaptiveRefresh();

  const checkAndRefresh = async () => {
    await refreshAllPlayers();

    // Проверяем играет ли хоть один плеер
    const players = appState.getPlayers();
    const isPlaying = players.some(player => {
      const status = appState.getPlayerStatus(player.id);
      return status?.status === 'play';
    });

    appState.isAnyPlayerPlaying = isPlaying;

    // Устанавливаем интервал: 2 сек если играет, 10 сек если нет
    const interval = isPlaying ? 2000 : 10000;

    appState.adaptiveRefreshTimer = setTimeout(checkAndRefresh, interval);
  };

  checkAndRefresh();
}

/**
 * Остановить адаптивное автообновление
 */
export function stopAdaptiveRefresh() {
  if (appState.adaptiveRefreshTimer) {
    clearTimeout(appState.adaptiveRefreshTimer);
    appState.adaptiveRefreshTimer = null;
  }
}

/**
 * Запустить временное автообновление (N раз)
 * @param {number} count - количество обновлений
 */
export function startTemporaryAutoRefresh(count = 10) {
  stopAdaptiveRefresh();

  appState.autoRefreshCount = 0;

  const refresh = async () => {
    if (appState.autoRefreshCount >= count) {
      startAdaptiveRefresh();
      return;
    }

    await refreshAllPlayers();
    appState.autoRefreshCount++;

    appState.autoRefreshTimer = setTimeout(refresh, 1000);
  };

  refresh();
}

/**
 * Проверить и обновить адаптивное обновление
 */
export function checkAndUpdateAdaptiveRefresh() {
  // Если таймер не запущен, запускаем
  if (!appState.adaptiveRefreshTimer) {
    startAdaptiveRefresh();
  }
}
