/**
 * Система сообщений
 */

import { appState } from '../state/AppState.js';
import { formatTimestamp } from '../utils/format.js';
import { getElement, createElement } from '../utils/dom.js';

/**
 * Добавить сообщение в систему
 * @param {string} text - текст сообщения
 * @param {string} type - тип сообщения (info, success, warning, error)
 */
export function addMessage(text, type = 'info') {
  const container = getElement('system-messages');
  if (!container) return;

  const timestamp = formatTimestamp();

  const messageDiv = createElement('div', {
    className: `message-item ${type}`,
    textContent: `[${timestamp}] ${text}`
  });

  container.appendChild(messageDiv);
  appState.messageCounter++;

  // Удаляем старые сообщения если превышен лимит
  if (appState.messageCounter > appState.MAX_MESSAGES) {
    container.removeChild(container.firstChild);
    appState.messageCounter--;
  }

  // Автоскролл вниз
  container.scrollTop = container.scrollHeight;
}

/**
 * Очистить все сообщения
 */
export function clearMessages() {
  const container = getElement('system-messages');
  if (container) {
    container.innerHTML = '';
    appState.messageCounter = 0;
  }
}
