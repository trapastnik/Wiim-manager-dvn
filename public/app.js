// Глобальные переменные
let currentVolume = 50;
let isMuted = false;
let isPlaying = false;
let messageCounter = 0;
const MAX_MESSAGES = 50;
let currentTab = 'player';
let activePlayerId = null;
let allPlayers = [];
let allMediaFiles = [];
let playerSelections = {}; // Сохраняем выбор файла для каждого плеера
let playerStatuses = {}; // Статусы всех плееров
let playerDiagnostics = {}; // Диагностическая информация для каждого плеера
let playerLoopModes = {}; // Режимы повтора для каждого плеера (0=no loop, 1=single loop)
let serverInfo = null; // Информация о сервере (IP адреса)
let lastPlayerPositions = {}; // Последние позиции плееров для отслеживания зависаний
let playerManualStops = {}; // Отслеживание ручных остановок плееров
let autoRefreshTimer = null; // Таймер для временного автообновления
let autoRefreshCount = 0; // Счетчик автообновлений
let adaptiveRefreshTimer = null; // Таймер для адаптивного автообновления
let isAnyPlayerPlaying = false; // Флаг - играет ли хотя бы один плеер
let playerGroups = []; // Массив сохранённых групп плееров
let selectedPlayersForGroup = new Set(); // Временный выбор плееров для создания группы
let isDemoMode = false; // Демо-режим для тестирования без реальных устройств
let demoPlayers = []; // Виртуальные плееры для демо-режима
let demoMediaFiles = []; // Виртуальные медиа файлы для демо-режима

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    addMessage('Инициализация...', 'info');

    // Получаем информацию о сервере
    try {
        const response = await fetch('/api/server-info');
        serverInfo = await response.json();
        console.log('Server info:', serverInfo);

        // Проверяем, открыт ли интерфейс через localhost
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            addMessage(`⚠️ Вы используете localhost. Реальный IP сервера: ${serverInfo.primaryAddress}`, 'warning');
            addMessage(`Откройте интерфейс по адресу: http://${serverInfo.primaryAddress}:${serverInfo.port}`, 'info');
        }
    } catch (error) {
        console.error('Failed to get server info:', error);
    }

    loadPlayerSelections();
    loadLoopModes();
    loadPlayerGroups();
    loadPlayers();
    loadMedia();
    refreshAllPlayers();
    // УДАЛЕНО автообновление каждые 3 секунды для снижения нагрузки на Wi-Fi
    // setInterval(refreshAllPlayers, 3000);
});

// === СИСТЕМА СООБЩЕНИЙ ===
function addMessage(text, type = 'info') {
    const container = document.getElementById('system-messages');
    if (!container) return;

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
    const timestamp = `${hours}:${minutes}:${seconds}.${milliseconds}`;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message-item ${type}`;
    messageDiv.textContent = `[${timestamp}] ${text}`;

    container.appendChild(messageDiv);
    messageCounter++;

    if (messageCounter > MAX_MESSAGES) {
        container.removeChild(container.firstChild);
        messageCounter--;
    }

    container.scrollTop = container.scrollHeight;
}

// === УПРАВЛЕНИЕ ВКЛАДКАМИ ===
function switchTab(tabName) {
    // Скрываем все вкладки
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Убираем активность с кнопок
    document.querySelectorAll('.tabs .tab').forEach(btn => {
        btn.classList.remove('active');
    });

    // Показываем выбранную вкладку
    document.getElementById(`tab-${tabName}`).classList.add('active');
    event.target.classList.add('active');

    currentTab = tabName;

    // Обновляем данные при переключении
    if (tabName === 'players') {
        loadPlayers();
    } else if (tabName === 'media') {
        loadMedia();
    } else if (tabName === 'player') {
        refreshAllPlayers();
    } else if (tabName === 'status') {
        refreshIndependentStatus();
    } else if (tabName === 'settings') {
        updateSystemInfo(); // Обновляем информацию о системе при открытии настроек
    }
}

// === УПРАВЛЕНИЕ ПЛЕЕРАМИ ===
async function loadPlayers() {
    try {
        const response = await fetch('/api/players');
        const data = await response.json();

        activePlayerId = data.activePlayer;
        allPlayers = data.players || []; // Обновляем глобальную переменную
        renderPlayers(data.players);
        updateSystemInfo(); // Обновляем информацию о системе
    } catch (error) {
        addMessage(`Ошибка загрузки плееров: ${error.message}`, 'error');
    }
}

function renderPlayers(players) {
    const container = document.getElementById('players-list');

    if (players.length === 0) {
        container.innerHTML = '<p class="empty-state">Нет плееров. Используйте сканер или добавьте вручную.</p>';
        return;
    }

    container.innerHTML = players.map(player => `
        <div class="player-card" data-id="${player.id}">
            <div class="player-info-card">
                <div class="name">${player.name}</div>
                <div class="ip">${player.ip}</div>
            </div>
            <div class="player-actions">
                <button class="btn btn-danger" onclick="removePlayer('${player.id}')">Удалить</button>
            </div>
        </div>
    `).join('');
}

// Замена для функции scanPlayers с анимированным прогрессом

async function scanPlayers() {
    // Не спрашиваем подсеть - она определится автоматически на сервере
    const subnet = undefined; // Сервер автоматически определит подсеть

    // Показываем модальное окно
    const modal = document.getElementById('scan-modal');
    modal.classList.add('active');

    const progressFill = document.getElementById('progress-fill');
    const scanStatus = document.getElementById('scan-status');
    const scanResults = document.getElementById('scan-results');
    const scanResultsList = document.getElementById('scan-results-list');
    const closeBtn = document.getElementById('scan-close-btn');

    // Сброс состояния
    progressFill.style.width = '0%';
    progressFill.style.background = 'linear-gradient(90deg, #667eea, #764ba2)';
    scanStatus.textContent = 'Подготовка к сканированию...';
    scanResults.style.display = 'none';
    scanResultsList.innerHTML = '';
    closeBtn.disabled = true;

    addMessage('Запуск сканирования сети...', 'info');

    try {
        // Начинаем прогресс
        progressFill.style.width = '10%';
        scanStatus.textContent = 'Сканирование локальной сети...';
        addMessage('Сканирование локальной сети (это может занять 30-60 сек)', 'info');

        // Анимация прогресса во время сканирования
        let currentProgress = 10;
        const progressInterval = setInterval(() => {
            if (currentProgress < 90) {
                currentProgress += 1;
                progressFill.style.width = currentProgress + '%';

                // Обновляем статус каждые 10%
                if (currentProgress % 10 === 0) {
                    const percent = Math.round(currentProgress);
                    scanStatus.textContent = `Сканирование локальной сети... ${percent}%`;
                }
            }
        }, 300);

        const startTime = Date.now();
        const response = await fetch('/api/players/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        // Останавливаем анимацию
        clearInterval(progressInterval);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        // Прогресс 95%
        progressFill.style.width = '95%';
        scanStatus.textContent = 'Обработка результатов...';

        const result = await response.json();

        // Прогресс 100%
        progressFill.style.width = '100%';

        if (result.found > 0) {
            const scannedSubnet = result.subnet || 'локальной';
            scanStatus.textContent = `Сканирование завершено за ${elapsed}с! Найдено устройств: ${result.found}`;
            addMessage(`Найдено устройств: ${result.found} в сети ${scannedSubnet}.0/24 за ${elapsed}с`, 'success');

            // Показываем результаты
            scanResults.style.display = 'block';
            scanResultsList.innerHTML = result.devices.map(device => {
                const deviceName = device.data?.DeviceName || 'WiiM Player';
                return `
                    <div class="scan-result-item">
                        <div class="info">
                            <div class="ip">📡 ${device.ip}</div>
                            <div class="status-text">✓ ${deviceName}</div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            scanStatus.textContent = `Сканирование завершено за ${elapsed}с. Устройства не найдены.`;
            addMessage('WiiM устройства не найдены', 'warning');
            scanResults.style.display = 'block';
            const scannedSubnet = result.subnet || 'локальной';
            scanResultsList.innerHTML = '<p style="text-align:center; color:#6b7280; padding:20px;">❌ Не найдено WiiM устройств в сети ' + scannedSubnet + '.0/24<br><br>Убедитесь что:<br>• WiiM плеер включен<br>• Подключен к той же Wi-Fi сети<br>• Используется правильная подсеть</p>';
        }

        // Обновляем список плееров
        setTimeout(() => loadPlayers(), 500);

    } catch (error) {
        if (typeof progressInterval !== 'undefined') {
            clearInterval(progressInterval);
        }
        progressFill.style.width = '100%';
        progressFill.style.background = '#ef4444';
        scanStatus.textContent = `Ошибка: ${error.message}`;
        addMessage(`Ошибка сканирования: ${error.message}`, 'error');
    } finally {
        closeBtn.disabled = false;
    }
}

function closeScanModal() {
    const modal = document.getElementById('scan-modal');
    modal.classList.remove('active');
}

function showAddPlayer() {
    document.getElementById('add-player-form').style.display = 'block';
}

function hideAddPlayer() {
    document.getElementById('add-player-form').style.display = 'none';
    document.getElementById('player-ip').value = '';
    document.getElementById('player-name').value = '';
}

async function addPlayerManual() {
    const ip = document.getElementById('player-ip').value.trim();
    const name = document.getElementById('player-name').value.trim();

    if (!ip) {
        alert('Введите IP адрес');
        return;
    }

    try {
        const response = await fetch('/api/players', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, name })
        });

        if (response.ok) {
            addMessage(`Плеер ${ip} добавлен`, 'success');
            hideAddPlayer();
            loadPlayers();
        }
    } catch (error) {
        addMessage(`Ошибка добавления плеера: ${error.message}`, 'error');
    }
}

async function activatePlayer(playerId) {
    try {
        const response = await fetch(`/api/players/${playerId}/activate`, {
            method: 'POST'
        });

        if (response.ok) {
            addMessage('Плеер активирован', 'success');
            loadPlayers();
            refreshStatus();
        }
    } catch (error) {
        addMessage(`Ошибка активации: ${error.message}`, 'error');
    }
}

