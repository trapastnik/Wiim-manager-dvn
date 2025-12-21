/**
 * UI модуль для управления медиа файлами
 */

import { appState } from '../state/AppState.js';
import { addMessage } from './messages.js';
import * as MediaAPI from '../api/media-api.js';
import { formatFileSize } from '../utils/format.js';
import { getElement, setHTML, setInputValue } from '../utils/dom.js';

/**
 * Загрузить и отобразить список медиа файлов
 */
export async function loadMedia() {
  try {
    const { files } = await MediaAPI.getMediaFiles();
    console.log('Загружены медиа файлы:', files);
    appState.setMediaFiles(files || []);
    renderMedia(files || []);
    updateBeepSoundOptions();

    // Обновляем плееры чтобы обновить dropdowns с файлами
    if (window.renderMultiPlayers) {
      window.renderMultiPlayers();
    }
  } catch (error) {
    addMessage(`Ошибка загрузки медиа: ${error.message}`, 'error');
  }
}

/**
 * Отрисовать список медиа файлов
 * @param {Array} files - массив медиа файлов
 */
export function renderMedia(files) {
  const container = getElement('media-list');
  if (!container) return;

  if (!files || files.length === 0) {
    setHTML('media-list', '<p class="empty-state">Нет файлов. Загрузите аудио файлы.</p>');
    return;
  }

  const html = files.map(file => `
    <div class="media-item">
      <div class="media-info">
        <div class="filename">${file.name}</div>
        <div class="filesize">${formatFileSize(file.size)}</div>
      </div>
      <div class="media-actions">
        <button class="btn btn-success" onclick="playMediaFile('${file.path}', '${file.name}')">▶ Играть</button>
        <button class="btn btn-danger" onclick="deleteMediaFile('${file.filename}', '${file.name}')">🗑 Удалить</button>
      </div>
    </div>
  `).join('');

  setHTML('media-list', html);
}

/**
 * Обновить список звуков для пищалки в настройках
 */
export function updateBeepSoundOptions() {
  const beepSelect = getElement('beep-sound-select');
  if (!beepSelect) return;

  // Сохраняем текущий выбор
  const currentValue = beepSelect.value;

  // Очищаем и добавляем опцию по умолчанию
  beepSelect.innerHTML = '<option value="default">По умолчанию (Google TTS "Бип")</option>';

  // Добавляем все медиа файлы
  const files = appState.getMediaFiles();
  files.forEach(file => {
    const option = document.createElement('option');
    option.value = file.url;
    option.textContent = file.name;
    beepSelect.appendChild(option);
  });

  // Восстанавливаем предыдущий выбор
  if (currentValue && Array.from(beepSelect.options).some(opt => opt.value === currentValue)) {
    beepSelect.value = currentValue;
  }
}

/**
 * Загрузить файл
 * @param {File} file - файл для загрузки
 */
export async function uploadFile(file) {
  if (!file) return;

  addMessage(`Загрузка файла: ${file.name}`, 'info');

  try {
    await MediaAPI.uploadMediaFile(file, (percent) => {
      console.log(`Прогресс загрузки: ${percent}%`);
    });

    addMessage(`Файл ${file.name} загружен`, 'success');
    await loadMedia();
  } catch (error) {
    addMessage(`Ошибка загрузки: ${error.message}`, 'error');
  }

  // Сброс input
  setInputValue('file-upload', '');
}

/**
 * Удалить медиа файл
 * @param {string} filename - имя файла
 * @param {string} displayName - отображаемое имя
 */
export async function deleteMediaFile(filename, displayName) {
  if (!confirm(`Удалить файл "${displayName}"?`)) return;

  try {
    await MediaAPI.deleteMediaFile(filename);
    addMessage(`Файл "${displayName}" удален`, 'success');
    await loadMedia();
    // Вызовем обновление плееров если функция доступна
    if (window.refreshAllPlayers) {
      window.refreshAllPlayers();
    }
  } catch (error) {
    addMessage(`Ошибка удаления: ${error.message}`, 'error');
  }
}

/**
 * Воспроизвести медиа файл
 * @param {string} filePath - путь к файлу
 * @param {string} fileName - имя файла
 */
export async function playMediaFile(filePath, fileName) {
  try {
    const serverUrl = window.location.origin + filePath;
    addMessage(`Воспроизведение: ${fileName}`, 'info');

    // Воспроизвести на всех плеерах (логика будет в player-service)
    if (window.playMediaOnAllPlayers) {
      await window.playMediaOnAllPlayers(serverUrl);
    } else {
      addMessage('Функция воспроизведения недоступна', 'warning');
    }
  } catch (error) {
    addMessage(`Ошибка воспроизведения: ${error.message}`, 'error');
  }
}

/**
 * Обработчик выбора файла через input
 */
export function handleFileSelect() {
  const fileInput = getElement('file-upload');
  if (fileInput && fileInput.files && fileInput.files[0]) {
    uploadFile(fileInput.files[0]);
  }
}
