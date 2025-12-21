/**
 * UI модуль для управления плеерами
 */

import { appState } from '../state/AppState.js';
import { addMessage } from './messages.js';
import * as PlayersAPI from '../api/players-api.js';
import { getElement, setHTML, showElement, hideElement, getInputValue, setInputValue } from '../utils/dom.js';

/**
 * Загрузить и отобразить список плееров
 */
export async function loadPlayers() {
  try {
    const { players } = await PlayersAPI.getPlayers();
    appState.setPlayers(players || []);
    renderPlayers(players || []);

    // Также обновляем главную вкладку с плеерами
    if (window.renderMultiPlayers) {
      window.renderMultiPlayers();
    }
  } catch (error) {
    addMessage(`Ошибка загрузки плееров: ${error.message}`, 'error');
  }
}

/**
 * Отрисовать список плееров
 * @param {Array} players - массив плееров
 */
export function renderPlayers(players) {
  const container = getElement('players-list');
  if (!container) return;

  if (players.length === 0) {
    setHTML('players-list', '<p class="empty-state">Нет плееров. Используйте сканер или добавьте вручную.</p>');
    return;
  }

  const html = players.map(player => `
    <div class="player-card" data-id="${player.id}">
      <div class="player-info-card">
        <div class="name">${player.name}</div>
        <div class="ip">${player.ip}</div>
      </div>
      <div class="player-actions">
        <button class="btn btn-danger" onclick="removePlayer('${player.id}')">Удалить</button>
      </div>
    </div>
  `).join('');

  setHTML('players-list', html);
}

/**
 * Сканировать сеть для поиска плееров
 */
export async function scanPlayers() {
  const modal = getElement('scan-modal');
  if (!modal) return;

  modal.classList.add('active');

  const progressFill = getElement('progress-fill');
  const scanStatus = getElement('scan-status');
  const scanResults = getElement('scan-results');
  const scanResultsList = getElement('scan-results-list');
  const closeBtn = getElement('scan-close-btn');

  // Сброс состояния
  if (progressFill) {
    progressFill.style.width = '0%';
    progressFill.style.background = 'linear-gradient(90deg, #667eea, #764ba2)';
  }
  if (scanStatus) scanStatus.textContent = 'Подготовка к сканированию...';
  if (scanResults) scanResults.style.display = 'none';
  if (scanResultsList) scanResultsList.innerHTML = '';
  if (closeBtn) closeBtn.disabled = true;

  addMessage('Запуск сканирования сети...', 'info');

  let progressInterval;

  try {
    // Запускаем сканирование в фоне (не ждём)
    const scanPromise = PlayersAPI.scanPlayers();

    // Начинаем опрос прогресса каждые 500ms
    progressInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/scanner/progress');
        const progress = await response.json();

        if (progressFill) {
          progressFill.style.width = progress.progress + '%';
        }

        if (scanStatus) {
          if (progress.isScanning) {
            scanStatus.textContent = `Сканирование ${progress.currentIP} (${progress.current}/${progress.total}) — Найдено: ${progress.found}`;
          } else {
            scanStatus.textContent = `Сканирование завершено — Найдено: ${progress.found}`;
          }
        }
      } catch (err) {
        console.error('Ошибка получения прогресса:', err);
      }
    }, 500);

    const startTime = Date.now();
    const result = await scanPromise;

    // Останавливаем опрос
    clearInterval(progressInterval);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Прогресс 95%
    if (progressFill) progressFill.style.width = '95%';
    if (scanStatus) scanStatus.textContent = 'Обработка результатов...';

    // Прогресс 100%
    if (progressFill) progressFill.style.width = '100%';

    if (result.found > 0) {
      const scannedSubnet = result.subnet || 'локальной';
      if (scanStatus) {
        scanStatus.textContent = `Сканирование завершено за ${elapsed}с! Найдено устройств: ${result.found}`;
      }
      addMessage(`Найдено устройств: ${result.found} в сети ${scannedSubnet}.0/24 за ${elapsed}с`, 'success');

      // Показываем результаты
      if (scanResults) scanResults.style.display = 'block';
      if (scanResultsList) {
        const devicesHtml = result.devices.map(device => {
          const deviceName = device.data?.DeviceName || 'WiiM Player';
          return `
            <div class="scan-result-item">
              <div class="info">
                <div class="ip">📡 ${device.ip}</div>
                <div class="status-text">✓ ${deviceName}</div>
              </div>
            </div>
          `;
        }).join('');
        scanResultsList.innerHTML = devicesHtml;
      }
    } else {
      if (scanStatus) {
        scanStatus.textContent = `Сканирование завершено за ${elapsed}с. Устройства не найдены.`;
      }
      addMessage('WiiM устройства не найдены', 'warning');
      if (scanResults) scanResults.style.display = 'block';
      const scannedSubnet = result.subnet || 'локальной';
      if (scanResultsList) {
        scanResultsList.innerHTML = `<p style="text-align:center; color:#6b7280; padding:20px;">❌ Не найдено WiiM устройств в сети ${scannedSubnet}.0/24<br><br>Убедитесь что:<br>• WiiM плеер включен<br>• Подключен к той же Wi-Fi сети<br>• Используется правильная подсеть</p>`;
      }
    }

    // Обновляем список плееров
    setTimeout(() => loadPlayers(), 500);

  } catch (error) {
    if (progressInterval) clearInterval(progressInterval);
    if (progressFill) {
      progressFill.style.width = '100%';
      progressFill.style.background = '#ef4444';
    }
    if (scanStatus) scanStatus.textContent = `Ошибка: ${error.message}`;
    addMessage(`Ошибка сканирования: ${error.message}`, 'error');
  } finally {
    if (closeBtn) closeBtn.disabled = false;
  }
}