async function removePlayer(playerId) {
    if (!confirm('Удалить этот плеер?')) return;

    try {
        const response = await fetch(`/api/players/${playerId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            addMessage('Плеер удален', 'success');
            loadPlayers();
        }
    } catch (error) {
        addMessage(`Ошибка удаления: ${error.message}`, 'error');
    }
}

// === УПРАВЛЕНИЕ ПЛЕЕРОМ (сохраняем существующий код) ===
async function refreshStatus() {
    try {
        const response = await fetch('/api/info');
        const data = await response.json();

        if (data.error) {
            if (data.error !== 'No active player') {
                addMessage(`Ошибка от сервера: ${data.error}`, 'error');
            }
            updateConnectionStatus(false);
            return;
        }

        if (data.status === 200 && data.data) {
            updateUI(data.data);
            updateConnectionStatus(true);
        } else if (response.ok) {
            addMessage(`Неожиданный формат ответа`, 'warning');
            updateConnectionStatus(false);
        } else {
            updateConnectionStatus(false);
        }
    } catch (error) {
        updateConnectionStatus(false);
    }
}

function updateUI(data) {
    document.getElementById('track-title').textContent = data.Title || '—';
    document.getElementById('track-artist').textContent = data.Artist || '—';

    const status = data.status || 'stop';
    document.getElementById('player-state').textContent = status;

    isPlaying = status === 'play';
    document.getElementById('play-pause').textContent = isPlaying ? '⏸' : '▶';

    if (data.vol !== undefined) {
        currentVolume = parseInt(data.vol);
        document.getElementById('volume-slider').value = currentVolume;
        document.getElementById('volume-value').textContent = currentVolume;
    }

    if (data.mute !== undefined) {
        isMuted = data.mute === '1';
        updateMuteButton();
    }
}

function updateConnectionStatus(online) {
    const status = document.getElementById('connection-status');
    status.className = online ? 'status online' : 'status offline';
}

async function control(action) {
    try {
        const response = await fetch(`/api/control/${action}`, {
            method: 'POST'
        });

        if (response.ok) {
            addMessage(`Команда ${action} выполнена`, 'success');
            setTimeout(refreshStatus, 500);
        } else {
            const error = await response.json();
            addMessage(`Ошибка: ${error.error}`, 'error');
        }
    } catch (error) {
        addMessage(`Ошибка команды ${action}: ${error.message}`, 'error');
    }
}

async function togglePlayPause() {
    const action = isPlaying ? 'pause' : 'play';
    await control(action);
}

async function volumeControl(action) {
    try {
        const response = await fetch(`/api/volume/${action}`, {
            method: 'POST'
        });
        if (response.ok) {
            setTimeout(refreshStatus, 300);
        }
    } catch (error) {
        addMessage(`Ошибка регулировки громкости: ${error.message}`, 'error');
    }
}

async function setVolume(value) {
    try {
        document.getElementById('volume-value').textContent = value;

        const response = await fetch('/api/volume/set', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ volume: parseInt(value) })
        });
    } catch (error) {
        addMessage(`Ошибка установки громкости: ${error.message}`, 'error');
    }
}

async function toggleMute() {
    try {
        const action = isMuted ? 'unmute' : 'mute';
        const response = await fetch(`/api/volume/${action}`, {
            method: 'POST'
        });
        if (response.ok) {
            isMuted = !isMuted;
            updateMuteButton();
            setTimeout(refreshStatus, 300);
        }
    } catch (error) {
        addMessage(`Ошибка mute: ${error.message}`, 'error');
    }
}

function updateMuteButton() {
    document.getElementById('mute-btn').textContent = isMuted ? '🔇' : '🔊';
}

// === УПРАВЛЕНИЕ МЕДИА ===
async function loadMedia() {
    try {
        const response = await fetch('/api/media');
        const data = await response.json();

        console.log('Загружены медиа файлы:', data);
        allMediaFiles = data.files || []; // Обновляем глобальную переменную
        renderMedia(allMediaFiles);
        updateBeepSoundOptions(); // Обновляем список звуков для пищалки
        updateSystemInfo(); // Обновляем информацию о системе
    } catch (error) {
        addMessage(`Ошибка загрузки медиа: ${error.message}`, 'error');
    }
}

// Обновление списка звуков для пищалки в настройках
function updateBeepSoundOptions() {
    const beepSelect = document.getElementById('beep-sound-select');
    if (!beepSelect) return;

    // Сохраняем текущий выбор
    const currentValue = beepSelect.value;

    // Очищаем и добавляем опцию по умолчанию
    beepSelect.innerHTML = '<option value="default">По умолчанию (Google TTS "Бип")</option>';

    // Добавляем все медиа файлы
    allMediaFiles.forEach(file => {
        const option = document.createElement('option');
        option.value = file.url; // Используем URL файла
        option.textContent = file.name;
        beepSelect.appendChild(option);
    });

    // Восстанавливаем предыдущий выбор, если он существует
    if (currentValue && Array.from(beepSelect.options).some(opt => opt.value === currentValue)) {
        beepSelect.value = currentValue;
    } else if (appSettings.beepSoundUrl) {
        beepSelect.value = appSettings.beepSoundUrl;
    }
}

function renderMedia(files) {
    const container = document.getElementById('media-list');

    if (!files || files.length === 0) {
        container.innerHTML = '<p class="empty-state">Нет файлов. Загрузите аудио файлы.</p>';
        return;
    }

    container.innerHTML = files.map(file => `
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
}

async function uploadFile(file) {
    if (!file) return;

    addMessage(`Загрузка файла: ${file.name}`, 'info');

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/media/upload', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            addMessage(`Файл ${file.name} загружен`, 'success');
            loadMedia();
        } else {
            addMessage(`Ошибка загрузки файла`, 'error');
        }
    } catch (error) {
        addMessage(`Ошибка загрузки: ${error.message}`, 'error');
    }

    // Сброс input
    document.getElementById('file-upload').value = '';
}

