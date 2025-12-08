import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Storage {
  constructor() {
    this.dataDir = join(__dirname, 'data');
    this.playersFile = join(this.dataDir, 'players.json');
    this.mediaFile = join(this.dataDir, 'media.json');
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

  // Сохранение плееров
  savePlayers(playersData) {
    try {
      writeFileSync(this.playersFile, JSON.stringify(playersData, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving players:', error);
      return false;
    }
  }

  // Добавление плеера
  addPlayer(player) {
    const data = this.getPlayers();

    // Проверка на дубликаты
    const exists = data.players.find(p => p.ip === player.ip);
    if (exists) {
      // Обновляем существующий (сохраняя его ID!)
      const existingId = exists.id;
      Object.assign(exists, player);
      exists.id = existingId; // Гарантируем, что ID не изменится
    } else {
      // Генерируем уникальный ID: timestamp + случайное число
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      data.players.push({
        id: uniqueId,
        ...player,
        addedAt: new Date().toISOString()
      });
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

  // Сохранение медиа
  saveMedia(mediaData) {
    try {
      console.log(`[STORAGE] Saving media to: ${this.mediaFile}`);
      console.log(`[STORAGE] Files count: ${mediaData.files.length}`);
      writeFileSync(this.mediaFile, JSON.stringify(mediaData, null, 2));
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
}

export default new Storage();
