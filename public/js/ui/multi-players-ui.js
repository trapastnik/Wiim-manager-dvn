/**
 * UI модуль для отображения плееров на главной вкладке (multi-players-list)
 */

import { appState } from '../state/AppState.js';

/**
 * Отрисовать плееры на главной вкладке с полным интерфейсом управления
 */
export function renderMultiPlayers() {
  const container = document.getElementById('multi-players-list');
  if (!container) {
    return;
  }

  const players = appState.getPlayers();
  const mediaFiles = appState.getMediaFiles();

  if (players.length === 0) {
    container.innerHTML = '<p class="empty-state">Нет плееров. Добавьте плееры на вкладке "Устройства".</p>';
    return;
  }

  // Проверяем режим отображения
  const isSimpleMode = appState.getViewMode() === 'simple';

  container.innerHTML = players.map(player => {
    const status = appState.getPlayerStatus(player.id) || {};
    const playerState = status.status || 'stop';
    const volume = status.vol !== undefined ? parseInt(status.vol) : 50;
    const trackTitle = status.Title || '';
    const trackArtist = status.Artist || '';
    const currentFile = appState.getPlayerSelection(player.id) || '';
    const responseTime = status._responseTime || 0;

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

    // Определяем качество соединения
    let pingClass = 'good';
    if (responseTime > 1000) pingClass = 'error';
    else if (responseTime > 500) pingClass = 'warning';

    // Wi-Fi информация
    const ssid = status.essid || 'N/A';
    const rssi = status.RSSI || 'N/A';
    let wifiClass = 'good';
    const rssiNum = parseInt(rssi);
    if (!isNaN(rssiNum)) {
      if (rssiNum < -80) wifiClass = 'error';
      else if (rssiNum < -70) wifiClass = 'warning';
    }

    const hasTrackInfo = trackTitle && trackTitle !== 'Unknown' && !trackTitle.startsWith('http');

    // ПРОСТОЙ РЕЖИМ - минимум информации
    if (isSimpleMode) {
      return `
        <div class="player-control-card simple-mode ${playerState === 'play' ? 'playing' : 'stopped'}" data-player-id="${player.id}">
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
            <label>Файл:</label>
            <select onchange="selectMediaForPlayer('${player.id}', this.value)">
              <option value="">— Не выбрано —</option>
              ${mediaFiles.map(file => `
                <option value="${file.path}" ${currentFile === file.path ? 'selected' : ''}>
                  ${file.name}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="player-card-controls">
            <button class="btn btn-success" onclick="playPlayer('${player.id}')" ${!currentFile ? 'disabled' : ''}>
              ▶ Играть
            </button>
            <button class="btn btn-danger" onclick="stopPlayer('${player.id}')">
              ⏹ Stop
            </button>
          </div>

          <div class="player-volume-control">
            <button class="btn btn-small" onclick="adjustVolume('${player.id}', -5)">−</button>
            <input type="range" min="0" max="100" value="${volume}"
                   id="volume-slider-${player.id}"
                   oninput="setPlayerVolume('${player.id}', this.value)">
            <span class="player-volume-value" id="volume-value-${player.id}">${volume}</span>
            <button class="btn btn-small" onclick="adjustVolume('${player.id}', 5)">+</button>
          </div>
        </div>
      `;
    }

    // РАСШИРЕННЫЙ РЕЖИМ - вся информация
    return `
      <div class="player-control-card ${playerState === 'play' ? 'playing' : 'stopped'}" data-player-id="${player.id}">
        <div class="player-card-header">
          <div class="player-card-title">
            <input type="checkbox" id="group-cb-${player.id}"
                   onchange="togglePlayerSelection('${player.id}')"
                   class="group-checkbox"
                   title="Выбрать для группы">
            ${player.name}
            <span class="player-ping ${pingClass}">${responseTime}ms</span>
          </div>
          <div class="player-card-status ${playerState}">
            ${playerState === 'play' ? '▶ Играет' : '⏹ Остановлен'}
          </div>
        </div>

        <div class="player-wifi-info">
          <span class="wifi-label">📶 Wi-Fi:</span>
          <span class="wifi-ssid">${ssid}</span>
          <span class="wifi-signal ${wifiClass}">${rssi} dBm</span>
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
          <select onchange="selectMediaForPlayer('${player.id}', this.value)">
            <option value="">— Не выбрано —</option>
            ${mediaFiles.map(file => `
              <option value="${file.path}" ${currentFile === file.path ? 'selected' : ''}>
                ${file.name} (${formatFileSize(file.size)})
              </option>
            `).join('')}
          </select>
        </div>

        <div class="player-card-controls">
          <button class="btn btn-success" onclick="playPlayer('${player.id}')" ${!currentFile ? 'disabled' : ''}>
            ▶ Играть
          </button>
          <button class="btn btn-danger" onclick="stopPlayer('${player.id}')">
            ⏹ Stop
          </button>
        </div>

        <div class="player-volume-control">
          <button class="btn btn-small" onclick="adjustVolume('${player.id}', -5)">−</button>
          <input type="range" min="0" max="100" value="${volume}"
                 id="volume-slider-${player.id}"
                 oninput="setPlayerVolume('${player.id}', this.value)">
          <span class="player-volume-value" id="volume-value-${player.id}">${volume}</span>
          <button class="btn btn-small" onclick="adjustVolume('${player.id}', 5)">+</button>
        </div>
      </div>
    `;
  }).join('');
}
