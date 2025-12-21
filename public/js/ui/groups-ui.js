/**
 * UI модуль для управления группами плееров
 */

import { appState } from '../state/AppState.js';
import { addMessage } from './messages.js';
import { getElement, setHTML } from '../utils/dom.js';
import * as ConfigSync from '../services/config-sync.service.js';

/**
 * Переключить выбор плеера для группы
 * @param {string} playerId - ID плеера
 */
export function togglePlayerSelection(playerId) {
  const selection = appState.getGroupSelection();

  if (selection.has(playerId)) {
    appState.removePlayerFromGroupSelection(playerId);
  } else {
    appState.addPlayerToGroupSelection(playerId);
  }

  updateGroupSelectionUI();
}

/**
 * Обновить UI выбора группы
 */
export function updateGroupSelectionUI() {
  const selection = appState.getGroupSelection();
  const createBtn = getElement('create-group-btn');
  const clearBtn = getElement('clear-selection-btn');

  if (createBtn) {
    createBtn.disabled = selection.size < 2;
  }

  if (clearBtn) {
    clearBtn.style.display = selection.size > 0 ? 'inline-block' : 'none';
  }

  // Обновляем визуальное выделение плееров
  document.querySelectorAll('.player-select-checkbox').forEach(checkbox => {
    const playerId = checkbox.dataset.playerId;
    checkbox.checked = selection.has(playerId);
  });
}

/**
 * Создать группу плееров
 */
export function createPlayerGroup() {
  const selection = appState.getGroupSelection();

  if (selection.size < 2) {
    alert('Выберите минимум 2 плеера');
    return;
  }

  const groupName = prompt('Введите название группы:');
  if (!groupName) return;

  const groups = appState.getPlayerGroups();
  const newGroup = {
    id: `group-${Date.now()}`,
    name: groupName,
    players: Array.from(selection)
  };

  groups.push(newGroup);
  appState.setPlayerGroups(groups);

  addMessage(`Группа "${groupName}" создана`, 'success');
  clearPlayerSelection();
  renderPlayerGroups();
  ConfigSync.savePlayerGroups();
}

/**
 * Очистить выбор плееров
 */
export function clearPlayerSelection() {
  appState.clearGroupSelection();
  updateGroupSelectionUI();
}

/**
 * Удалить группу
 * @param {string} groupId - ID группы
 */
export function deletePlayerGroup(groupId) {
  const groups = appState.getPlayerGroups();
  const group = groups.find(g => g.id === groupId);

  if (!confirm(`Удалить группу "${group?.name}"?`)) return;

  const newGroups = groups.filter(g => g.id !== groupId);
  appState.setPlayerGroups(newGroups);

  addMessage('Группа удалена', 'success');
  renderPlayerGroups();
  ConfigSync.savePlayerGroups();
}

/**
 * Отрисовать список групп
 */
export function renderPlayerGroups() {
  const container = getElement('player-groups-list');
  if (!container) return;

  const groups = appState.getPlayerGroups();

  if (groups.length === 0) {
    setHTML('player-groups-list', '<p class="empty-state">Нет групп. Выберите плееры и создайте группу.</p>');
    return;
  }

  const html = groups.map(group => `
    <div class="player-group-card">
      <div class="group-info">
        <div class="group-name">${group.name}</div>
        <div class="group-players">${group.players.length} плееров</div>
      </div>
      <div class="group-actions">
        <button class="btn btn-success" onclick="playGroup('${group.id}')">▶ Играть</button>
        <button class="btn btn-danger" onclick="deletePlayerGroup('${group.id}')">Удалить</button>
      </div>
    </div>
  `).join('');

  setHTML('player-groups-list', html);
}

/**
 * Загрузить группы с сервера
 */
export async function loadPlayerGroups() {
  if (window.ConfigAPI) {
    try {
      const config = await window.ConfigAPI.getConfig();
      if (config.playerGroups) {
        appState.setPlayerGroups(config.playerGroups);
        renderPlayerGroups();
      }
    } catch (error) {
      console.error('Ошибка загрузки групп:', error);
    }
  }
}
