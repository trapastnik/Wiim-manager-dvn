/**
 * Сервис автоматической синхронизации конфигурации с сервером
 */

import { appState } from '../state/AppState.js';
import * as ConfigAPI from '../api/config-api.js';

// Таймеры debounce для разных типов данных
let saveSelectionsTimer = null;
let saveLoopModesTimer = null;
let saveVolumesTimer = null;

/**
 * Сохранить выбор медиа для плееров (с debounce 300ms)
 */
export function savePlayerSelections() {
  // В демо-режиме не сохраняем
  if (appState.isDemoModeEnabled()) return;

  if (saveSelectionsTimer) {
    clearTimeout(saveSelectionsTimer);
  }

  saveSelectionsTimer = setTimeout(async () => {
    try {
      const selections = appState.getAllPlayerSelections();
      await ConfigAPI.syncConfig({
        playerSelections: selections
      });
      console.log('[CONFIG-SYNC] Player selections saved');
    } catch (error) {
      console.error('[CONFIG-SYNC] Error saving player selections:', error);
      if (window.addMessage) {
        window.addMessage('⚠️ Не удалось сохранить выбор файлов', 'error');
      }
    }
  }, 300);
}

/**
 * Сохранить режимы повтора для плееров
 */
export function saveLoopModes() {
  // В демо-режиме не сохраняем
  if (appState.isDemoModeEnabled()) return;

  if (saveLoopModesTimer) {
    clearTimeout(saveLoopModesTimer);
  }

  saveLoopModesTimer = setTimeout(async () => {
    try {
      const loopModes = appState.getAllLoopModes();
      await ConfigAPI.saveLoopModes(loopModes);
      console.log('[CONFIG-SYNC] Loop modes saved');
    } catch (error) {
      console.error('[CONFIG-SYNC] Error saving loop modes:', error);
      if (window.addMessage) {
        window.addMessage('⚠️ Не удалось сохранить Loop режимы', 'error');
      }
    }
  }, 300);
}

/**
 * Сохранить громкости плееров
 */
export function saveVolumes() {
  // В демо-режиме не сохраняем
  if (appState.isDemoModeEnabled()) return;

  if (saveVolumesTimer) {
    clearTimeout(saveVolumesTimer);
  }

  saveVolumesTimer = setTimeout(async () => {
    try {
      const volumes = appState.getAllVolumes();
      await ConfigAPI.syncConfig({
        playerVolumes: volumes
      });
      console.log('[CONFIG-SYNC] Player volumes saved');
    } catch (error) {
      console.error('[CONFIG-SYNC] Error saving player volumes:', error);
      if (window.addMessage) {
        window.addMessage('⚠️ Не удалось сохранить громкости', 'error');
      }
    }
  }, 300);
}

/**
 * Сохранить группы плееров
 */
export async function savePlayerGroups() {
  // В демо-режиме не сохраняем
  if (appState.isDemoModeEnabled()) return;

  try {
    const groups = appState.getPlayerGroups();
    const selections = appState.getAllPlayerSelections();
    await ConfigAPI.syncConfig({
      playerGroups: groups,
      playerSelections: selections
    });
    console.log('[CONFIG-SYNC] Player groups saved');
  } catch (error) {
    console.error('[CONFIG-SYNC] Error saving player groups:', error);
    if (window.addMessage) {
      window.addMessage('⚠️ Не удалось сохранить группы плееров', 'error');
    }
  }
}

/**
 * Сохранить ширину панели сообщений
 */
export async function saveMessagesPanelWidth(width) {
  // В демо-режиме не сохраняем
  if (appState.isDemoModeEnabled()) return;

  try {
    await ConfigAPI.saveMessagesPanelWidth(width);
    console.log('[CONFIG-SYNC] Messages panel width saved:', width);
  } catch (error) {
    console.error('[CONFIG-SYNC] Error saving panel width:', error);
  }
}