async function deleteMediaFile(filename, displayName) {
    if (!confirm(`Удалить файл "${displayName}"?`)) return;

    try {
        const response = await fetch(`/api/media/${filename}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            addMessage(`Файл "${displayName}" удален`, 'success');
            loadMedia();
            refreshAllPlayers(); // Обновляем плееры чтобы удалить из выпадающих списков
        } else {
            const error = await response.json();
            addMessage(`Ошибка удаления: ${error.error}`, 'error');
        }
    } catch (error) {
        addMessage(`Ошибка удаления: ${error.message}`, 'error');
    }
}

async function playMediaFile(filePath, fileName) {
    try {
        // Получаем полный URL сервера
        const serverUrl = window.location.origin + filePath;

        addMessage(`Воспроизведение: ${fileName}`, 'info');

        const response = await fetch('/api/media/play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileUrl: serverUrl })
        });

        if (response.ok) {
            addMessage(`Файл отправлен на плеер`, 'success');
            setTimeout(refreshStatus, 1000);
        } else {
            const error = await response.json();
            addMessage(`Ошибка: ${error.error}`, 'error');
        }
    } catch (error) {
        addMessage(`Ошибка воспроизведения: ${error.message}`, 'error');
    }
}

// === УТИЛИТЫ ===
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// === МУЛЬТИПЛЕЕР УПРАВЛЕНИЕ ===

// Загрузка выборов из localStorage
function loadPlayerSelections() {
    const saved = localStorage.getItem('playerSelections');
    if (saved) {
        try {
            playerSelections = JSON.parse(saved);
        } catch (e) {
            playerSelections = {};
        }
    }
}

// Debounce таймер для отложенного сохранения
let saveSelectionsTimer = null;

// Сохранение выборов в localStorage с debounce (300ms)
// Это предотвращает частые записи при быстром переключении файлов
function savePlayerSelections() {
    // В демо-режиме не сохраняем в localStorage
    if (isDemoMode) return;

    // Отменяем предыдущий таймер
    if (saveSelectionsTimer) {
        clearTimeout(saveSelectionsTimer);
    }

    // Устанавливаем новый таймер на 300ms
    saveSelectionsTimer = setTimeout(() => {
        localStorage.setItem('playerSelections', JSON.stringify(playerSelections));
        console.log('[STORAGE] Player selections saved (debounced)');
    }, 300);
}

// Загрузка режимов повтора из localStorage
function loadLoopModes() {
    const saved = localStorage.getItem('playerLoopModes');
    if (saved) {
        try {
            playerLoopModes = JSON.parse(saved);
        } catch (e) {
            playerLoopModes = {};
        }
    }
}

// Сохранение режимов повтора в localStorage
function saveLoopModes() {
    localStorage.setItem('playerLoopModes', JSON.stringify(playerLoopModes));
}

// === УПРАВЛЕНИЕ ГРУППАМИ ПЛЕЕРОВ ===

// Загрузка групп из localStorage
function loadPlayerGroups() {
    const saved = localStorage.getItem('playerGroups');
    if (saved) {
        try {
            playerGroups = JSON.parse(saved);
        } catch (e) {
            playerGroups = [];
        }
    }
}

// Сохранение групп в localStorage
function savePlayerGroups() {
    localStorage.setItem('playerGroups', JSON.stringify(playerGroups));
}

// Переключение выбора плеера для группы
function togglePlayerSelection(playerId) {
    if (selectedPlayersForGroup.has(playerId)) {
        selectedPlayersForGroup.delete(playerId);
    } else {
        selectedPlayersForGroup.add(playerId);
    }
    updateGroupSelectionUI();
}

// Обновление UI выбранных плееров
function updateGroupSelectionUI() {
    const count = selectedPlayersForGroup.size;
    const createGroupBtn = document.getElementById('create-group-btn');
    const clearSelectionBtn = document.getElementById('clear-selection-btn');

    if (createGroupBtn) {
        createGroupBtn.disabled = count < 2;
        createGroupBtn.textContent = count > 0 ? `✓ Создать группу (${count})` : '✓ Создать группу';
    }

    if (clearSelectionBtn) {
        clearSelectionBtn.style.display = count > 0 ? 'inline-block' : 'none';
    }

    // Обновляем визуал чекбоксов
    allPlayers.forEach(player => {
        const checkbox = document.getElementById(`group-cb-${player.id}`);
        if (checkbox) {
            checkbox.checked = selectedPlayersForGroup.has(player.id);
        }
    });
}

// Создание новой группы
function createPlayerGroup() {
    if (selectedPlayersForGroup.size < 2) {
        addMessage('Выберите минимум 2 плеера для создания группы', 'warning');
        return;
    }

    const groupName = prompt('Введите название группы:', `Группа ${playerGroups.length + 1}`);
    if (!groupName) return;

    const newGroup = {
        id: `group_${Date.now()}`,
        name: groupName,
        playerIds: Array.from(selectedPlayersForGroup)
    };

    playerGroups.push(newGroup);
    savePlayerGroups();
    selectedPlayersForGroup.clear();

    addMessage(`Группа "${groupName}" создана (${newGroup.playerIds.length} плееров)`, 'success');
    renderPlayerGroups();
    updateGroupSelectionUI();
}

// Очистка выбора
function clearPlayerSelection() {
    selectedPlayersForGroup.clear();
    updateGroupSelectionUI();
}

// Удаление группы
function deletePlayerGroup(groupId) {
    const group = playerGroups.find(g => g.id === groupId);
    if (!group) return;

    if (!confirm(`Удалить группу "${group.name}"?`)) return;

    playerGroups = playerGroups.filter(g => g.id !== groupId);
    savePlayerGroups();

    addMessage(`Группа "${group.name}" удалена`, 'info');
    renderPlayerGroups();
}

// Рендеринг сохранённых групп
function renderPlayerGroups() {
    const container = document.getElementById('player-groups-list');
    if (!container) return;

    if (playerGroups.length === 0) {
        container.innerHTML = '<p class="empty-state">Нет сохранённых групп. Выберите плееры галочками и создайте группу.</p>';
        return;
    }

    container.innerHTML = playerGroups.map(group => {
        const playerNames = group.playerIds.map(id => {
            const player = allPlayers.find(p => p.id === id);
            return player ? player.name : id;
        }).join(', ');

        return `
            <div class="group-card">
                <div class="group-header">
                    <div class="group-name">${group.name}</div>
                    <div class="group-count">${group.playerIds.length} плееров</div>
                </div>
                <div class="group-players">${playerNames}</div>
                <div class="group-controls-wrapper">
                    <div class="group-controls">
                        <button class="btn btn-success btn-small" onclick="playGroup('${group.id}')">▶ Запустить</button>
                        <button class="btn btn-danger btn-small" onclick="stopGroup('${group.id}')">⏹ Остановить</button>
                    </div>
                    <button class="btn btn-secondary btn-small group-delete-btn" onclick="deletePlayerGroup('${group.id}')">🗑 Удалить</button>
                </div>
                <div class="group-volume-control">
                    <label>Громкость группы:</label>
                    <input type="range" min="0" max="100" value="50"
                           oninput="setGroupVolume('${group.id}', this.value)">
                    <span class="group-volume-value">50</span>
                </div>
            </div>
        `;
    }).join('');
}

// Синхронный запуск группы плееров
async function playGroup(groupId) {
    const group = playerGroups.find(g => g.id === groupId);
    if (!group) return;

    const playersWithFiles = group.playerIds.filter(id => playerSelections[id]);

    if (playersWithFiles.length === 0) {
        addMessage(`В группе "${group.name}" нет плееров с выбранными файлами`, 'warning');
        return;
    }

    addMessage(`Синхронный запуск группы "${group.name}" (${playersWithFiles.length} плееров)...`, 'info');

    const startTime = Date.now();
    const promises = playersWithFiles.map(playerId => playPlayer(playerId, true, performance.now()));

    try {
        await Promise.all(promises);
        const elapsed = Date.now() - startTime;
        addMessage(`✓ Группа "${group.name}" запущена за ${elapsed}ms`, 'success');
        startTemporaryAutoRefresh(2, 3000); // Было 5×2с, теперь 2×3с
    } catch (error) {
        addMessage(`Ошибка запуска группы: ${error.message}`, 'error');
    }
}

// Остановка группы плееров
async function stopGroup(groupId) {
    const group = playerGroups.find(g => g.id === groupId);
    if (!group) return;

    addMessage(`Остановка группы "${group.name}"...`, 'info');

    const promises = group.playerIds.map(playerId => stopPlayer(playerId));

    try {
        await Promise.all(promises);
        addMessage(`✓ Группа "${group.name}" остановлена`, 'success');
    } catch (error) {
        addMessage(`Ошибка остановки группы: ${error.message}`, 'error');
    }
}

// Установка громкости для группы
async function setGroupVolume(groupId, volume) {
    const group = playerGroups.find(g => g.id === groupId);
    if (!group) return;

    const volumeDisplay = event.target.parentElement.querySelector('.group-volume-value');
    if (volumeDisplay) volumeDisplay.textContent = volume;

    const promises = group.playerIds.map(playerId => setPlayerVolume(playerId, volume));

    try {
        await Promise.all(promises);
    } catch (error) {
        console.error('Ошибка установки громкости группы:', error);
    }
}

// === ДЕМО-РЕЖИМ ===

// Создание демо-данных
function createDemoData() {
    // Создаём 7 виртуальных плееров
    demoPlayers = [
        { id: 'demo_1', name: 'Гостиная (Левый)', ip: '192.168.0.101', useHttps: true },
        { id: 'demo_2', name: 'Гостиная (Правый)', ip: '192.168.0.102', useHttps: true },
        { id: 'demo_3', name: 'Спальня', ip: '192.168.0.103', useHttps: true },
        { id: 'demo_4', name: 'Кухня', ip: '192.168.0.104', useHttps: true },
        { id: 'demo_5', name: 'Кабинет', ip: '192.168.0.105', useHttps: true },
        { id: 'demo_6', name: 'Ванная', ip: '192.168.0.106', useHttps: true },
        { id: 'demo_7', name: 'Коридор', ip: '192.168.0.107', useHttps: true }
    ];

    // Создаём демо медиа-файлы
    demoMediaFiles = [
        { id: '1', name: 'Диалог - Вопрос.mp3', filename: 'demo_question.mp3', path: '/media/demo_question.mp3', size: 2457600, mimetype: 'audio/mpeg' },
        { id: '2', name: 'Диалог - Ответ.mp3', filename: 'demo_answer.mp3', path: '/media/demo_answer.mp3', size: 2457600, mimetype: 'audio/mpeg' },
        { id: '3', name: 'Ambient - Спальня.mp3', filename: 'demo_ambient.mp3', path: '/media/demo_ambient.mp3', size: 5242880, mimetype: 'audio/mpeg' },
        { id: '4', name: 'Джаз - Кухня.mp3', filename: 'demo_jazz.mp3', path: '/media/demo_jazz.mp3', size: 4194304, mimetype: 'audio/mpeg' },
        { id: '5', name: 'Классика - Кабинет.mp3', filename: 'demo_classical.mp3', path: '/media/demo_classical.mp3', size: 6291456, mimetype: 'audio/mpeg' }
    ];

    // Создаём демо-статусы (некоторые играют, некоторые нет)
    playerStatuses = {
        'demo_1': { status: 'play', vol: 65, Title: 'Демо Трек 1', Artist: 'Демо Исполнитель', curpos: 45000, totlen: 180000, essid: 'MyWiFi', RSSI: '-45', _responseTime: 89 },
        'demo_2': { status: 'play', vol: 65, Title: 'Демо Трек 2', Artist: 'Демо Исполнитель', curpos: 45000, totlen: 180000, essid: 'MyWiFi', RSSI: '-47', _responseTime: 92 },
        'demo_3': { status: 'stop', vol: 50, Title: '', Artist: '', curpos: 0, totlen: 0, essid: 'MyWiFi', RSSI: '-52', _responseTime: 105 },
        'demo_4': { status: 'play', vol: 70, Title: 'Джаз Композиция', Artist: 'Jazz Band', curpos: 120000, totlen: 240000, essid: 'MyWiFi', RSSI: '-55', _responseTime: 110 },
        'demo_5': { status: 'stop', vol: 45, Title: '', Artist: '', curpos: 0, totlen: 0, essid: 'MyWiFi', RSSI: '-60', _responseTime: 125 },
        'demo_6': { status: 'stop', vol: 40, Title: '', Artist: '', curpos: 0, totlen: 0, essid: 'MyWiFi', RSSI: '-58', _responseTime: 115 },
        'demo_7': { status: 'stop', vol: 35, Title: '', Artist: '', curpos: 0, totlen: 0, essid: 'MyWiFi', RSSI: '-50', _responseTime: 95 }
    };

    // Присваиваем файлы плеерам
    playerSelections = {
        'demo_1': '/media/demo_question.mp3',
        'demo_2': '/media/demo_answer.mp3',
        'demo_3': '/media/demo_ambient.mp3',
        'demo_4': '/media/demo_jazz.mp3'
    };
}

// Включение демо-режима
function enableDemoMode() {
    isDemoMode = true;
    createDemoData();

    allPlayers = demoPlayers;
    allMediaFiles = demoMediaFiles;

    addMessage('🎭 Демо-режим активирован! Создано 7 виртуальных плееров и 5 медиа-файлов', 'success');
    addMessage('💡 Все функции работают в демо-режиме, но команды не отправляются на реальные устройства', 'info');

    renderMultiPlayers();
    renderPlayerGroups();
    updateGroupSelectionUI();
    updateLoopAllButton();

    // Обновляем заголовок
    document.querySelector('header h1').innerHTML = 'WiiM Control Center <span style="color:#ef4444;font-size:14px;vertical-align:super">ДЕМО</span>';

    // Скрываем кнопку включения демо, показываем кнопку выключения
    const enableBtn = document.getElementById('enable-demo-btn');
    const disableBtn = document.getElementById('disable-demo-btn');
    if (enableBtn) enableBtn.style.display = 'none';
    if (disableBtn) disableBtn.style.display = 'inline-block';
}

// Выключение демо-режима
function disableDemoMode() {
    isDemoMode = false;

    addMessage('Демо-режим выключен. Перезагрузите страницу для возврата к реальным данным.', 'info');

    // Восстанавливаем заголовок
    document.querySelector('header h1').textContent = 'WiiM Control Center';

    // Скрываем кнопку выключения демо, показываем кнопку включения
    const enableBtn = document.getElementById('enable-demo-btn');
    const disableBtn = document.getElementById('disable-demo-btn');
    if (enableBtn) enableBtn.style.display = 'inline-block';
    if (disableBtn) disableBtn.style.display = 'none';

    // Перезагружаем страницу для чистого старта
    setTimeout(() => location.reload(), 1500);
}

// Анимация прогресса в демо-режиме
function animateDemoProgress() {
    if (!isDemoMode) return;

    // Обновляем позиции играющих плееров
    Object.keys(playerStatuses).forEach(playerId => {
        const status = playerStatuses[playerId];
        if (status.status === 'play' && status.totlen > 0) {
            status.curpos += 1000; // +1 секунда
            if (status.curpos >= status.totlen) {
                status.curpos = 0; // Зацикливание
            }

            // Обновляем только прогресс-бар для этого плеера
            updatePlayerProgress(playerId, status);
        }
    });
}

// Обновление прогресс-бара конкретного плеера без полной перерисовки
function updatePlayerProgress(playerId, status) {
    const playerCard = document.querySelector(`.player-control-card[data-player-id="${playerId}"]`);
    if (!playerCard) return;

    const progressContainer = playerCard.querySelector('.player-progress');
    const progressFill = playerCard.querySelector('.progress-bar-fill');
    const progressTimes = playerCard.querySelectorAll('.progress-time span');

    if (!status || status.totlen === 0) {
        if (progressContainer) progressContainer.style.display = 'none';
        return;
    }

    const curpos = parseInt(status.curpos) || 0;
    const totlen = parseInt(status.totlen) || 0;
    const progress = totlen > 0 ? (curpos / totlen) * 100 : 0;

    const formatTime = (ms) => {
        const seconds = Math.floor(ms / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    if (progressFill) {
        progressFill.style.width = progress + '%';
    }

    if (progressTimes.length >= 2) {
        progressTimes[0].textContent = formatTime(curpos);
        progressTimes[1].textContent = formatTime(totlen);
    }
}

// Запуск анимации демо-режима
let demoAnimationInterval = null;
function startDemoAnimation() {
    if (demoAnimationInterval) clearInterval(demoAnimationInterval);
    demoAnimationInterval = setInterval(animateDemoProgress, 1000); // Обновление каждую секунду
}

// Проверка и автоматический перезапуск трека при включенном режиме повтора
async function checkAndRestartIfNeeded(playerId, statusData) {
    // Проверяем, был ли плеер остановлен вручную
    if (playerManualStops[playerId]) {
        console.log(`[LOOP] ${getPlayerName(playerId)}: Пропускаем автоперезапуск - ручная остановка`);
        return;
    }

    // Проверяем, включен ли режим повтора для этого плеера
    const loopMode = playerLoopModes[playerId];
    if (loopMode !== 2) {
        // Очищаем сохраненную позицию, если режим повтора выключен
        delete lastPlayerPositions[playerId];
        return;
    }

    // Проверяем, есть ли выбранный файл для воспроизведения
    const selectedFile = playerSelections[playerId];
    if (!selectedFile) {
        return;
    }

    // Проверяем статус плеера
    const playerStatus = statusData?.status;
    const curpos = parseInt(statusData?.curpos || 0);
    const totlen = parseInt(statusData?.totlen || 0);

    // Сохраняем текущую позицию для следующей проверки
    const lastPos = lastPlayerPositions[playerId];
    const now = Date.now();

    lastPlayerPositions[playerId] = {
        curpos: curpos,
        status: playerStatus,
        timestamp: now,
        totlen: totlen,
        alreadyRestarted: lastPos?.alreadyRestarted || false
    };

    // Предиктивный перезапуск УДАЛЁН - теперь используется встроенный режим повтора WiiM (loopmode:1)
    // WiiM сам бесконечно повторяет трек без дополнительных команд от сервера!
}

// Проверка и управление адаптивным автообновлением
function checkAndUpdateAdaptiveRefresh() {
    // Проверяем играет ли хотя бы один плеер
    const hasPlayingPlayers = allPlayers.some(player => {
        const status = playerStatuses[player.id];
        return status && status.status === 'play';
    });

    const wasPlaying = isAnyPlayerPlaying;
    isAnyPlayerPlaying = hasPlayingPlayers;

    if (hasPlayingPlayers && !wasPlaying) {
        // Начинаем адаптивное обновление
        console.log('[ADAPTIVE] Обнаружены играющие плееры - запуск адаптивного обновления (каждые 3 сек)');
        startAdaptiveRefresh();
    } else if (!hasPlayingPlayers && wasPlaying) {
        // Останавливаем адаптивное обновление
        console.log('[ADAPTIVE] Нет играющих плееров - остановка адаптивного обновления');
        stopAdaptiveRefresh();
    }
}

// Запуск адаптивного автообновления (только когда плееры играют)
function startAdaptiveRefresh() {
    if (adaptiveRefreshTimer) return; // Уже запущено

    adaptiveRefreshTimer = setInterval(() => {
        if (currentTab === 'player') {
            console.log('[ADAPTIVE] Обновление статусов играющих плееров');
            refreshAllPlayers();
        }
    }, 5000); // Каждые 5 секунд (было 3 секунды)
}

// Остановка адаптивного автообновления
function stopAdaptiveRefresh() {
    if (adaptiveRefreshTimer) {
        clearInterval(adaptiveRefreshTimer);
        adaptiveRefreshTimer = null;
        console.log('[ADAPTIVE] Адаптивное обновление остановлено');
    }
}

// Запуск временного автообновления (например после play/stop)
function startTemporaryAutoRefresh(count = 5, interval = 2000) {
    // Останавливаем предыдущий таймер если он был
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }

    autoRefreshCount = 0;
    console.log(`[AUTO-REFRESH] Запуск временного автообновления: ${count} раз каждые ${interval}ms`);

    autoRefreshTimer = setInterval(() => {
        autoRefreshCount++;
        console.log(`[AUTO-REFRESH] Обновление ${autoRefreshCount}/${count}`);

        refreshAllPlayers();

        if (autoRefreshCount >= count) {
            clearInterval(autoRefreshTimer);
            autoRefreshTimer = null;
            console.log('[AUTO-REFRESH] Временное автообновление завершено');
        }
    }, interval);

    // Также обновляем сразу
    refreshAllPlayers();
}

// Обновление статуса всех плееров
async function refreshAllPlayers() {
    console.log('[REFRESH] Вызвана функция refreshAllPlayers, currentTab:', currentTab);

    if (currentTab !== 'player') {
        console.log('[REFRESH] Пропускаем обновление - не на вкладке player');
        return;
    }

    console.log('[REFRESH] Начинаем обновление статусов плееров...');

    try {
        const [playersRes, mediaRes] = await Promise.all([
            fetch('/api/players'),
            fetch('/api/media')
        ]);

        const playersData = await playersRes.json();
        const mediaData = await mediaRes.json();

        console.log('Players data:', playersData);
        console.log('Media data:', mediaData);

        allPlayers = playersData.players || [];
        allMediaFiles = mediaData.files || [];

        console.log('All players:', allPlayers.length);
        console.log('All media files:', allMediaFiles.length);

        // ОПТИМИЗАЦИЯ: Батчинг запросов по 3 плеера одновременно для снижения нагрузки на WiFi
        const BATCH_SIZE = 3; // Максимум 3 параллельных запроса

        for (let i = 0; i < allPlayers.length; i += BATCH_SIZE) {
            const batch = allPlayers.slice(i, i + BATCH_SIZE);

            const batchPromises = batch.map(async (player) => {
                const startTime = Date.now();
                try {
                    const statusRes = await fetch(`/api/players/${player.id}/status`);
                    const responseTime = Date.now() - startTime;
                    if (statusRes.ok) {
                        const status = await statusRes.json();
                        playerStatuses[player.id] = {
                            ...(status.data || {}),
                            _responseTime: responseTime
                        };

                        // Проверка на автоматический перезапуск при включенном режиме повтора
                        await checkAndRestartIfNeeded(player.id, status.data);
                    } else {
                        playerStatuses[player.id] = { status: 'offline', _responseTime: responseTime };
                    }
                } catch (e) {
                    const responseTime = Date.now() - startTime;
                    playerStatuses[player.id] = { status: 'offline', _responseTime: responseTime };
                }
            });

            // Ждем завершения текущего батча перед следующим
            await Promise.all(batchPromises);
        }

        renderMultiPlayers();
        renderPlayerGroups(); // Обновляем список групп
        updateGroupSelectionUI(); // Обновляем UI выбора для групп
        updateLoopAllButton(); // Обновляем состояние глобальной кнопки
        updateSystemInfo(); // Обновляем информацию о системе

        // Проверяем играет ли хотя бы один плеер
        checkAndUpdateAdaptiveRefresh();

        console.log('[REFRESH] Обновление завершено успешно. Обновлено плееров:', allPlayers.length);
        addMessage(`✅ Статусы обновлены (${allPlayers.length} плееров)`, 'success');
    } catch (error) {
        console.error('[REFRESH] Ошибка обновления плееров:', error);
        addMessage(`Ошибка обновления: ${error.message}`, 'error');
    }
}

// Рендеринг всех плееров
function renderMultiPlayers() {
    const container = document.getElementById('multi-players-list');

    if (allPlayers.length === 0) {
        container.innerHTML = '<p class="empty-state">Нет плееров. Добавьте плееры на вкладке "Устройства".</p>';
        return;
    }

    container.innerHTML = allPlayers.map(player => {
        const status = playerStatuses[player.id] || {};
        const playerState = status.status || 'stop';
        const currentFile = playerSelections[player.id] || '';
        const volume = status.vol !== undefined ? parseInt(status.vol) : 50;
        const responseTime = status._responseTime || 0;
        const loopMode = playerLoopModes[player.id] || 0; // Получаем сохраненный режим повтора

        // Получаем название выбранного файла
        const selectedFile = allMediaFiles.find(f => f.path === currentFile);
        const selectedFileName = selectedFile ? selectedFile.name : '';

        // Проверяем наличие информации о треке
        let trackTitle = status.Title || '';
        const trackArtist = status.Artist || '';

        // Если Title - это URL, используем название выбранного файла
        if (trackTitle && (trackTitle.startsWith('http://') || trackTitle.startsWith('https://') || trackTitle.includes('/media/'))) {
            trackTitle = selectedFileName || trackTitle;
        }

        const hasTrackInfo = trackTitle && trackTitle !== 'Unknown' && !trackTitle.startsWith('http');

        // Определяем качество соединения
        let pingClass = 'good';
        if (responseTime > 1000) pingClass = 'error';
        else if (responseTime > 500) pingClass = 'warning';

        // Получаем диагностическую информацию
        const diag = playerDiagnostics[player.id] || {};

        // Получаем SSID (название Wi-Fi сети роутера, к которой подключен плеер)
        const ssid = status.essid || 'N/A';  // essid - это Wi-Fi сеть роутера
        const bssid = status.BSSID || '';     // BSSID - MAC-адрес роутера
        const rssi = status.RSSI || 'N/A';

        // Определяем качество Wi-Fi сигнала
        let wifiClass = 'good';
        const rssiNum = parseInt(rssi);
        if (!isNaN(rssiNum)) {
            if (rssiNum < -80) wifiClass = 'error';
            else if (rssiNum < -70) wifiClass = 'warning';
        }

        // Данные о прогрессе воспроизведения
        const curpos = parseInt(status.curpos) || 0; // текущая позиция в миллисекундах
        const totlen = parseInt(status.totlen) || 0; // общая длительность в миллисекундах
        const progress = totlen > 0 ? (curpos / totlen) * 100 : 0;

        const formatTime = (ms) => {
            const seconds = Math.floor(ms / 1000);
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        return `
            <div class="player-control-card ${playerState === 'play' ? 'playing' : 'stopped'}" data-player-id="${player.id}">
                <div class="player-card-header">
                    <div class="player-card-title">
                        <input type="checkbox" id="group-cb-${player.id}"
                               onchange="togglePlayerSelection('${player.id}')"
                               class="group-checkbox"
                               title="Выбрать для группы">
                        ${player.name}
                        <span class="player-ping ${pingClass}">${responseTime}ms</span>
                    </div>
                    <div class="player-card-status ${playerState}">
                        ${playerState === 'play' ? '▶ Играет' : playerState === 'pause' ? '⏸ Пауза' : '⏹ Остановлен'}
                    </div>
                </div>

                <div class="player-wifi-info">
                    <span class="wifi-label">📶 Wi-Fi:</span>
                    <span class="wifi-ssid">${ssid}${bssid ? ' (' + bssid + ')' : ''}</span>
                    <span class="wifi-signal ${wifiClass}">${rssi} dBm</span>
                </div>

                ${(playerState === 'play' || playerState === 'pause') && totlen > 0 ? `
                    <div class="player-progress">
                        <div class="progress-bar-container">
                            <div class="progress-bar-fill" style="width: ${progress}%"></div>
                        </div>
                        <div class="progress-time">
                            <span>${formatTime(curpos)}</span>
                            <span>${formatTime(totlen)}</span>
                        </div>
                    </div>
                ` : ''}

                ${hasTrackInfo ? `
                    <div class="player-card-track">
                        <div class="player-track-title">${trackTitle}</div>
                        <div class="player-track-artist">${trackArtist}</div>
                    </div>
                ` : ''}

                <div class="player-media-select">
                    <label>Выберите файл для воспроизведения:</label>
                    <select onchange="selectMediaForPlayer('${player.id}', this.value)">
                        <option value="">— Не выбрано —</option>
                        ${allMediaFiles.map(file => `
                            <option value="${file.path}" ${currentFile === file.path ? 'selected' : ''}>
                                ${file.name} (${formatFileSize(file.size)})
                            </option>
                        `).join('')}
                    </select>
                </div>

                <div class="player-card-controls">
                    ${playerState === 'play' ? `
                        <button class="btn btn-warning" onclick="pausePlayer('${player.id}')">
                            ⏸ Пауза
                        </button>
                    ` : `
                        <button class="btn btn-success" onclick="playPlayer('${player.id}')" ${!currentFile ? 'disabled' : ''}>
                            ▶ Играть
                        </button>
                    `}
                    <button class="btn btn-danger" onclick="stopPlayer('${player.id}')">
                        ⏹ Stop
                    </button>
                    <button class="btn btn-info btn-small" onclick="beepPlayer('${player.id}')" title="Воспроизвести звуковой сигнал для идентификации плеера">
                        🔔 Пищалка
                    </button>
                </div>

                <!-- Режим повтора ВСЕГДА включён (loopmode=2), кнопка не нужна -->

                <div class="player-volume-control">
                    <button class="btn btn-small" onclick="adjustVolume('${player.id}', -5)">−</button>
                    <input type="range" min="0" max="100" value="${volume}"
                           oninput="setPlayerVolume('${player.id}', this.value)">
                    <span class="player-volume-value">${volume}</span>
                    <button class="btn btn-small" onclick="adjustVolume('${player.id}', 5)">+</button>
                </div>
            </div>
        `;
    }).join('');
}

// Получение имени плеера по ID
function getPlayerName(playerId) {
    const player = allPlayers.find(p => p.id === playerId);
    return player ? `${player.name} [${playerId.slice(-4)}]` : playerId;
}

// Выбор медиа файла для плеера
function selectMediaForPlayer(playerId, filePath) {
    console.log(`[SELECT] Player: ${playerId}, File: ${filePath}`);

    // Сохраняем выбор
    playerSelections[playerId] = filePath;
    savePlayerSelections();

    // Показываем сообщение
    const fileName = filePath ? allMediaFiles.find(f => f.path === filePath)?.name || filePath : 'Не выбрано';
    addMessage(`Файл выбран для ${getPlayerName(playerId)}: ${fileName}`, 'info');

    console.log(`[SELECT] Selection saved. Current selections:`, playerSelections);

    // НЕ перерисовываем всех плееров - это сбрасывает фокус и состояние select
    // Вместо этого обновляем только кнопку "Играть" для этого плеера
    updatePlayerPlayButton(playerId, filePath);
}

// Обновление кнопки "Играть" для конкретного плеера
function updatePlayerPlayButton(playerId, filePath) {
    const playerCard = document.querySelector(`.player-control-card[data-player-id="${playerId}"]`);
    if (!playerCard) return;

    const controlsDiv = playerCard.querySelector('.player-card-controls');
    if (!controlsDiv) return;

    const status = playerStatuses[playerId];
    const playerState = status?.status || 'stop';

    // Обновляем только если плеер не играет (иначе там кнопка паузы)
    if (playerState !== 'play') {
        const playButton = controlsDiv.querySelector('.btn-success');
        if (playButton) {
            playButton.disabled = !filePath;
        }
    }
}

// Воспроизведение на одном плеере
async function playPlayer(playerId, skipRefresh = false, startTime = null, groupId = null) {
    const t0 = startTime || performance.now();
    const player = allPlayers.find(p => p.id === playerId);
    const playerName = player ? player.name : playerId;

    const filePath = playerSelections[playerId];
    if (!filePath) {
        addMessage('Выберите файл для воспроизведения', 'warning');
        return;
    }

    try {
        // ВАЖНО: WiiM плееру нужен реальный IP адрес, а не localhost
        // Если браузер открыт через localhost, автоматически заменяем на реальный IP
        let serverUrl;

        if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && serverInfo && serverInfo.primaryAddress) {
            // Используем реальный IP сервера
            serverUrl = `http://${serverInfo.primaryAddress}:${serverInfo.port}${filePath}`;
            if (!skipRefresh) {
                addMessage(`Используется реальный IP сервера: ${serverInfo.primaryAddress}`, 'info');
            }
        } else {
            // Используем текущий origin
            serverUrl = window.location.origin + filePath;
        }

        // Сбрасываем флаг ручной остановки при запуске плеера
        delete playerManualStops[playerId];
        console.log(`[PLAY] Сброс флага ручной остановки для: ${getPlayerName(playerId)}`);

        // Сохраняем информацию о команде
        playerDiagnostics[playerId] = {
            lastCommand: 'play',
            lastCommandTime: new Date().toLocaleTimeString(),
            lastFileUrl: serverUrl,
            lastResult: null,
            usingRealIP: serverInfo && serverInfo.primaryAddress && serverUrl.includes(serverInfo.primaryAddress)
        };

        const t1 = performance.now();
        console.log(`[PLAY ${t1.toFixed(3)}ms] ${playerName} [${playerId}]: Sending fetch request (offset: ${(t1-t0).toFixed(3)}ms)`);

        // ВСЕГДА используем loopMode=2 (repeat all) для бесконечного повтора трека
        // Это единственный способ заставить WiiM повторять одиночный файл через play:URL
        const loopMode = 2;

        const response = await fetch(`/api/players/${playerId}/play`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileUrl: serverUrl, loopMode: loopMode, groupId: groupId })
        });

        const t2 = performance.now();
        console.log(`[PLAY ${t2.toFixed(3)}ms] ${playerName} [${playerId}]: Received response (fetch took: ${(t2-t1).toFixed(3)}ms, total: ${(t2-t0).toFixed(3)}ms)`);

        const result = await response.json();

        const t3 = performance.now();
        console.log(`[PLAY ${t3.toFixed(3)}ms] ${playerName} [${playerId}]: Parsed JSON (parse took: ${(t3-t2).toFixed(3)}ms, total: ${(t3-t0).toFixed(3)}ms)`);

        // Сохраняем результат команды
        playerDiagnostics[playerId].lastResult = result;
        playerDiagnostics[playerId].lastResultStatus = result.status;

        if (response.ok) {
            // Логируем детали ответа от WiiM API
            console.log(`[PLAY ${t3.toFixed(3)}ms] ${playerName} [${playerId}]: WiiM Response - HTTP Status=${result.status}, Data=${JSON.stringify(result.data)}`);

            // Добавляем информацию об ответе WiiM в системные сообщения
            const wiimStatus = result.status || 'N/A';
            const wiimData = result.data ? JSON.stringify(result.data) : 'no data';
            addMessage(`▶ Воспроизведение: ${getPlayerName(playerId)}`, 'success');
            addMessage(`  └─ WiiM ответ: HTTP=${wiimStatus}, ${wiimData}`, 'info');

            if (result._debug?.timing) {
                const apiTime = result._debug.timing.apiCall;
                const totalTime = result._debug.timing.total;
                addMessage(`  └─ Время: WiiM API=${apiTime}ms, Всего=${totalTime}ms`, 'info');
                console.log(`[PLAY ${t3.toFixed(3)}ms] ${playerName} [${playerId}]: Debug - API call took ${apiTime}ms, Total ${totalTime}ms`);
            }

            // Обновляем статусы только при индивидуальном запуске
            if (!skipRefresh) {
                startTemporaryAutoRefresh(2, 3000); // 2 обновления каждые 3 секунды (было 5×2с)
            }
        } else {
            addMessage(`Ошибка: ${result.error}`, 'error');
            console.error(`[PLAY ERROR] Player ${playerId}:`, result);
        }
    } catch (error) {
        const tErr = performance.now();
        console.error(`[PLAY ${tErr.toFixed(3)}ms] ${playerName} [${playerId}]: EXCEPTION (offset: ${(tErr-t0).toFixed(3)}ms)`, error);
        addMessage(`Ошибка воспроизведения: ${error.message}`, 'error');

        playerDiagnostics[playerId].lastError = error.message;
    }
}

