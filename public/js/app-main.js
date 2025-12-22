/**
 * Главный модуль приложения (новая модульная версия)
 * Импортирует все модули и инициализирует приложение
 */

// === ИМПОРТЫ ===

// State Management
import { appState } from './state/AppState.js';

// UI Modules
import { addMessage, clearMessages } from './ui/messages.js';
import { switchTab } from './ui/tabs.js';
import * as PlayersUI from './ui/players-ui.js';
import * as MultiPlayersUI from './ui/multi-players-ui.js';
import * as MediaUI from './ui/media-ui.js';
import * as GroupsUI from './ui/groups-ui.js';

// API Modules
import * as PlayersAPI from './api/players-api.js';
import * as MediaAPI from './api/media-api.js';
import * as ConfigAPI from './api/config-api.js';

// Services
import * as PlayerService from './services/player-service.js';
import * as RefreshService from './services/refresh-service.js';
import * as ViewModeService from './services/view-mode.service.js';
import * as DemoService from './services/demo.service.js';
import * as ConfigSync from './services/config-sync.service.js';
import * as LoopModeService from './services/loop-mode.service.js';

// Utils
import { formatFileSize, formatTime, formatTimestamp, formatUptime } from './utils/format.js';
import * as DOM from './utils/dom.js';

// === ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ ДЛЯ СОВМЕСТИМОСТИ С HTML ===
// Это позволяет использовать функции в onclick обработчиках

// State
window.appState = appState;

// UI - Messages & Tabs
window.addMessage = addMessage;
window.clearMessages = clearMessages;
window.switchTab = switchTab;

// UI - Players
window.loadPlayers = PlayersUI.loadPlayers;
window.renderPlayers = PlayersUI.renderPlayers;
window.renderMultiPlayers = MultiPlayersUI.renderMultiPlayers;
window.scanPlayers = PlayersUI.scanPlayers;
window.closeScanModal = PlayersUI.closeScanModal;
window.showAddPlayer = PlayersUI.showAddPlayer;
window.hideAddPlayer = PlayersUI.hideAddPlayer;
window.addPlayerManual = PlayersUI.addPlayerManual;
window.activatePlayer = PlayersUI.activatePlayer;
window.removePlayer = PlayersUI.removePlayer;
window.getPlayerName = PlayersUI.getPlayerName;

// UI - Media
window.loadMedia = MediaUI.loadMedia;
window.renderMedia = MediaUI.renderMedia;
window.uploadFile = MediaUI.uploadFile;
window.deleteMediaFile = MediaUI.deleteMediaFile;
window.playMediaFile = MediaUI.playMediaFile;
window.handleFileSelect = MediaUI.handleFileSelect;

// UI - Groups
window.togglePlayerSelection = GroupsUI.togglePlayerSelection;
window.updateGroupSelectionUI = GroupsUI.updateGroupSelectionUI;
window.createPlayerGroup = GroupsUI.createPlayerGroup;
window.clearPlayerSelection = GroupsUI.clearPlayerSelection;
window.deletePlayerGroup = GroupsUI.deletePlayerGroup;
window.playGroup = GroupsUI.playGroup;
window.renderPlayerGroups = GroupsUI.renderPlayerGroups;
window.loadPlayerGroups = GroupsUI.loadPlayerGroups;

// Services - Player
window.playMediaOnAllPlayers = PlayerService.playMediaOnAllPlayers;
window.stopAll = PlayerService.stopAll;
window.playAll = PlayerService.playAll;
window.refreshAllPlayers = PlayerService.refreshAllPlayers;
window.setLoopMode = PlayerService.setLoopMode;
window.playPlayer = PlayerService.playPlayer;
window.stopPlayer = PlayerService.stopPlayer;
window.selectMediaForPlayer = PlayerService.selectMediaForPlayer;
window.setPlayerVolume = PlayerService.setPlayerVolume;
window.adjustVolume = PlayerService.adjustVolume;

// Services - Refresh
window.startAdaptiveRefresh = RefreshService.startAdaptiveRefresh;
window.stopAdaptiveRefresh = RefreshService.stopAdaptiveRefresh;
window.startTemporaryAutoRefresh = RefreshService.startTemporaryAutoRefresh;

// Services - View Mode
window.toggleViewMode = ViewModeService.toggleViewMode;

// Services - Demo Mode
window.enableDemoMode = DemoService.enableDemoMode;
window.disableDemoMode = DemoService.disableDemoMode;
window.startDemoAnimation = DemoService.startDemoAnimation;

// Services - Loop Mode
window.toggleNativeLoop = LoopModeService.toggleNativeLoop;
window.updateLoopModeUI = LoopModeService.updateLoopModeUI;

// Utils
window.formatFileSize = formatFileSize;
window.formatTime = formatTime;
window.formatTimestamp = formatTimestamp;
window.formatUptime = formatUptime;
window.DOM = DOM;

// API (для использования в других модулях)
window.PlayersAPI = PlayersAPI;
window.MediaAPI = MediaAPI;
window.ConfigAPI = ConfigAPI;

// === ИНИЦИАЛИЗАЦИЯ ===
console.log('✅ Модульная система загружена');
console.log('📦 Загружено модулей:', {
  state: 'AppState',
  ui: ['messages', 'tabs', 'players-ui', 'multi-players-ui', 'media-ui', 'groups-ui'],
  api: ['players-api', 'media-api', 'config-api'],
  services: ['player-service', 'refresh-service', 'view-mode', 'demo'],
  utils: ['format', 'dom']
});

