/**
 * Утилита для логирования с миллисекундами
 */

/**
 * Логирование с timestamp в формате HH:MM:SS.mmm
 * @param {string} message - сообщение для логирования
 */
export function logWithMs(message) {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  const timestamp = `${hours}:${minutes}:${seconds}.${milliseconds}`;
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Логирование с префиксом категории
 * @param {string} category - категория (напр. 'AUTO-REPEAT', 'SCAN')
 * @param {string} message - сообщение
 */
export function logCategory(category, message) {
  logWithMs(`[${category}] ${message}`);
}
