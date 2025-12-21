import { appState } from '../state/AppState.js';
import { addMessage } from '../ui/messages.js';
import { renderPlayers } from '../ui/players-ui.js';
import { renderMedia } from '../ui/media-ui.js';
import { renderPlayerGroups } from '../ui/groups-ui.js';

/**
 * Сервис управления демо-режимом
 */

/**
 * Создать демо-данные
 */
function createDemoData() {
  // Создаём 7 виртуальных плееров
  const demoPlayers = [
    { id: 'demo_1', name: 'Гостиная (Левый)', ip: '192.168.0.101', useHttps: true },
    { id: 'demo_2', name: 'Гостиная (Правый)', ip: '192.168.0.102', useHttps: true },
    { id: 'demo_3', name: 'Спальня', ip: '192.168.0.103', useHttps: true },
    { id: 'demo_4', name: 'Кухня', ip: '192.168.0.104', useHttps: true },
    { id: 'demo_5', name: 'Кабинет', ip: '192.168.0.105', useHttps: true },
    { id: 'demo_6', name: 'Ванная', ip: '192.168.0.106', useHttps: true },
    { id: 'demo_7', name: 'Коридор', ip: '192.168.0.107', useHttps: true }
  ];

  // Создаём демо медиа-файлы
  const demoMediaFiles = [
    { id: '1', name: 'Диалог - Вопрос.mp3', filename: 'demo_question.mp3', path: '/media/demo_question.mp3', size: 2457600, mimetype: 'audio/mpeg' },
    { id: '2', name: 'Диалог - Ответ.mp3', filename: 'demo_answer.mp3', path: '/media/demo_answer.mp3', size: 2457600, mimetype: 'audio/mpeg' },
    { id: '3', name: 'Ambient - Спальня.mp3', filename: 'demo_ambient.mp3', path: '/media/demo_ambient.mp3', size: 5242880, mimetype: 'audio/mpeg' },
    { id: '4', name: 'Джаз - Кухня.mp3', filename: 'demo_jazz.mp3', path: '/media/demo_jazz.mp3', size: 4194304, mimetype: 'audio/mpeg' },
    { id: '5', name: 'Классика - Кабинет.mp3', filename: 'demo_classical.mp3', path: '/media/demo_classical.mp3', size: 6291456, mimetype: 'audio/mpeg' }
  ];

  // Создаём демо-статусы (некоторые играют, некоторые нет)
  const playerStatuses = {
    'demo_1': { status: 'play', vol: 65, Title: 'Демо Трек 1', Artist: 'Демо Исполнитель', curpos: 45000, totlen: 180000, essid: 'MyWiFi', RSSI: '-45', _responseTime: 89 },
    'demo_2': { status: 'play', vol: 65, Title: 'Демо Трек 2', Artist: 'Демо Исполнитель', curpos: 45000, totlen: 180000, essid: 'MyWiFi', RSSI: '-47', _responseTime: 92 },
    'demo_3': { status: 'stop', vol: 50, Title: '', Artist: '', curpos: 0, totlen: 0, essid: 'MyWiFi', RSSI: '-52', _responseTime: 105 },
    'demo_4': { status: 'play', vol: 70, Title: 'Джаз Композиция', Artist: 'Jazz Band', curpos: 120000, totlen: 240000, essid: 'MyWiFi', RSSI: '-55', _responseTime: 110 },
    'demo_5': { status: 'stop', vol: 45, Title: '', Artist: '', curpos: 0, totlen: 0, essid: 'MyWiFi', RSSI: '-60', _responseTime: 125 },
    'demo_6': { status: 'stop', vol: 40, Title: '', Artist: '', curpos: 0, totlen: 0, essid: 'MyWiFi', RSSI: '-58', _responseTime: 115 },
    'demo_7': { status: 'stop', vol: 35, Title: '', Artist: '', curpos: 0, totlen: 0, essid: 'MyWiFi', RSSI: '-50', _responseTime: 95 }
  };

  // Присваиваем файлы плеерам
  const playerSelections = {
    'demo_1': '/media/demo_question.mp3',
    'demo_2': '/media/demo_answer.mp3',
    'demo_3': '/media/demo_ambient.mp3',
    'demo_4': '/media/demo_jazz.mp3'
  };

  return {
    demoPlayers,
    demoMediaFiles,
    playerStatuses,
    playerSelections
  };
}

/**
 * Включить демо-режим
 */
