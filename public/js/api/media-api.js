/**
 * API для работы с медиа файлами
 */

import { get, del, upload } from './base-api.js';

/**
 * Получить список медиа файлов
 * @returns {Promise<{files: Array}>}
 */
export async function getMediaFiles() {
  return await get('/api/media');
}

/**
 * Загрузить медиа файл
 * @param {File} file - файл для загрузки
 * @param {Function} onProgress - callback для отслеживания прогресса (опционально)
 * @returns {Promise<{success: boolean, filename: string}>}
 */
export async function uploadMediaFile(file, onProgress = null) {
  const formData = new FormData();
  formData.append('file', file);

  // Если нужен прогресс - используем XMLHttpRequest
  if (onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('POST', '/api/media/upload');
      xhr.send(formData);
    });
  }

  // Иначе используем fetch
  return await upload('/api/media/upload', formData);
}

/**
 * Удалить медиа файл
 * @param {string} filename - имя файла
 * @returns {Promise<{success: boolean}>}
 */
export async function deleteMediaFile(filename) {
  return await del(`/api/media/${encodeURIComponent(filename)}`);
}

/**
 * Получить плейлист
 * @param {string} filename - имя файла плейлиста
 * @returns {Promise<{tracks: Array}>}
 */
export async function getPlaylist(filename) {
  return await get(`/api/playlist/${encodeURIComponent(filename)}`);
}
