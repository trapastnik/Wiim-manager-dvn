import { appState } from '../state/AppState.js';
import { addMessage } from '../ui/messages.js';

/**
 * Сервис управления режимом просмотра
 */

/**
 * Переключить режим просмотра
 */
export async function toggleViewMode() {
  // Переключаем режим
  const newMode = appState.getViewMode() === 'simple' ? 'advanced' : 'simple';
  appState.setViewMode(newMode);

  // Обновляем кнопку
  updateViewModeButton();

  // Показываем/скрываем панель сообщений
  toggleMessagesPanel(newMode);

  // Уведомление
  addMessage(`${newMode === 'simple' ? '📱 Простой режим' : '🔧 Расширенный режим'} активирован`, 'info');

  // Сохраняем настройки (если есть API)
  try {
    const response = await fetch('/api/config/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewMode: newMode })
    });

    if (response.ok) {
      console.log(`[VIEW-MODE] Режим переключен: ${newMode}`);
    }
  } catch (error) {
    console.error('[VIEW-MODE] Error saving view mode:', error);
  }
}

/**
 * Обновить кнопку режима просмотра
 */
function updateViewModeButton() {
  const viewMode = appState.getViewMode();
  const icon = document.getElementById('view-mode-icon');
  const text = document.getElementById('view-mode-text');

  if (icon && text) {
    if (viewMode === 'simple') {
      icon.textContent = '🔧';
      text.textContent = 'Расширенный режим';
    } else {
      icon.textContent = '📱';
      text.textContent = 'Простой режим';
    }
  }
}

/**
 * Показать/скрыть панель сообщений и расширенные элементы
 */
function toggleMessagesPanel(mode) {
  const panel = document.querySelector('.messages-panel');
  if (panel) {
    if (mode === 'simple') {
      panel.style.display = 'none';
    } else {
      panel.style.display = 'block';
    }
  }

  // Показываем/скрываем элементы только для расширенного режима
  const advancedElements = document.querySelectorAll('.advanced-only');
  advancedElements.forEach(el => {
    if (mode === 'simple') {
      el.style.display = 'none';
    } else {
      el.style.display = 'block';
    }
  });
}

/**
 * Инициализация режима просмотра при загрузке
 */
export function initViewMode() {
  const viewMode = appState.getViewMode();
  updateViewModeButton();
  toggleMessagesPanel(viewMode);
}