export function enableDemoMode() {
  const { demoPlayers, demoMediaFiles, playerStatuses, playerSelections } = createDemoData();

  // Устанавливаем демо-режим в AppState
  appState.enableDemoMode();

  // Сохраняем демо-данные в AppState
  appState.players = demoPlayers;
  appState.mediaFiles = demoMediaFiles;

  // Сохраняем статусы и выбранные файлы
  demoPlayers.forEach(player => {
    if (playerStatuses[player.id]) {
      appState.setPlayerStatus(player.id, playerStatuses[player.id]);
    }
    if (playerSelections[player.id]) {
      appState.setPlayerSelection(player.id, playerSelections[player.id]);
    }
  });

  addMessage('🎭 Демо-режим активирован! Создано 7 виртуальных плееров и 5 медиа-файлов', 'success');
  addMessage('💡 Все функции работают в демо-режиме, но команды не отправляются на реальные устройства', 'info');

  // Обновляем UI
  renderPlayers(demoPlayers);
  renderMedia(demoMediaFiles);
  renderPlayerGroups();

  // Рендерим плееры на главной вкладке (временное решение)
  renderMultiPlayersList(demoPlayers);

  // Обновляем заголовок
  const header = document.querySelector('header h1');
  if (header) {
    header.innerHTML = 'WiiM Control Center <span style="color:#ef4444;font-size:14px;vertical-align:super">ДЕМО</span>';
  }

  // Показываем/скрываем кнопки
  updateDemoButtons(true);
}

/**
 * Выключить демо-режим
 */
export function disableDemoMode() {
  // Останавливаем анимацию
  stopDemoAnimation();

  appState.disableDemoMode();

  addMessage('Демо-режим выключен. Перезагрузите страницу для возврата к реальным данным.', 'info');

  // Восстанавливаем заголовок
  const header = document.querySelector('header h1');
  if (header) {
    header.textContent = 'WiiM Control Center';
  }

  // Показываем/скрываем кнопки
  updateDemoButtons(false);

  // Перезагружаем страницу через 1.5 секунды
  setTimeout(() => location.reload(), 1500);
}

/**
 * Обновить видимость кнопок демо-режима
 */
function updateDemoButtons(isDemoActive) {
  const enableBtn = document.getElementById('enable-demo-btn');
  const disableBtn = document.getElementById('disable-demo-btn');

  if (enableBtn) {
    enableBtn.style.display = isDemoActive ? 'none' : 'inline-block';
  }
  if (disableBtn) {
    disableBtn.style.display = isDemoActive ? 'inline-block' : 'none';
  }
}

/**
 * Проверить, активен ли демо-режим
 */
export function isDemoModeActive() {
  return appState.isDemoModeEnabled();
}

// === АНИМАЦИЯ ПРОГРЕССА В ДЕМО-РЕЖИМЕ ===

let demoAnimationInterval = null;

/**
 * Запустить анимацию прогресса в демо-режиме
 */
export function startDemoAnimation() {
  if (demoAnimationInterval) {
    clearInterval(demoAnimationInterval);
  }
  demoAnimationInterval = setInterval(animateDemoProgress, 1000); // Обновление каждую секунду
  console.log('[DEMO] Анимация прогресса запущена');
}

/**
 * Остановить анимацию прогресса
 */
export function stopDemoAnimation() {
  if (demoAnimationInterval) {
    clearInterval(demoAnimationInterval);
    demoAnimationInterval = null;
    console.log('[DEMO] Анимация прогресса остановлена');
  }
}

/**
 * Анимация прогресса играющих плееров
 */
function animateDemoProgress() {
  if (!appState.isDemoModeEnabled()) {
    stopDemoAnimation();
    return;
  }

  // Обновляем позиции играющих плееров
  appState.players.forEach(player => {
    const status = appState.getPlayerStatus(player.id);
    if (status && status.status === 'play' && status.totlen > 0) {
      // Увеличиваем текущую позицию на 1 секунду
      status.curpos += 1000;

      // Зацикливание при достижении конца
      if (status.curpos >= status.totlen) {
        status.curpos = 0;
      }

      // Обновляем статус в AppState
      appState.setPlayerStatus(player.id, status);

      // Обновляем только прогресс-бар для этого плеера
      updatePlayerProgress(player.id, status);
    }
  });
}

/**
 * Обновление прогресс-бара конкретного плеера без полной перерисовки
 */
