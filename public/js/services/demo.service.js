import { appState } from '../state/AppState.js';
import { addMessage } from '../ui/messages.js';
import { renderPlayers } from '../ui/players-ui.js';
import { renderMultiPlayers } from '../ui/multi-players-ui.js';
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
  console.log('[DEMO] enableDemoMode() вызвана!');

  const { demoPlayers, demoMediaFiles, playerStatuses, playerSelections } = createDemoData();
  console.log('[DEMO] Создано плееров:', demoPlayers.length);
  console.log('[DEMO] Создано медиа:', demoMediaFiles.length);

  // Устанавливаем демо-режим в AppState
  appState.enableDemoMode();

  // Сохраняем демо-данные в AppState (используем методы, а не прямое присваивание!)
  appState.setPlayers(demoPlayers);
  appState.setMediaFiles(demoMediaFiles);

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

  // Рендерим плееры на главной вкладке
  renderMultiPlayers();

  console.log('[DEMO] Плееры в AppState:', appState.getPlayers());
  console.log('[DEMO] Медиа в AppState:', appState.getMediaFiles());

  // Обновляем заголовок
  const header = document.querySelector('header h1');
  if (header) {
    header.innerHTML = 'WiiM Control Center <span style="color:#ef4444;font-size:14px;vertical-align:super">ДЕМО</span>';
  }

  // Показываем/скрываем кнопки
  updateDemoButtons(true);

  // Запускаем анимацию прогресса (вызывается автоматически из HTML, но на всякий случай)
  startDemoAnimation();
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

  // Обновляем позиции играющих плееров (используем геттер!)
  const players = appState.getPlayers();
  players.forEach(player => {
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