// Пауза на одном плеере
async function pausePlayer(playerId) {
    try {
        const response = await fetch(`/api/players/${playerId}/pause`, {
            method: 'POST'
        });

        if (response.ok) {
            addMessage(`⏸ Пауза: ${getPlayerName(playerId)}`, 'success');
            startTemporaryAutoRefresh(1, 3000); // 1 обновление через 3 секунды (было 3×2с)
        }
    } catch (error) {
        addMessage(`Ошибка паузы: ${error.message}`, 'error');
    }
}

// Звуковой сигнал для идентификации плеера
async function beepPlayer(playerId) {
    try {
        const status = playerStatuses[playerId];
        const playerState = status?.status || 'stop';

        // Проверяем - если плеер играет, не прерываем воспроизведение
        if (playerState === 'play') {
            addMessage(`⚠️ ${getPlayerName(playerId)}: плеер занят воспроизведением. Остановите плеер чтобы услышать сигнал.`, 'warning');
            return;
        }

        addMessage(`🔔 ${getPlayerName(playerId)}: воспроизведение звукового сигнала...`, 'info');

        // Получаем URL звука из настроек
        const beepUrl = appSettings.beepSoundUrl || 'default';

        // Отправляем запрос на воспроизведение beep
        const response = await fetch(`/api/players/${playerId}/beep`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ beepUrl })
        });

        if (response.ok) {
            addMessage(`✅ ${getPlayerName(playerId)}: сигнал воспроизведен`, 'success');
        } else {
            const error = await response.json();
            addMessage(`Ошибка сигнала: ${error.error}`, 'error');
        }
    } catch (error) {
        addMessage(`Ошибка сигнала: ${error.message}`, 'error');
    }
}