function updatePlayerProgress(playerId, status) {
  const playerCard = document.querySelector(`.player-control-card[data-player-id="${playerId}"]`);
  if (!playerCard) return;

  const progressContainer = playerCard.querySelector('.player-progress');
  const progressFill = playerCard.querySelector('.progress-bar-fill');
  const progressTimes = playerCard.querySelectorAll('.progress-time span');

  if (!status || status.totlen === 0) {
    if (progressContainer) progressContainer.style.display = 'none';
    return;
  }

  const curpos = parseInt(status.curpos) || 0;
  const totlen = parseInt(status.totlen) || 0;
  const progress = totlen > 0 ? (curpos / totlen) * 100 : 0;

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (progressFill) {
    progressFill.style.width = progress + '%';
  }

  if (progressTimes.length >= 2) {
    progressTimes[0].textContent = formatTime(curpos);
    progressTimes[1].textContent = formatTime(totlen);
  }
}

/**
 * Рендерить плееры на главной вкладке (multi-players-list)
 * ВРЕМЕННОЕ РЕШЕНИЕ: полная функция renderMultiPlayers будет восстановлена позже
 */
function renderMultiPlayersList(players) {
  const container = document.getElementById('multi-players-list');
  if (!container) return;

  if (!players || players.length === 0) {
    container.innerHTML = '<p class="empty-state">Нет плееров. Добавьте плееры на вкладке "Устройства".</p>';
    return;
  }

  container.innerHTML = players.map(player => {
    const status = appState.getPlayerStatus(player.id) || {};
    const playerState = status.status || 'stop';
    const volume = status.vol !== undefined ? parseInt(status.vol) : 50;
    const trackTitle = status.Title || '';
    const trackArtist = status.Artist || '';
    const currentFile = appState.getPlayerSelection(player.id) || '';

    // Данные о прогрессе
    const curpos = parseInt(status.curpos) || 0;
    const totlen = parseInt(status.totlen) || 0;
    const progress = totlen > 0 ? (curpos / totlen) * 100 : 0;

    const formatTime = (ms) => {
      const seconds = Math.floor(ms / 1000);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatFileSize = (bytes) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const hasTrackInfo = trackTitle && trackTitle !== 'Unknown' && !trackTitle.startsWith('http');

    return `
      <div class="player-control-card ${playerState === 'play' ? 'playing' : 'stopped'}" data-player-id="${player.id}">
        <div class="player-card-header">
          <div class="player-card-title">
            <input type="checkbox" id="group-cb-${player.id}"
                   onchange="togglePlayerSelection('${player.id}')"
                   class="group-checkbox"
                   title="Выбрать для группы">
            ${player.name}
          </div>
          <div class="player-card-status ${playerState}">
            ${playerState === 'play' ? '▶ Играет' : '⏹ Остановлен'}
          </div>
        </div>

        ${playerState === 'play' && totlen > 0 ? `
          <div class="player-progress">
            <div class="progress-bar-container">
              <div class="progress-bar-fill" style="width: ${progress}%"></div>
            </div>
            <div class="progress-time">
              <span>${formatTime(curpos)}</span>
              <span>${formatTime(totlen)}</span>
            </div>
          </div>
        ` : ''}

        ${hasTrackInfo ? `
          <div class="player-card-track">
            <div class="player-track-title">${trackTitle}</div>
            ${trackArtist ? `<div class="player-track-artist">${trackArtist}</div>` : ''}
          </div>
        ` : ''}

        <div class="player-media-select">
          <label>Выберите файл для воспроизведения:</label>
          <select onchange="window.selectMediaForPlayer('${player.id}', this.value)">
            <option value="">— Не выбрано —</option>
            ${appState.mediaFiles.map(file => `
              <option value="${file.path}" ${currentFile === file.path ? 'selected' : ''}>
                ${file.name} (${formatFileSize(file.size)})
              </option>
            `).join('')}
          </select>
        </div>

        <div class="player-card-controls">
          <button class="btn btn-success" onclick="window.playPlayer('${player.id}')" ${!currentFile ? 'disabled' : ''}>
            ▶ Играть
          </button>
          <button class="btn btn-danger" onclick="window.stopPlayer('${player.id}')">
            ⏹ Stop
          </button>
          <button class="btn btn-info btn-small" onclick="window.playBeep('${player.id}')" title="Воспроизвести звуковой сигнал для идентификации плеера">
            🔔 Пищалка
          </button>
        </div>

        <div class="player-volume-control">
          <button class="btn btn-small" onclick="window.adjustVolume('${player.id}', -5)">−</button>
          <input type="range" min="0" max="100" value="${volume}"
                 id="volume-slider-${player.id}"
                 oninput="window.setPlayerVolume('${player.id}', this.value)">
          <span class="player-volume-value" id="volume-value-${player.id}">${volume}</span>
          <button class="btn btn-small" onclick="window.adjustVolume('${player.id}', 5)">+</button>
        </div>
      </div>
    `;
  }).join('');
}
