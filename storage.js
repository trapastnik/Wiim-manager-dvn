import { readFileSync, writeFileSync, existsSync, renameSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Storage {
  constructor() {
    this.dataDir = join(__dirname, 'data');
    this.playersFile = join(this.dataDir, 'players.json');
    this.mediaFile = join(this.dataDir, 'media.json');
    this.playbackStateFile = join(this.dataDir, 'playback-state.json');
    this.uiConfigFile = join(this.dataDir, 'ui-config.json');

    // Очистка старых временных файлов при инициализации
    this.cleanupTempFiles();
  }

  // Очистка временных файлов (.tmp) из директории data
  cleanupTempFiles() {
    try {
      if (!existsSync(this.dataDir)) return;

      const files = readdirSync(this.dataDir);
      let cleaned = 0;

      files.forEach(file => {
        if (file.endsWith('.tmp')) {
          const filePath = join(this.dataDir, file);
          try {
            unlinkSync(filePath);
            cleaned++;
            console.log(`[STORAGE] Удален временный файл: ${file}`);
          } catch (err) {
            console.error(`[STORAGE] Ошибка удаления ${file}:`, err.message);
          }
        }
      });

      if (cleaned > 0) {
        console.log(`[STORAGE] Очищено временных файлов: ${cleaned}`);
      }
    } catch (error) {
      console.error('[STORAGE] Ошибка при очистке временных файлов:', error.message);
    }
  }

  // Чтение данных плееров
  getPlayers() {
    try {
      if (!existsSync(this.playersFile)) {
        return { players: [] };
      }
      const data = readFileSync(this.playersFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading players:', error);
      return { players: [] };
    }
  }

  // Атомарное сохранение плееров (защита от корруптирования файла)
  savePlayers(playersData) {
    try {
      // Записываем во временный файл
      const tempFile = this.playersFile + '.tmp';
      writeFileSync(tempFile, JSON.stringify(playersData, null, 2));

      // Атомарная замена (если запись прервется, старый файл останется целым)
      renameSync(tempFile, this.playersFile);
      return true;
    } catch (error) {
      console.error('Error saving players:', error);
      return false;
    }
  }

  // Добавление плеера
  addPlayer(player) {
    const data = this.getPlayers();

    // Многоуровневая проверка на дубликаты:
    // 1. По UUID (MAC-адрес) - самый надёжный способ
    // 2. По IP-адресу
    // 3. По имени устройства

    let existingPlayer = null;

    // Приоритет 1: UUID (если доступен из WiiM API)
    if (player.uuid) {
      existingPlayer = data.players.find(p => p.uuid === player.uuid);
      if (existingPlayer) {
        console.log(`[STORAGE] Player found by UUID: ${player.uuid} → updating IP: ${existingPlayer.ip} → ${player.ip}`);
      }
    }

    // Приоритет 2: IP-адрес
    if (!existingPlayer) {
      existingPlayer = data.players.find(p => p.ip === player.ip);
      if (existingPlayer) {
        console.log(`[STORAGE] Player found by IP: ${player.ip} → updating name: "${existingPlayer.name}" → "${player.name}"`);
      }
    }

    // Приоритет 3: Имя устройства (если IP изменился, но имя осталось)
    if (!existingPlayer && player.name) {
      existingPlayer = data.players.find(p => p.name === player.name);
      if (existingPlayer) {
        console.log(`[STORAGE] Player "${player.name}" found by name → updating IP: ${existingPlayer.ip} → ${player.ip}`);
      }
    }

    if (existingPlayer) {
      // Обновляем существующий плеер (сохраняя его ID!)
      const existingId = existingPlayer.id;
      Object.assign(existingPlayer, player);
      existingPlayer.id = existingId; // Гарантируем, что ID не изменится
      existingPlayer.updatedAt = new Date().toISOString();
    } else {
      // Новый плеер - добавляем
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const newPlayer = {
        id: uniqueId,
        ...player,
        addedAt: new Date().toISOString()
      };
      data.players.push(newPlayer);
      console.log(`[STORAGE] New player added: "${player.name}" at ${player.ip}`);
    }

    return this.savePlayers(data);
  }

  // Удаление плеера
  removePlayer(playerId) {
    const data = this.getPlayers();
    data.players = data.players.filter(p => p.id !== playerId);
    return this.savePlayers(data);
  }


  // Работа с медиа файлами
  getMedia() {
    try {
      if (!existsSync(this.mediaFile)) {
        return { files: [], playlists: [] };
      }
      const data = readFileSync(this.mediaFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading media:', error);
      return { files: [], playlists: [] };
    }
  }

  // Атомарное сохранение медиа (защита от корруптирования файла)
  saveMedia(mediaData) {
    try {
      console.log(`[STORAGE] Saving media to: ${this.mediaFile}`);
      console.log(`[STORAGE] Files count: ${mediaData.files.length}`);

      // Записываем во временный файл
      const tempFile = this.mediaFile + '.tmp';
      writeFileSync(tempFile, JSON.stringify(mediaData, null, 2));

      // Атомарная замена
      renameSync(tempFile, this.mediaFile);
      console.log(`[STORAGE] Media saved successfully`);
      return true;
    } catch (error) {
      console.error('[STORAGE] Error saving media:', error);
      return false;
    }
  }

  // Добавление медиа файла
  addMediaFile(file) {
    const data = this.getMedia();

    // Проверяем, не существует ли уже файл с таким filename
    const existingIndex = data.files.findIndex(f => f.filename === file.filename);

    if (existingIndex !== -1) {
      // Обновляем существующий файл вместо добавления дубликата
      data.files[existingIndex] = {
        ...data.files[existingIndex],
        ...file,
        updatedAt: new Date().toISOString()
      };
    } else {
      // Добавляем новый файл
      data.files.push({
        id: Date.now().toString(),
        ...file,
        addedAt: new Date().toISOString()
      });
    }

    return this.saveMedia(data);
  }

  // Удаление медиа файла
  removeMediaFile(filename) {
    const data = this.getMedia();
    console.log(`[STORAGE] Removing file: ${filename}`);
    console.log(`[STORAGE] Files before removal: ${data.files.length}`);

    const before = data.files.length;
    data.files = data.files.filter(f => f.filename !== filename);
    const after = data.files.length;

    console.log(`[STORAGE] Files after removal: ${after} (removed ${before - after})`);

    const result = this.saveMedia(data);
    console.log(`[STORAGE] Save result: ${result}`);

    return result;
  }

  // ================================================
  // МЕТОДЫ ДЛЯ АВТОВОССТАНОВЛЕНИЯ ВОСПРОИЗВЕДЕНИЯ
  // ================================================

  // Получить конфигурацию назначений плееров (playerSelections + groups)
  getPlaybackConfig() {
    try {
      if (!existsSync(this.playbackStateFile)) {
        return { playerSelections: {}, playerGroups: [], lastUpdated: null };
      }
      const data = readFileSync(this.playbackStateFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('[STORAGE] Error reading playback config:', error);
      return { playerSelections: {}, playerGroups: [], lastUpdated: null };
    }
  }

  // Сохранить конфигурацию назначений плееров (атомарно)
  savePlaybackConfig(playerSelections, playerGroups = []) {
    try {
      const config = {
        playerSelections: playerSelections || {},
        playerGroups: playerGroups || [],
        lastUpdated: new Date().toISOString()
      };

      // Записываем во временный файл
      const tempFile = this.playbackStateFile + '.tmp';
      writeFileSync(tempFile, JSON.stringify(config, null, 2));

      // Атомарная замена
      renameSync(tempFile, this.playbackStateFile);
      return true;
    } catch (error) {
      console.error('[STORAGE] Error saving playback config:', error);
      return false;
    }
  }

  // Очистка битых статусов (несуществующих плееров из playback-state)
  cleanupPlaybackState() {
    try {
      const playersData = this.getPlayers();
      const config = this.getPlaybackConfig();

      const validPlayerIds = new Set(playersData.players.map(p => p.id));

      // Фильтруем playerSelections - оставляем только существующих плееров
      const cleanedSelections = {};
      let removedSelectionsCount = 0;

      for (const [playerId, filePath] of Object.entries(config.playerSelections || {})) {
        if (validPlayerIds.has(playerId)) {
          cleanedSelections[playerId] = filePath;
        } else {
          removedSelectionsCount++;
          console.log(`[CLEANUP] Removed dead player selection: ${playerId} → ${filePath}`);
        }
      }

      // Фильтруем playerGroups - удаляем группы с несуществующими плеерами
      const cleanedGroups = [];
      let removedGroupsCount = 0;

      for (const group of (config.playerGroups || [])) {
        const validPlayers = group.playerIds.filter(id => validPlayerIds.has(id));

        if (validPlayers.length > 0) {
          cleanedGroups.push({
            ...group,
            playerIds: validPlayers
          });

          const removed = group.playerIds.length - validPlayers.length;
          if (removed > 0) {
            console.log(`[CLEANUP] Group "${group.name}": removed ${removed} dead players`);
          }
        } else {
          removedGroupsCount++;
          console.log(`[CLEANUP] Removed empty group: "${group.name}"`);
        }
      }

      // Сохраняем очищенную конфигурацию
      const saved = this.savePlaybackConfig(cleanedSelections, cleanedGroups);

      if (saved) {
        console.log(`[CLEANUP] Summary: removed ${removedSelectionsCount} dead selections, ${removedGroupsCount} empty groups`);
        return {
          success: true,
          removedSelections: removedSelectionsCount,
          removedGroups: removedGroupsCount,
          validSelections: Object.keys(cleanedSelections).length,
          validGroups: cleanedGroups.length
        };
      }

      return { success: false, error: 'Failed to save cleaned config' };
    } catch (error) {
      console.error('[CLEANUP] Error cleaning playback state:', error);
      return { success: false, error: error.message };
    }
  }

  // ================================================
  // МЕТОДЫ ДЛЯ UI КОНФИГУРАЦИИ (loopModes, settings)
  // ================================================

  // Получить UI конфигурацию (loopModes, appSettings, messagesPanelWidth)
  getUIConfig() {
    try {
      if (!existsSync(this.uiConfigFile)) {
        return {
          playerLoopModes: {},
          appSettings: { beepSoundUrl: 'default' },
          messagesPanelWidth: null,
          lastUpdated: null
        };
      }
      const data = readFileSync(this.uiConfigFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('[STORAGE] Error reading UI config:', error);
      return {
        playerLoopModes: {},
        playerVolumes: {},
        appSettings: { beepSoundUrl: 'default' },
        messagesPanelWidth: null,
        lastUpdated: null
      };
    }
  }

  // Сохранить UI конфигурацию (атомарно)
  saveUIConfig(config) {
    try {
      const fullConfig = {
        playerLoopModes: config.playerLoopModes || {},
        playerVolumes: config.playerVolumes || {},
        appSettings: config.appSettings || { beepSoundUrl: 'default' },
        messagesPanelWidth: config.messagesPanelWidth || null,
        lastUpdated: new Date().toISOString()
      };

      // Записываем во временный файл
      const tempFile = this.uiConfigFile + '.tmp';
      writeFileSync(tempFile, JSON.stringify(fullConfig, null, 2));

      // Атомарная замена
      renameSync(tempFile, this.uiConfigFile);
      return true;
    } catch (error) {
      console.error('[STORAGE] Error saving UI config:', error);
      return false;
    }
  }

  // Обновить только loopModes
  updateLoopModes(playerLoopModes) {
    const config = this.getUIConfig();
    config.playerLoopModes = playerLoopModes;
    return this.saveUIConfig(config);
  }

  // Обновить только appSettings
  updateAppSettings(appSettings) {
    const config = this.getUIConfig();
    config.appSettings = appSettings;
    return this.saveUIConfig(config);
  }

  // Обновить ширину панели сообщений
  updateMessagesPanelWidth(width) {
    const config = this.getUIConfig();
    config.messagesPanelWidth = width;
    return this.saveUIConfig(config);
  }

  // Обновить громкость для конкретного плеера
  updatePlayerVolume(playerId, volume) {
    const config = this.getUIConfig();
    if (!config.playerVolumes) config.playerVolumes = {};
    config.playerVolumes[playerId] = parseInt(volume);
    return this.saveUIConfig(config);
  }

  // Получить сохраненную громкость плеера
  getPlayerVolume(playerId) {
    const config = this.getUIConfig();
    return config.playerVolumes && config.playerVolumes[playerId] !== undefined
      ? config.playerVolumes[playerId]
      : null; // null означает "использовать текущую громкость плеера"
  }

  // Обновить экспериментальные настройки loop mode
  updateLoopExperimentalSettings(loopExperimentalSettings) {
    const config = this.getUIConfig();
    config.loopExperimentalSettings = loopExperimentalSettings;
    return this.saveUIConfig(config);
  }

  // ================================================
  // ОБЩИЕ МЕТОДЫ ДЛЯ ПОЛУЧЕНИЯ/СОХРАНЕНИЯ ВСЕЙ КОНФИГУРАЦИИ
  // ================================================

  // Получить всю конфигурацию (playback + UI)
  getConfig() {
    const playbackConfig = this.getPlaybackConfig();
    const uiConfig = this.getUIConfig();

    return {
      playerSelections: playbackConfig.playerSelections,
      playerGroups: playbackConfig.playerGroups,
      playerLoopModes: uiConfig.playerLoopModes,
      playerVolumes: uiConfig.playerVolumes,
      appSettings: uiConfig.appSettings,
      messagesPanelWidth: uiConfig.messagesPanelWidth,
      loopExperimentalSettings: uiConfig.loopExperimentalSettings,
      lastUpdated: new Date().toISOString()
    };
  }

  // Сохранить всю конфигурацию
  saveConfig(config) {
    // Сохраняем playback конфигурацию
    if (config.playerSelections !== undefined || config.playerGroups !== undefined) {
      this.savePlaybackConfig(
        config.playerSelections || {},
        config.playerGroups || []
      );
    }

    // Сохраняем UI конфигурацию
    const uiConfig = {};
    if (config.playerLoopModes !== undefined) uiConfig.playerLoopModes = config.playerLoopModes;
    if (config.playerVolumes !== undefined) uiConfig.playerVolumes = config.playerVolumes;
    if (config.appSettings !== undefined) uiConfig.appSettings = config.appSettings;
    if (config.messagesPanelWidth !== undefined) uiConfig.messagesPanelWidth = config.messagesPanelWidth;
    if (config.loopExperimentalSettings !== undefined) uiConfig.loopExperimentalSettings = config.loopExperimentalSettings;

    if (Object.keys(uiConfig).length > 0) {
      const currentUIConfig = this.getUIConfig();
      this.saveUIConfig({ ...currentUIConfig, ...uiConfig });
    }

    return true;
  }
}

export default new Storage();