// Инициализация приложения при загрузке DOM
document.addEventListener('DOMContentLoaded', async () => {
  // Инициализация режима просмотра
  ViewModeService.initViewMode();

  addMessage('Инициализация приложения...', 'info');

  try {
    // Получаем информацию о сервере
    const serverInfo = await ConfigAPI.getServerInfo();
    appState.setServerInfo(serverInfo);
    console.log('Server info:', serverInfo);

    // Проверяем localhost
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      addMessage(`⚠️ Вы используете localhost. Реальный IP сервера: ${serverInfo.primaryAddress}`, 'warning');
      addMessage(`Откройте интерфейс по адресу: http://${serverInfo.primaryAddress}:${serverInfo.port}`, 'info');
    }

    // Загружаем конфигурацию
    const config = await ConfigAPI.getConfig();
    console.log('Config loaded:', config);

    // Восстанавливаем сохраненные настройки из конфига
    if (config.playerSelections) {
      Object.entries(config.playerSelections).forEach(([playerId, fileUrl]) => {
        appState.setPlayerSelection(playerId, fileUrl);
      });
      console.log('[CONFIG] Player selections restored');
    }

    if (config.playerLoopModes) {
      Object.entries(config.playerLoopModes).forEach(([playerId, mode]) => {
        appState.setPlayerLoopMode(playerId, mode);
      });
      console.log('[CONFIG] Loop modes restored');
    }

    if (config.playerVolumes) {
      Object.entries(config.playerVolumes).forEach(([playerId, volume]) => {
        appState.setPlayerVolume(playerId, volume);
      });
      console.log('[CONFIG] Player volumes restored');
    }

    if (config.messagesPanelWidth) {
      appState.setMessagesPanelWidth(config.messagesPanelWidth);
      console.log('[CONFIG] Messages panel width restored:', config.messagesPanelWidth);
    }

    // Загружаем данные
    await loadPlayers();
    await loadMedia();
    await loadPlayerGroups(config.playerGroups); // Передаём уже загруженные группы
    await refreshAllPlayers();

    // Запускаем автообновление
    startAdaptiveRefresh();

    // Обновляем UI Loop Mode
    updateLoopModeUI();

    addMessage('Приложение готово к работе!', 'success');
  } catch (error) {
    console.error('Ошибка инициализации:', error);
    addMessage(`Ошибка инициализации: ${error.message}`, 'error');
  }

  // Инициализация изменяемой ширины панелей
  initResizablePanels();

  // Инициализация sticky header с компактным режимом при скролле
  initStickyHeader();
});

/**
 * Инициализация изменяемой ширины панелей
 */
function initResizablePanels() {
  const resizeHandle = document.getElementById('resize-handle');
  const messagesPanel = document.getElementById('messages-panel');
  const container = document.querySelector('.container');

  if (!resizeHandle || !messagesPanel || !container) return;

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  // Загружаем сохранённую ширину из конфига
  const savedWidth = appState.getMessagesPanelWidth();
  if (savedWidth) {
    messagesPanel.style.width = savedWidth + 'px';
  }

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = messagesPanel.offsetWidth;

    // Добавляем класс для визуального эффекта
    resizeHandle.style.background = 'rgba(102, 126, 234, 0.5)';
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    // Вычисляем новую ширину (панель справа: двигаем влево - панель расширяется)
    const deltaX = e.clientX - startX;
    const newWidth = Math.max(250, Math.min(800, startWidth - deltaX));

    messagesPanel.style.width = newWidth + 'px';
  });

  document.addEventListener('mouseup', async () => {
    if (!isResizing) return;

    isResizing = false;
    resizeHandle.style.background = '';
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Сохраняем новую ширину
    const newWidth = messagesPanel.offsetWidth;
    appState.setMessagesPanelWidth(newWidth);

    // Сохраняем на сервер
    try {
      await ConfigSync.saveMessagesPanelWidth(newWidth);
      console.log('[RESIZE] Messages panel width saved:', newWidth);
    } catch (error) {
      console.error('[RESIZE] Error saving panel width:', error);
    }
  });
}

/**
 * Инициализация sticky header с компактным режимом при скролле
 */
function initStickyHeader() {
  const container = document.querySelector('.container');
  const header = document.querySelector('header.sticky-header');
  const tabs = document.querySelector('.tabs');

  if (!container || !header || !tabs) return;

  let lastScrollTop = 0;

  container.addEventListener('scroll', () => {
    const scrollTop = container.scrollTop;

    // Добавляем класс scrolled при скролле вниз больше 50px
    if (scrollTop > 50) {
      header.classList.add('scrolled');
      tabs.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
      tabs.classList.remove('scrolled');
    }

    lastScrollTop = scrollTop;
  });
}

// Экспортируем для использования в других модулях
export {
  appState,
  addMessage,
  clearMessages,
  switchTab,
  PlayersUI,
  MultiPlayersUI,
  MediaUI,
  GroupsUI,
  PlayersAPI,
  MediaAPI,
  ConfigAPI,
  PlayerService,
  RefreshService,
  ViewModeService,
  DemoService,
  formatFileSize,
  formatTime,
  formatTimestamp,
  formatUptime,
  DOM
};
