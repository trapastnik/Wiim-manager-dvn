/**
 * Управление вкладками
 */

import { appState } from '../state/AppState.js';

/**
 * Переключить вкладку
 * @param {string} tabName - имя вкладки
 * @param {Event} event - событие клика
 */
export function switchTab(tabName, event) {
  // Скрываем все вкладки
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });

  // Убираем активность с кнопок
  document.querySelectorAll('.tabs .tab').forEach(btn => {
    btn.classList.remove('active');
  });

  // Показываем выбранную вкладку
  const tabContent = document.getElementById(`tab-${tabName}`);
  if (tabContent) {
    tabContent.classList.add('active');
  }

  if (event && event.target) {
    event.target.classList.add('active');
  }

  // Сохраняем текущую вкладку
  appState.setCurrentTab(tabName);

  // Обновляем данные при переключении (будет вызвано извне)
  return tabName;
}
