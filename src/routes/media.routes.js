import express from 'express';
import multer from 'multer';
import path from 'path';
import * as mediaController from '../controllers/media.controller.js';

const MEDIA_DIR = path.join(process.cwd(), 'media');

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, MEDIA_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

/**
 * Маршруты для управления медиафайлами
 */
export function createMediaRouter(storageService) {
  const router = express.Router();

  // Получить список медиафайлов
  router.get('/', (req, res) =>
    mediaController.getMediaFiles(req, res)
  );

  // Загрузить медиафайл
  router.post('/upload', upload.single('file'), (req, res) =>
    mediaController.uploadMediaFile(req, res)
  );

  // Удалить медиафайл
  router.delete('/:filename', (req, res) =>
    mediaController.deleteMediaFile(req, res)
  );

  // Получить плейлист
  router.get('/playlist', (req, res) =>
    mediaController.getPlaylist(req, res, storageService)
  );

  // Сохранить плейлист
  router.post('/playlist', (req, res) =>
    mediaController.savePlaylist(req, res, storageService)
  );

  return router;
}
