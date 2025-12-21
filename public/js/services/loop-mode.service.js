/**
 * Сервис управления режимами Loop Mode
 */

import { appState } from '../state/AppState.js';
import { addMessage } from '../ui/messages.js';
import * as PlayersAPI from '../api/players-api.js';
import * as ConfigSync from './config-sync.service.js';

/**
 * Установить WiiM Native Loop для всех плееров
 * @param {number} mode - режим (0=off, 2=repeat all)
 */
export async function setNativeLoopForAll(mode) {
  const players = appState.getPlayers();

  if (players.length === 0) {
    addMessage('Нет плееров', 'warning');
    return;
  }

  addMessage(`Установка Native Loop Mode (${mode === 2 ? 'ON' : 'OFF'}) для ${players.length} плееров...`, 'info');

  try {
    // Устанавливаем режим для всех плееров параллельно
    await Promise.all(
      players.map(async player => {
        await PlayersAPI.setLoopMode(player.id, mode);
        appState.setPlayerLoopMode(player.id, mode);
      })
    );

    // Сохраняем настройки
    ConfigSync.saveLoopModes();

    const status = mode === 2 ? 'ВКЛЮЧЕН' : 'ВЫКЛЮЧЕН';
    addMessage(`✓ WiiM Native Loop ${status} для всех плееров`, 'success');
    console.log(`[LOOP-NATIVE] Установлен режим ${mode} для всех плееров`);

    // Обновляем UI
    updateLoopModeUI();
  } catch (error) {
    addMessage(`Ошибка установки Loop Mode: ${error.message}`, 'error');
  }
}

/**
 * Получить текущее состояние Native Loop
 * @returns {boolean} true если включен для всех плееров
 */
export function getNativeLoopState() {
  const players = appState.getPlayers();

  if (players.length === 0) return false;

  // Проверяем все ли плееры имеют mode = 2
  const allInLoopMode = players.every(player => {
    const mode = appState.getPlayerLoopMode(player.id);
    return mode === 2;
  });

  return allInLoopMode;
}

/**
 * Обновить UI кнопок Loop Mode
 */
export function updateLoopModeUI() {
  const nativeBtn = document.getElementById('native-loop-btn');

  if (!nativeBtn) return;

  const isActive = getNativeLoopState();

  if (isActive) {
    nativeBtn.textContent = '🔁 Native Loop: ON';
    nativeBtn.classList.remove('btn-secondary');
    nativeBtn.classList.add('btn-success');
  } else {
    nativeBtn.textContent = '🔁 Native Loop: OFF';
    nativeBtn.classList.remove('btn-success');
    nativeBtn.classList.add('btn-secondary');
  }
}

/**
 * Переключить Native Loop Mode
 */
export async function toggleNativeLoop() {
  const currentState = getNativeLoopState();
  const newMode = currentState ? 0 : 2;

  await setNativeLoopForAll(newMode);
}
