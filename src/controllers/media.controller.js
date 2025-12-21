import path from 'path';
import fs from 'fs';
import { logWithMs } from '../utils/logger.js';

const MEDIA_DIR = path.join(process.cwd(), 'media');

/**
 * Контроллер для управления медиафайлами
 */

export async function getMediaFiles(req, res) {
  try {
    if (!fs.existsSync(MEDIA_DIR)) {
      fs.mkdirSync(MEDIA_DIR, { recursive: true });
    }

    const files = fs.readdirSync(MEDIA_DIR);
    const mediaFiles = files.map(filename => {
      const filePath = path.join(MEDIA_DIR, filename);
      const stats = fs.statSync(filePath);
      return {
        name: filename,
        size: stats.size,
        modified: stats.mtime,
        url: `/media/${filename}`
      };
    });

    res.json(mediaFiles);
  } catch (error) {
    logWithMs(`Ошибка получения списка медиафайлов: ${error.message}`);
    res.status(500).json({ error: 'Ошибка получения списка файлов' });
  }
}

export async function uploadMediaFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    logWithMs(`Загружен файл: ${req.file.originalname} (${req.file.size} байт)`);

    res.json({
      success: true,
      file: {
        name: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        url: `/media/${req.file.filename}`
      }
    });
  } catch (error) {
    logWithMs(`Ошибка загрузки файла: ${error.message}`);
    res.status(500).json({ error: 'Ошибка загрузки файла' });
  }
}

export async function deleteMediaFile(req, res) {
  try {
    const { filename } = req.params;
    const filePath = path.join(MEDIA_DIR, filename);

    // Проверка безопасности: файл должен быть в MEDIA_DIR
    const resolvedPath = path.resolve(filePath);
    const resolvedMediaDir = path.resolve(MEDIA_DIR);

    if (!resolvedPath.startsWith(resolvedMediaDir)) {
      return res.status(403).json({ error: 'Недопустимый путь к файлу' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    fs.unlinkSync(filePath);
    logWithMs(`Удалён файл: ${filename}`);
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Ошибка удаления файла: ${error.message}`);
    res.status(500).json({ error: 'Ошибка удаления файла' });
  }
}

export async function getPlaylist(req, res, storage) {
  try {
    const playlist = await storage.getPlaylist();
    res.json(playlist);
  } catch (error) {
    logWithMs(`Ошибка получения плейлиста: ${error.message}`);
    res.status(500).json({ error: 'Ошибка получения плейлиста' });
  }
}

export async function savePlaylist(req, res, storage) {
  try {
    const { playlist } = req.body;

    if (!Array.isArray(playlist)) {
      return res.status(400).json({ error: 'Плейлист должен быть массивом' });
    }

    await storage.savePlaylist(playlist);
    logWithMs(`Плейлист сохранён (${playlist.length} треков)`);
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Ошибка сохранения плейлиста: ${error.message}`);
    res.status(500).json({ error: 'Ошибка сохранения плейлиста' });
  }
}
