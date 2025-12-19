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
        return { players: [], activePlayer: null };
      }
      const data = readFileSync(this.playersFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading players:', error);
      return { players: [], activePlayer: null };
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

    // Если это первый плеер, делаем его активным
    if (!data.activePlayer && data.players.length > 0) {
      data.activePlayer = data.players[0].id;
    }

    return this.savePlayers(data);
  }

  // Удаление плеера
  removePlayer(playerId) {
    const data = this.getPlayers();
    data.players = data.players.filter(p => p.id !== playerId);

    // Если удалили активный, выбираем первый
    if (data.activePlayer === playerId) {
      data.activePlayer = data.players.length > 0 ? data.players[0].id : null;
    }

    return this.savePlayers(data);
  }

  // Установка активного плеера
  setActivePlayer(playerId) {
    const data = this.getPlayers();
    const player = data.players.find(p => p.id === playerId);

    if (player) {
      data.activePlayer = playerId;
      return this.savePlayers(data);
    }
    return false;
  }

  // Получение активного плеера
  getActivePlayer() {
    const data = this.getPlayers();
    if (!data.activePlayer) return null;
    return data.players.find(p => p.id === data.activePlayer);
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
}

export default new Storage();