/**
 * Закрыть модальное окно сканирования
 */
export function closeScanModal() {
  const modal = getElement('scan-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * Показать форму добавления плеера
 */
export function showAddPlayer() {
  showElement('add-player-form');
}

/**
 * Скрыть форму добавления плеера
 */
export function hideAddPlayer() {
  hideElement('add-player-form');
  setInputValue('player-ip', '');
  setInputValue('player-name', '');
}

/**
 * Добавить плеер вручную
 */
export async function addPlayerManual() {
  const ip = getInputValue('player-ip');
  const name = getInputValue('player-name');

  if (!ip) {
    alert('Введите IP адрес');
    return;
  }

  try {
    await PlayersAPI.addPlayer(ip, name);
    addMessage(`Плеер ${name || ip} добавлен`, 'success');
    hideAddPlayer();
    await loadPlayers();
  } catch (error) {
    addMessage(`Ошибка добавления плеера: ${error.message}`, 'error');
  }
}

/**
 * Активировать плеер
 * @param {string} playerId - ID плеера
 */
export async function activatePlayer(playerId) {
  try {
    await PlayersAPI.activatePlayer(playerId);
    addMessage('Плеер активирован', 'success');
  } catch (error) {
    addMessage(`Ошибка активации: ${error.message}`, 'error');
  }
}

/**
 * Удалить плеер
 * @param {string} playerId - ID плеера
 */
export async function removePlayer(playerId) {
  if (!confirm('Удалить этот плеер?')) return;

  try {
    await PlayersAPI.removePlayer(playerId);
    addMessage('Плеер удален', 'success');
    await loadPlayers();
  } catch (error) {
    addMessage(`Ошибка удаления: ${error.message}`, 'error');
  }
}

/**
 * Получить имя плеера по ID
 * @param {string} playerId - ID плеера
 * @returns {string} - имя плеера
 */
export function getPlayerName(playerId) {
  const players = appState.getPlayers();
  const player = players.find(p => p.id === playerId);
  return player ? player.name : playerId;
}