// Остановка на одном плеере
async function stopPlayer(playerId) {
    try {
        // Устанавливаем флаг ручной остановки
        playerManualStops[playerId] = true;
        console.log(`[STOP] Ручная остановка плеера: ${getPlayerName(playerId)}`);

        const response = await fetch(`/api/players/${playerId}/stop`, {
            method: 'POST'
        });

        if (response.ok) {
            addMessage(`⏹ Остановка: ${getPlayerName(playerId)}`, 'success');
            startTemporaryAutoRefresh(1, 3000); // 1 обновление через 3 секунды (было 3×2с)
        }
    } catch (error) {
        addMessage(`Ошибка остановки: ${error.message}`, 'error');
    }
}

// Установка громкости
async function setPlayerVolume(playerId, volume) {
    try {
        await fetch(`/api/players/${playerId}/volume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ volume: parseInt(volume) })
        });
        // Для громкости не нужно много обновлений
        refreshAllPlayers();
    } catch (error) {
        console.error('Ошибка установки громкости:', error);
    }
}

// Регулировка громкости
async function adjustVolume(playerId, delta) {
    const status = playerStatuses[playerId];
    const currentVolume = status?.vol ? parseInt(status.vol) : 50;
    const newVolume = Math.max(0, Math.min(100, currentVolume + delta));
    await setPlayerVolume(playerId, newVolume);
}

// Переключение режима повтора
async function toggleLoopMode(playerId) {
    try {
        // Получаем текущий режим (по умолчанию 0 = без повтора)
        const currentMode = playerLoopModes[playerId] || 0;
        // Переключаем: 0 -> 1 -> 0 (no loop -> single loop -> no loop)
        const newMode = currentMode === 0 ? 1 : 0;

        const response = await fetch(`/api/players/${playerId}/loopmode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: newMode })
        });

        if (response.ok) {
            playerLoopModes[playerId] = newMode;
            saveLoopModes(); // Сохраняем состояние в localStorage
            updateLoopButton(playerId, newMode);
            updateLoopAllButton(); // Обновляем глобальную кнопку

            const modeName = newMode === 0 ? 'Одноразовое' : 'Повтор';
            addMessage(`🔁 ${getPlayerName(playerId)}: ${modeName} воспроизведение`, 'info');
        } else {
            addMessage(`Ошибка установки режима повтора`, 'error');
        }
    } catch (error) {
        console.error('Ошибка переключения режима повтора:', error);
        addMessage(`Ошибка: ${error.message}`, 'error');
    }
}

