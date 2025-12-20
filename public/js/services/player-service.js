/**
 * Сервис для управления плеерами
 * Содержит бизнес-логику работы с плеерами
 */

import { appState } from '../state/AppState.js';
import { addMessage } from '../ui/messages.js';
import * as PlayersAPI from '../api/players-api.js';

/**
 * Воспроизвести файл на всех плеерах
 * @param {string} fileUrl - URL файла
 */
export async function playMediaOnAllPlayers(fileUrl) {
  const players = appState.getPlayers();

  if (players.length === 0) {
    addMessage('Нет доступных плееров', 'warning');
    return;
  }

  addMessage(`Запуск на ${players.length} плеерах...`, 'info');

  const results = await Promise.allSettled(
    players.map(player => PlayersAPI.playMedia(player.id, fileUrl))
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  if (successful > 0) {
    addMessage(`Запущено на ${successful} плеерах`, 'success');
  }
  if (failed > 0) {
    addMessage(`Ошибка на ${failed} плеерах`, 'error');
  }
}

/**
 * Остановить все плееры
 */
export async function stopAll() {
  const players = appState.getPlayers();

  if (players.length === 0) {
    addMessage('Нет плееров', 'warning');
    return;
  }

  addMessage('Остановка всех плееров...', 'info');

  await Promise.allSettled(
    players.map(player => PlayersAPI.stopPlayer(player.id))
  );

  addMessage('Все плееры остановлены', 'success');
}

/**
 * Запустить все плееры
 */
export async function playAll() {
  const players = appState.getPlayers();

  if (players.length === 0) {
    addMessage('Нет плееров', 'warning');
    return;
  }

  // Проверяем что у плееров выбраны файлы
  const playersWithSelection = players.filter(p => appState.getPlayerSelection(p.id));

  if (playersWithSelection.length === 0) {
    addMessage('Выберите файлы для воспроизведения', 'warning');
    return;
  }

  addMessage(`Запуск ${playersWithSelection.length} плееров...`, 'info');

  const results = await Promise.allSettled(
    playersWithSelection.map(player => {
      const fileUrl = appState.getPlayerSelection(player.id);
      return PlayersAPI.playMedia(player.id, fileUrl);
    })
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  addMessage(`Запущено: ${successful} плееров`, 'success');
}

/**
 * Обновить статус всех плееров
 */
export async function refreshAllPlayers() {
  const players = appState.getPlayers();

  if (players.length === 0) {
    return;
  }

  const statuses = await Promise.allSettled(
    players.map(async (player) => {
      const status = await PlayersAPI.getPlayerStatus(player.id);
      return { playerId: player.id, status };
    })
  );

  statuses.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      const { playerId, status } = result.value;
      appState.setPlayerStatus(playerId, status);
    }
  });
}

/**
 * Воспроизвести звуковой сигнал на плеере
 * @param {string} playerId - ID плеера
 * @param {string} soundFile - файл звука (опционально)
 */
export async function playBeep(playerId, soundFile = null) {
  try {
    await PlayersAPI.playBeep(playerId, soundFile);
    addMessage('Сигнал отправлен', 'success');
  } catch (error) {
    addMessage(`Ошибка отправки сигнала: ${error.message}`, 'error');
  }
}

/**
 * Установить громкость для плеера
 * @param {string} playerId - ID плеера
 * @param {number} volume - уровень громкости (0-100)
 */
export async function setVolume(playerId, volume) {
  try {
    await PlayersAPI.setVolume(playerId, volume);
    appState.setPlayerVolume(playerId, volume);
  } catch (error) {
    addMessage(`Ошибка установки громкости: ${error.message}`, 'error');
  }
}

/**
 * Установить режим повтора для плеера
 * @param {string} playerId - ID плеера
 * @param {number} mode - режим (0=off, 1=loop)
 */
export async function setLoopMode(playerId, mode) {
  try {
    await PlayersAPI.setLoopMode(playerId, mode);
    appState.setPlayerLoopMode(playerId, mode);
    addMessage(`Режим повтора: ${mode === 1 ? 'включен' : 'выключен'}`, 'success');
  } catch (error) {
    addMessage(`Ошибка установки режима: ${error.message}`, 'error');
  }
}
