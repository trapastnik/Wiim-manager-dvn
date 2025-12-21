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
  }
}