// Обновление внешнего вида кнопки повтора
function updateLoopButton(playerId, mode) {
    const btn = document.getElementById(`loop-btn-${playerId}`);
    if (!btn) return;

    if (mode === 0) {
        // Одноразовое воспроизведение
        btn.textContent = '▶️ Один раз';
        btn.classList.remove('btn-loop-active');
        btn.classList.add('btn-secondary');
    } else {
        // Повтор
        btn.textContent = '🔁 Повтор';
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-loop-active');
    }
}

// Запустить все плееры
async function playAll() {
    const t0 = performance.now();
    console.log(`[PLAY_ALL ${t0.toFixed(3)}ms] Starting playAll()`);
    console.log(`[PLAY_ALL] All players: ${allPlayers.length}`);
    console.log(`[PLAY_ALL] Player selections:`, playerSelections);

    addMessage('Запуск всех плееров...', 'info');

    // Собираем все плееры, у которых выбран файл И которые НЕ играют
    const playersToStart = allPlayers.filter(player => {
        const hasFile = playerSelections[player.id];
        const isPlaying = playerStatuses[player.id]?.status === 'play';
        console.log(`[PLAY_ALL] Player ${player.name} [${player.id}]: hasFile=${!!hasFile}, isPlaying=${isPlaying}, file=${playerSelections[player.id]}`);

        // Пропускаем уже играющие плееры
        if (isPlaying) {
            console.log(`[PLAY_ALL] Player ${player.name} is already playing, skipping`);
            return false;
        }

        return hasFile;
    });

    console.log(`[PLAY_ALL] Players to start: ${playersToStart.length}`);

    if (playersToStart.length === 0) {
        addMessage('Все плееры уже воспроизводятся или нет выбранных файлов', 'info');
        return;
    }

    // Генерируем groupId для синхронного перезапуска всей группы
    const groupId = `playAll_${Date.now()}`;
    console.log(`[PLAY_ALL] Generated groupId: ${groupId}`);

    // STAGGERED START: запускаем плееры с небольшой задержкой между ними
    // Это снижает нагрузку на WiFi сеть и предотвращает таймауты
    const STAGGER_DELAY = 100; // мс между запусками плееров
    const startTime = Date.now();
    const t1 = performance.now();
    console.log(`[PLAY_ALL ${t1.toFixed(3)}ms] Starting ${playersToStart.length} players with ${STAGGER_DELAY}ms stagger delay`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < playersToStart.length; i++) {
        const player = playersToStart[i];
        const tStart = performance.now();

        try {
            console.log(`[PLAY_ALL ${tStart.toFixed(3)}ms] Starting player #${i+1}/${playersToStart.length}: ${player.name} [${player.id}]`);

            // Показываем прогресс в сообщениях
            addMessage(`⏳ Запуск ${i+1}/${playersToStart.length}: ${player.name}`, 'info');

            // Запускаем плеер с groupId
            await playPlayer(player.id, true, tStart, groupId);
            successCount++;

            // Добавляем задержку перед следующим плеером (кроме последнего)
            if (i < playersToStart.length - 1) {
                await new Promise(resolve => setTimeout(resolve, STAGGER_DELAY));
            }
        } catch (error) {
            console.error(`[PLAY_ALL] Error starting player ${player.name}:`, error);
            errorCount++;
        }
    }

    const elapsed = Date.now() - startTime;
    const t3 = performance.now();
    console.log(`[PLAY_ALL ${t3.toFixed(3)}ms] All players processed in ${elapsed}ms (total offset: ${(t3-t0).toFixed(3)}ms)`);

    // Подсчитываем сколько плееров уже играли
    const alreadyPlayingCount = allPlayers.filter(p =>
        playerSelections[p.id] && playerStatuses[p.id]?.status === 'play'
    ).length - successCount;

    if (errorCount > 0) {
        addMessage(`Запущено ${successCount}/${playersToStart.length} плееров за ${Math.round(elapsed/1000)}s (${errorCount} ошибок${alreadyPlayingCount > 0 ? `, ${alreadyPlayingCount} уже играли` : ''})`, 'warning');
    } else {
        addMessage(`Запущено плееров: ${successCount}/${playersToStart.length} за ${Math.round(elapsed/1000)}s${alreadyPlayingCount > 0 ? ` (${alreadyPlayingCount} уже играли)` : ''}`, 'success');
    }

    // Ждём 1 секунду чтобы плееры успели начать воспроизведение
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Запускаем временное автообновление после запуска всех плееров
    // 2 обновления каждые 3 секунды = 6 секунд мониторинга (снижаем нагрузку на WiFi)
    startTemporaryAutoRefresh(2, 3000);
}

