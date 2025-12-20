/**
 * Утилиты для форматирования данных
 */

/**
 * Форматирование размера файла в человекочитаемый вид
 * @param {number} bytes - размер в байтах
 * @returns {string} - отформатированная строка
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Форматирование времени из миллисекунд в MM:SS
 * @param {number} ms - время в миллисекундах
 * @returns {string} - отформатированное время
 */
export function formatTime(ms) {
  if (!ms || ms < 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Форматирование timestamp с миллисекундами
 * @returns {string} - timestamp в формате HH:MM:SS.mmm
 */
export function formatTimestamp() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

/**
 * Форматирование uptime (времени работы)
 * @param {number} ms - время в миллисекундах
 * @returns {string} - отформатированное время
 */
export function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}д ${hours % 24}ч ${minutes % 60}м`;
  } else if (hours > 0) {
    return `${hours}ч ${minutes % 60}м ${seconds % 60}с`;
  } else if (minutes > 0) {
    return `${minutes}м ${seconds % 60}с`;
  } else {
    return `${seconds}с`;
  }
}

/**
 * Форматирование трафика (байты в KB/MB/GB)
 * @param {number} bytes - размер в байтах
 * @returns {string} - отформатированный трафик
 */
export function formatTraffic(bytes) {
  return formatFileSize(bytes);
}
