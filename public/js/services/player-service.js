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

/**
 * Воспроизвести файл на плеере
 * @param {string} playerId - ID плеера
 */
export async function playPlayer(playerId) {
  // В демо-режиме не отправляем команды
  if (appState.isDemoModeEnabled()) {
    addMessage(`[ДЕМО] Воспроизведение на ${playerId}`, 'info');
    return;
  }

  try {
    const fileUrl = appState.getPlayerSelection(playerId);
    if (!fileUrl) {
      addMessage('Выберите файл для воспроизведения', 'warning');
      return;
    }
    await PlayersAPI.playMedia(playerId, fileUrl);
    addMessage('Воспроизведение начато', 'success');
  } catch (error) {
    addMessage(`Ошибка воспроизведения: ${error.message}`, 'error');
  }
}

/**
 * Остановить плеер
 * @param {string} playerId - ID плеера
 */
export async function stopPlayer(playerId) {
  // В демо-режиме не отправляем команды
  if (appState.isDemoModeEnabled()) {
    addMessage(`[ДЕМО] Остановка ${playerId}`, 'info');
    return;
  }

  try {
    await PlayersAPI.stopPlayer(playerId);
    addMessage('Плеер остановлен', 'success');
  } catch (error) {
    addMessage(`Ошибка остановки: ${error.message}`, 'error');
  }
}

/**
 * Выбрать медиа-файл для плеера
 * @param {string} playerId - ID плеера
 * @param {string} fileUrl - URL файла
 */
export function selectMediaForPlayer(playerId, fileUrl) {
  appState.setPlayerSelection(playerId, fileUrl);
  addMessage(`Файл выбран для плеера`, 'success');
}

/**
 * Установить громкость плеера (с обновлением UI)
 * @param {string} playerId - ID плеера
 * @param {number} volume - уровень громкости
 */
export async function setPlayerVolume(playerId, volume) {
  // В демо-режиме не отправляем команды
  if (appState.isDemoModeEnabled()) {
    appState.setPlayerVolume(playerId, volume);
    const volumeDisplay = document.getElementById(`volume-value-${playerId}`);
    if (volumeDisplay) volumeDisplay.textContent = volume;
    return;
  }

  try {
    await PlayersAPI.setVolume(playerId, volume);
    appState.setPlayerVolume(playerId, volume);
    const volumeDisplay = document.getElementById(`volume-value-${playerId}`);
    if (volumeDisplay) volumeDisplay.textContent = volume;
  } catch (error) {
    addMessage(`Ошибка установки громкости: ${error.message}`, 'error');
  }
}

/**
 * Изменить громкость на указанное значение
 * @param {string} playerId - ID плеера
 * @param {number} delta - изменение громкости (+/-)
 */
export async function adjustVolume(playerId, delta) {
  const status = appState.getPlayerStatus(playerId);
  const currentVolume = status?.vol !== undefined ? parseInt(status.vol) : 50;
  const newVolume = Math.max(0, Math.min(100, currentVolume + delta));

  await setPlayerVolume(playerId, newVolume);

  // Обновляем слайдер
  const slider = document.getElementById(`volume-slider-${playerId}`);
  if (slider) slider.value = newVolume;
}