// Остановить все плееры
async function stopAll() {
    addMessage('Остановка всех плееров...', 'info');

    if (allPlayers.length === 0) {
        addMessage('Нет плееров для остановки', 'warning');
        return;
    }

    // Останавливаем все плееры параллельно
    const startTime = Date.now();
    const promises = allPlayers.map(player => stopPlayer(player.id));

    try {
        await Promise.all(promises);
        const elapsed = Date.now() - startTime;
        addMessage(`Все плееры остановлены (${allPlayers.length}) за ${elapsed}ms`, 'success');
    } catch (error) {
        addMessage(`Ошибка при остановке: ${error.message}`, 'error');
    }
}

// Переключение режима повтора для всех плееров
async function toggleLoopModeAll() {
    if (allPlayers.length === 0) {
        addMessage('Нет плееров для переключения режима', 'warning');
        return;
    }

    // Определяем целевой режим: если хотя бы один плеер не в режиме повтора, включаем всем
    // Если все в режиме повтора, выключаем всем
    const anyNotInLoopMode = allPlayers.some(player => playerLoopModes[player.id] !== 1);
    const targetMode = anyNotInLoopMode ? 1 : 0;
    const modeName = targetMode === 1 ? 'Повтор' : 'Одноразовое';

    addMessage(`Установка режима "${modeName}" для всех плееров...`, 'info');

    const startTime = Date.now();
    const promises = allPlayers.map(async (player) => {
        try {
            const response = await fetch(`/api/players/${player.id}/loopmode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: targetMode })
            });

            if (response.ok) {
                playerLoopModes[player.id] = targetMode;
                updateLoopButton(player.id, targetMode);
                return { success: true, playerId: player.id };
            } else {
                return { success: false, playerId: player.id };
            }
        } catch (error) {
            console.error(`Ошибка переключения режима для ${player.id}:`, error);
            return { success: false, playerId: player.id };
        }
    });

    try {
        const results = await Promise.all(promises);
        const elapsed = Date.now() - startTime;
        const successCount = results.filter(r => r.success).length;

        // Сохраняем изменения в localStorage
        saveLoopModes();

        // Обновляем глобальную кнопку
        updateLoopAllButton();

        addMessage(`Режим "${modeName}" установлен для ${successCount}/${allPlayers.length} плееров за ${elapsed}ms`, 'success');
    } catch (error) {
        addMessage(`Ошибка при переключении режима: ${error.message}`, 'error');
    }
}

// Обновление внешнего вида глобальной кнопки режима повтора
function updateLoopAllButton() {
    const btn = document.getElementById('loop-all-btn');
    if (!btn) return;

    // Проверяем, все ли плееры в режиме повтора
    const allInLoopMode = allPlayers.length > 0 && allPlayers.every(player => playerLoopModes[player.id] === 1);

    if (allInLoopMode) {
        btn.textContent = '🔁 Режим повтора: ВКЛ (все)';
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-loop-active');
    } else {
        btn.textContent = '🔁 Режим повтора: ВЫКЛ (все)';
        btn.classList.remove('btn-loop-active');
        btn.classList.add('btn-secondary');
    }
}

// === СТАТИСТИКА СЕРВЕРА ===

let serverStatsData = {};
let statsInterval = null;

// Обновление статистики
async function refreshDiagnostics() {
    if (currentTab !== 'diagnostics') return;

    try {
        // Получаем статистику и информацию о сервере параллельно
        const [statsRes, serverInfoRes] = await Promise.all([
            fetch('/api/stats'),
            fetch('/api/server-info')
        ]);

        serverStatsData = await statsRes.json();
        const serverInfo = await serverInfoRes.json();

        // Добавляем информацию о сервере к статистике
        serverStatsData.serverInfo = serverInfo;

        renderServerStats();
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        addMessage(`Ошибка статистики: ${error.message}`, 'error');
    }
}

// Рендеринг статистики сервера
function renderServerStats() {
    const container = document.getElementById('diagnostics-list');
    const stats = serverStatsData;

    if (!stats.uptime) {
        container.innerHTML = '<p class="empty-state">Загрузка статистики...</p>';
        return;
    }

    // Форматирование uptime
    const uptimeSeconds = Math.floor(stats.uptime / 1000);
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    const uptimeStr = `${hours}ч ${minutes}м ${seconds}с`;

    // Форматирование размеров
    const formatBytes = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    };

    const totalTraffic = stats.traffic.sent + stats.traffic.received;
    const trafficPerSec = totalTraffic / (stats.uptime / 1000);

    container.innerHTML = `
        <div class="stats-grid">
            <div class="stats-card">
                <div class="stats-card-title">⏱️ Uptime</div>
                <div class="stats-card-value-small">${uptimeStr}</div>
            </div>

            <div class="stats-card">
                <div class="stats-card-title">📊 Запросы</div>
                <div class="stats-card-value-small">${stats.requests.total}</div>
                <div class="stats-card-subtitle">${(stats.requests.total / (stats.uptime / 1000)).toFixed(1)}/с</div>
            </div>

            <div class="stats-card">
                <div class="stats-card-title">🎵 Плееры</div>
                <div class="stats-card-value-small">${stats.players.total}</div>
                <div class="stats-card-subtitle">${stats.players.online} онлайн</div>
            </div>

            <div class="stats-card">
                <div class="stats-card-title">📁 Файлы</div>
                <div class="stats-card-value-small">${stats.media.files}</div>
                <div class="stats-card-subtitle">${formatBytes(stats.media.totalSize)}</div>
            </div>
        </div>

        <div class="stats-section">
            <h3>📡 Статистика запросов</h3>
            <div class="stats-requests">
                <div class="stats-request-item">
                    <span class="stats-request-label">Статус плееров:</span>
                    <span class="stats-request-value">${stats.requests.status}</span>
                </div>
                <div class="stats-request-item">
                    <span class="stats-request-label">Управление:</span>
                    <span class="stats-request-value">${stats.requests.control}</span>
                </div>
                <div class="stats-request-item">
                    <span class="stats-request-label">Медиа:</span>
                    <span class="stats-request-value">${stats.requests.media}</span>
                </div>
                <div class="stats-request-item">
                    <span class="stats-request-label">Плееры:</span>
                    <span class="stats-request-value">${stats.requests.players}</span>
                </div>
            </div>
        </div>

        <div class="stats-row">
            <div class="stats-section stats-half">
                <h3>📈 Трафик</h3>
                <div class="stats-traffic">
                    <div class="stats-traffic-item">
                        <div class="stats-traffic-label">↑ Отправлено</div>
                        <div class="stats-traffic-value sent">${formatBytes(stats.traffic.sent)}</div>
                    </div>
                    <div class="stats-traffic-item">
                        <div class="stats-traffic-label">↓ Получено</div>
                        <div class="stats-traffic-value received">${formatBytes(stats.traffic.received)}</div>
                    </div>
                    <div class="stats-traffic-item">
                        <div class="stats-traffic-label">Σ Всего</div>
                        <div class="stats-traffic-value total">${formatBytes(totalTraffic)}</div>
                    </div>
                    <div class="stats-traffic-item">
                        <div class="stats-traffic-label">⚡ Скорость</div>
                        <div class="stats-traffic-value speed">${(trafficPerSec / 1024).toFixed(1)} KB/с</div>
                    </div>
                </div>
            </div>

            <div class="stats-section stats-half">
                <h3>💾 Память</h3>
                <div class="stats-memory">
                    <div class="stats-memory-item">
                        <span class="stats-memory-label">RSS:</span>
                        <span class="stats-memory-value">${formatBytes(stats.memory.rss)}</span>
                    </div>
                    <div class="stats-memory-item">
                        <span class="stats-memory-label">Heap:</span>
                        <span class="stats-memory-value">${formatBytes(stats.memory.heapUsed)}</span>
                    </div>
                    <div class="stats-memory-item">
                        <span class="stats-memory-label">Heap max:</span>
                        <span class="stats-memory-value">${formatBytes(stats.memory.heapTotal)}</span>
                    </div>
                </div>
            </div>
        </div>

        ${renderServerWiFiInfo()}
    `;
}

// Отображение WiFi информации сервера
function renderServerWiFiInfo() {
    const serverInfo = serverStatsData.serverInfo;
    if (!serverInfo || !serverInfo.server) {
        return '';
    }

    const wifi = serverInfo.server.wifi;
    const server = serverInfo.server;

    // Определяем качество сигнала
    let signalClass = 'good';
    let signalQuality = 'Отлично';

    if (wifi.signal && wifi.signal !== 'N/A') {
        const rssi = parseInt(wifi.signal);
        if (rssi >= -50) {
            signalClass = 'excellent';
            signalQuality = 'Отлично';
        } else if (rssi >= -60) {
            signalClass = 'good';
            signalQuality = 'Хорошо';
        } else if (rssi >= -70) {
            signalClass = 'fair';
            signalQuality = 'Средне';
        } else {
            signalClass = 'poor';
            signalQuality = 'Плохо';
        }
    }

    // Форматируем uptime сервера
    let uptimeStr = 'N/A';
    if (server.uptime) {
        const uptimeSeconds = Math.floor(server.uptime);
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        uptimeStr = `${hours}ч ${minutes}м`;
    }

    // Форматируем память
    let memoryStr = 'N/A';
    if (server.memory) {
        const usedPercent = ((server.memory.used / server.memory.total) * 100).toFixed(1);
        memoryStr = `${server.memory.used} MB / ${server.memory.total} MB (${usedPercent}%)`;
    }

    return `
        <div class="stats-section">
            <h3>🖥️ Сервер (${server.platform} ${server.arch})</h3>
            <div class="stats-row">
                <div class="stats-half">
                    <div class="server-info-grid">
                        <div class="server-info-item">
                            <span class="server-info-label">Node.js:</span>
                            <span class="server-info-value">${server.nodeVersion || 'N/A'}</span>
                        </div>
                        <div class="server-info-item">
                            <span class="server-info-label">Uptime:</span>
                            <span class="server-info-value">${uptimeStr}</span>
                        </div>
                        <div class="server-info-item">
                            <span class="server-info-label">Память:</span>
                            <span class="server-info-value">${memoryStr}</span>
                        </div>
                    </div>
                </div>
                <div class="stats-half">
                    <h4 style="margin-top: 0;">📡 WiFi Сервера</h4>
                    <div class="server-wifi-grid">
                        <div class="server-wifi-item">
                            <span class="server-wifi-label">Интерфейс:</span>
                            <span class="server-wifi-value">${wifi.interface || 'N/A'}</span>
                        </div>
                        <div class="server-wifi-item">
                            <span class="server-wifi-label">SSID:</span>
                            <span class="server-wifi-value">${wifi.ssid || 'N/A'}</span>
                        </div>
                        <div class="server-wifi-item">
                            <span class="server-wifi-label">IP адрес:</span>
                            <span class="server-wifi-value">${wifi.ip || 'N/A'}</span>
                        </div>
                        <div class="server-wifi-item">
                            <span class="server-wifi-label">Сигнал:</span>
                            <span class="server-wifi-value signal-${signalClass}">
                                ${wifi.signal || 'N/A'}
                                ${wifi.signal !== 'N/A' ? `(${signalQuality})` : ''}
                            </span>
                        </div>
                        <div class="server-wifi-item">
                            <span class="server-wifi-label">Частота:</span>
                            <span class="server-wifi-value">${wifi.frequency || 'N/A'}</span>
                        </div>
                        <div class="server-wifi-item">
                            <span class="server-wifi-label">Скорость:</span>
                            <span class="server-wifi-value">${wifi.bitrate || 'N/A'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Обновление switchTab для статистики
const originalSwitchTab = switchTab;
window.switchTab = function(tabName) {
    originalSwitchTab(tabName);

    if (tabName === 'diagnostics') {
        refreshDiagnostics();
        // Автообновление каждые 2 секунды
        if (statsInterval) clearInterval(statsInterval);
        statsInterval = setInterval(refreshDiagnostics, 2000);
    } else {
        if (statsInterval) {
            clearInterval(statsInterval);
            statsInterval = null;
        }
    }
};

// === НЕЗАВИСИМЫЙ СТАТУС ПЛЕЕРОВ ===

let independentStatusInterval = null;

async function refreshIndependentStatus() {
    const container = document.getElementById('independent-status-list');

    if (!allPlayers || allPlayers.length === 0) {
        container.innerHTML = '<p class="empty-state">Нет плееров. Добавьте плееры на вкладке "Устройства".</p>';
        return;
    }

    try {
        const statusPromises = allPlayers.map(async (player) => {
            const startTime = Date.now();
            try {
                const response = await fetch(`/api/players/${player.id}/status`);
                const responseTime = Date.now() - startTime;

                if (response.ok) {
                    const result = await response.json();
                    return {
                        player,
                        status: result.data || {},
                        responseTime,
                        error: null
                    };
                } else {
                    return {
                        player,
                        status: null,
                        responseTime,
                        error: 'HTTP ' + response.status
                    };
                }
            } catch (error) {
                return {
                    player,
                    status: null,
                    responseTime: Date.now() - startTime,
                    error: error.message
                };
            }
        });

        const results = await Promise.all(statusPromises);

        container.innerHTML = results.map(({ player, status, responseTime, error }) => {
            const playerState = status?.status || 'unknown';
            const deviceName = status?.DeviceName || player.name; // Реальное имя из устройства!
            const trackTitle = status?.Title || '';
            const trackArtist = status?.Artist || '';
            const volume = status?.vol || 0;

            let stateClass = 'stopped';
            let stateText = '⏹ Остановлен';
            if (playerState === 'play') {
                stateClass = 'playing';
                stateText = '▶ Играет';
            } else if (playerState === 'pause') {
                stateClass = 'paused';
                stateText = '⏸ Пауза';
            }

            let pingClass = 'good';
            if (responseTime > 1000) pingClass = 'error';
            else if (responseTime > 500) pingClass = 'warning';

            return `
                <div class="status-card ${stateClass}">
                    <div class="status-header">
                        <div class="status-device-name">${deviceName}</div>
                        <div class="status-badges">
                            <span class="player-ping ${pingClass}">${responseTime}ms</span>
                            <span class="status-badge ${stateClass}">${stateText}</span>
                        </div>
                    </div>

                    <div class="status-ip">${player.ip}</div>

                    ${error ? `
                        <div class="status-error">❌ Ошибка: ${error}</div>
                    ` : ''}

                    ${status && trackTitle && trackTitle !== 'Unknown' ? `
                        <div class="status-track">
                            <div class="status-track-title">${trackTitle}</div>
                            <div class="status-track-artist">${trackArtist}</div>
                        </div>
                    ` : ''}

                    ${status ? `
                        <div class="status-details">
                            <div class="status-detail-item">
                                <span class="status-detail-label">Громкость:</span>
                                <span class="status-detail-value">${volume}%</span>
                            </div>
                            ${status.curpos && status.totlen ? `
                                <div class="status-detail-item">
                                    <span class="status-detail-label">Позиция:</span>
                                    <span class="status-detail-value">${formatTime(parseInt(status.curpos))} / ${formatTime(parseInt(status.totlen))}</span>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

    } catch (error) {
        container.innerHTML = `<p class="empty-state">Ошибка: ${error.message}</p>`;
    }
}

function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Автообновление для вкладки статуса
window.addEventListener('load', () => {
    const observer = new MutationObserver(() => {
        const statusTab = document.getElementById('tab-status');
        if (statusTab && statusTab.classList.contains('active')) {
            if (!independentStatusInterval) {
                refreshIndependentStatus();
                independentStatusInterval = setInterval(refreshIndependentStatus, 2000);
            }
        } else {
            if (independentStatusInterval) {
                clearInterval(independentStatusInterval);
                independentStatusInterval = null;
            }
        }
    });

    observer.observe(document.getElementById('tab-status'), {
        attributes: true,
        attributeFilter: ['class']
    });
});

// === ИЗМЕНЕНИЕ РАЗМЕРА ПАНЕЛИ СООБЩЕНИЙ ===

(function() {
    const panel = document.getElementById('messages-panel');
    const handle = document.getElementById('resize-handle');
    
    if (!panel || !handle) return;
    
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    
    // Загрузка сохраненной ширины
    const savedWidth = localStorage.getItem('messagesPanelWidth');
    if (savedWidth) {
        panel.style.width = savedWidth + 'px';
    }
    
    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = panel.offsetWidth;
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const diff = startX - e.clientX;
        const newWidth = startWidth + diff;
        
        // Ограничение по min/max ширине
        if (newWidth >= 250 && newWidth <= 800) {
            panel.style.width = newWidth + 'px';
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // Сохранение ширины
            localStorage.setItem('messagesPanelWidth', panel.offsetWidth);
        }
    });
})();

// === НАСТРОЙКИ СИСТЕМЫ ===

// Глобальные переменные настроек с значениями по умолчанию
let appSettings = {
    beepSoundUrl: 'default'     // URL звука для пищалки (default = Google TTS)
};

// Загрузка настроек из localStorage
function loadSettings() {
    const saved = localStorage.getItem('appSettings');
    if (saved) {
        try {
            appSettings = JSON.parse(saved);
        } catch (e) {
            console.error('Ошибка загрузки настроек:', e);
        }
    }
    updateSettingsUI();
}

// Обновление UI настроек
function updateSettingsUI() {
    const beepSoundSelect = document.getElementById('beep-sound-select');

    if (beepSoundSelect) {
        beepSoundSelect.value = appSettings.beepSoundUrl || 'default';
    }

    // Обновляем счетчики в секции информации
    const playersCount = document.getElementById('info-players-count');
    const mediaCount = document.getElementById('info-media-count');

    if (playersCount) playersCount.textContent = allPlayers.length;
    if (mediaCount) mediaCount.textContent = allMediaFiles.length;
}

// Сохранение настроек
function saveSettings() {
    const beepSoundSelect = document.getElementById('beep-sound-select');
    const beepSoundUrl = beepSoundSelect ? beepSoundSelect.value : 'default';

    // Сохранение
    appSettings.beepSoundUrl = beepSoundUrl;

    localStorage.setItem('appSettings', JSON.stringify(appSettings));
    updateSettingsUI();

    addMessage('✅ Настройки сохранены успешно', 'success');
    console.log('[SETTINGS] Новые настройки:', appSettings);
}

// Сброс настроек к значениям по умолчанию
function resetSettings() {
    if (!confirm('Вы уверены, что хотите сбросить все настройки к значениям по умолчанию?')) {
        return;
    }

    appSettings = {
        beepSoundUrl: 'default'
    };

    localStorage.setItem('appSettings', JSON.stringify(appSettings));
    updateSettingsUI();

    addMessage('🔄 Настройки сброшены к значениям по умолчанию', 'info');
    console.log('[SETTINGS] Сброс к значениям по умолчанию');
}

// Функция обновления информации о системе
function updateSystemInfo() {
    const playersCountEl = document.getElementById('info-players-count');
    const mediaCountEl = document.getElementById('info-media-count');

    if (playersCountEl) {
        playersCountEl.textContent = allPlayers ? allPlayers.length : 0;
    }

    if (mediaCountEl) {
        mediaCountEl.textContent = allMediaFiles ? allMediaFiles.length : 0;
    }
}

// Обработчики изменения полей ввода (для live обновления отображения)
document.addEventListener('DOMContentLoaded', () => {
    loadSettings(); // Загружаем настройки при старте

    const loopThreshold = document.getElementById('loop-threshold');
    const loopResetThreshold = document.getElementById('loop-reset-threshold');

    if (loopThreshold) {
        loopThreshold.addEventListener('input', (e) => {
            updateSettingDisplay('loop-threshold', e.target.value);
        });
    }

    if (loopResetThreshold) {
        loopResetThreshold.addEventListener('input', (e) => {
            updateSettingDisplay('loop-reset-threshold', e.target.value);
        });
    }

    // Обновляем информацию о системе сразу при загрузке
    updateSystemInfo();
});
