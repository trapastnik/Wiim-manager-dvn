/**
 * Централизованное управление состоянием приложения
 * Заменяет 22+ глобальные переменные из app.js
 */

class AppState {
  constructor() {
    // Система сообщений
    this.messageCounter = 0;
    this.MAX_MESSAGES = 50;

    // UI состояние
    this.currentTab = 'player';
    this.viewMode = 'advanced'; // 'simple' или 'advanced'

    // Данные
    this.allPlayers = [];
    this.allMediaFiles = [];

    // Конфигурация плееров
    this.playerSelections = {}; // Сохраняем выбор файла для каждого плеера
    this.playerStatuses = {}; // Статусы всех плееров
    this.playerDiagnostics = {}; // Диагностическая информация для каждого плеера
    this.playerLoopModes = {}; // Режимы повтора для каждого плеера (0=no loop, 1=single loop)
    this.playerVolumes = {}; // Сохраненные громкости для каждого плеера
    this.volumeDebounceTimers = {}; // Таймеры debounce для слайдеров громкости

    // Серверная информация
    this.serverInfo = null; // Информация о сервере (IP адреса)

    // Отслеживание состояния плееров
    this.lastPlayerPositions = {}; // Последние позиции плееров для отслеживания зависаний
    this.playerManualStops = {}; // Отслеживание ручных остановок плееров
    this.playerExpectedStates = {}; // Ожидаемое состояние плеера (play/stop)

    // Автообновление
    this.autoRefreshTimer = null; // Таймер для временного автообновления
    this.autoRefreshCount = 0; // Счетчик автообновлений
    this.adaptiveRefreshTimer = null; // Таймер для адаптивного автообновления
    this.isAnyPlayerPlaying = false; // Флаг - играет ли хотя бы один плеер

    // Группы плееров
    this.playerGroups = []; // Массив сохранённых групп плееров
    this.selectedPlayersForGroup = new Set(); // Временный выбор плееров для создания группы

    // Демо-режим
    this.isDemoMode = false; // Демо-режим для тестирования без реальных устройств
    this.demoPlayers = []; // Виртуальные плееры для демо-режима
    this.demoMediaFiles = []; // Виртуальные медиа файлы для демо-режима

    // Экспериментальные настройки Loop Mode
    this.loopExperimentalSettings = {
      useWiimNativeLoop: true,     // Технология 1: Встроенный WiiM loopMode API
      useClientMonitoring: false   // Технология 2: Клиентский мониторинг и автоперезапуск
    };
  }

  // === Геттеры и сеттеры для основных данных ===

  getPlayers() {
    return this.allPlayers;
  }

  setPlayers(players) {
    this.allPlayers = players;
  }

  getMediaFiles() {
    return this.allMediaFiles;
  }

  setMediaFiles(files) {
    this.allMediaFiles = files;
  }

  getCurrentTab() {
    return this.currentTab;
  }

  setCurrentTab(tab) {
    this.currentTab = tab;
  }

  // === Методы для работы с состоянием плееров ===

  getPlayerStatus(playerId) {
    return this.playerStatuses[playerId];
  }

  setPlayerStatus(playerId, status) {
    this.playerStatuses[playerId] = status;
  }

  getPlayerSelection(playerId) {
    return this.playerSelections[playerId];
  }

  setPlayerSelection(playerId, selection) {
    this.playerSelections[playerId] = selection;
  }

  getPlayerLoopMode(playerId) {
    return this.playerLoopModes[playerId] || 0;
  }

  setPlayerLoopMode(playerId, mode) {
    this.playerLoopModes[playerId] = mode;
  }

  getPlayerVolume(playerId) {
    return this.playerVolumes[playerId];
  }

  setPlayerVolume(playerId, volume) {
    this.playerVolumes[playerId] = volume;
  }

  // === Методы для работы с группами ===

  getPlayerGroups() {
    return this.playerGroups;
  }

  setPlayerGroups(groups) {
    this.playerGroups = groups;
  }

  addPlayerToGroupSelection(playerId) {
    this.selectedPlayersForGroup.add(playerId);
  }

  removePlayerFromGroupSelection(playerId) {
    this.selectedPlayersForGroup.delete(playerId);
  }

  clearGroupSelection() {
    this.selectedPlayersForGroup.clear();
  }

  getGroupSelection() {
    return this.selectedPlayersForGroup;
  }

  // === Демо-режим ===

  enableDemoMode() {
    this.isDemoMode = true;
  }

  disableDemoMode() {
    this.isDemoMode = false;
  }

  isDemoModeEnabled() {
    return this.isDemoMode;
  }

  // === Серверная информация ===

  setServerInfo(info) {
    this.serverInfo = info;
  }

  getServerInfo() {
    return this.serverInfo;
  }

  // === Режим просмотра ===

  setViewMode(mode) {
    this.viewMode = mode;
  }

  getViewMode() {
    return this.viewMode;
  }

  // === Сброс состояния ===

  reset() {
    this.allPlayers = [];
    this.allMediaFiles = [];
    this.playerStatuses = {};
    this.playerSelections = {};
    this.selectedPlayersForGroup.clear();
  }
}

// Экспортируем синглтон
export const appState = new AppState();
