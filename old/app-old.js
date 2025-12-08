let currentVolume = 50;
let isMuted = false;
let isPlaying = false;
let messageCounter = 0;
const MAX_MESSAGES = 50;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    addMessage('Инициализация...', 'info');
    refreshStatus();
    // Обновление статуса каждые 3 секунды
    setInterval(refreshStatus, 3000);
});

// Добавление системного сообщения
function addMessage(text, type = 'info') {
    const container = document.getElementById('system-messages');
    const timestamp = new Date().toLocaleTimeString('ru-RU');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-item ${type}`;
    messageDiv.textContent = `[${timestamp}] ${text}`;

    container.appendChild(messageDiv);
    messageCounter++;

    // Ограничение количества сообщений
    if (messageCounter > MAX_MESSAGES) {
        container.removeChild(container.firstChild);
        messageCounter--;
    }

    // Автопрокрутка вниз
    container.scrollTop = container.scrollHeight;
}

// Обновление статуса плеера
async function refreshStatus() {
    try {
        addMessage('Запрос статуса плеера...', 'info');
        const response = await fetch('/api/info');
        const data = await response.json();

        // Проверка на ошибку от сервера
        if (data.error) {
            addMessage(`Ошибка от сервера: ${data.error}`, 'error');
            updateConnectionStatus(false);
            return;
        }

        // Проверка успешного ответа
        if (data.status === 200 && data.data) {
            addMessage(`Статус получен: ${data.data.status || 'unknown'}`, 'success');
            addMessage(`Трек: ${data.data.Title || 'неизвестно'} - ${data.data.Artist || 'неизвестно'}`, 'info');
            updateUI(data.data);
            updateConnectionStatus(true);
        } else if (response.ok) {
            // Ответ пришел, но структура не та, что ожидалась
            addMessage(`Неожиданный формат ответа: ${JSON.stringify(data).substring(0, 100)}`, 'warning');
            updateConnectionStatus(false);
        } else {
            addMessage(`HTTP ошибка: ${response.status}`, 'error');
            updateConnectionStatus(false);
        }
    } catch (error) {
        addMessage(`Ошибка подключения: ${error.message}`, 'error');
        console.error('Error fetching status:', error);
        updateConnectionStatus(false);
    }
}

// Обновление UI
function updateUI(data) {
    // Обновление информации о треке
    document.getElementById('track-title').textContent = data.Title || '—';
    document.getElementById('track-artist').textContent = data.Artist || '—';

    // Обновление состояния плеера
    const status = data.status || 'stop';
    document.getElementById('player-state').textContent = status;

    // Обновление кнопки play/pause
    isPlaying = status === 'play';
    const playPauseBtn = document.getElementById('play-pause');
    playPauseBtn.textContent = isPlaying ? '⏸' : '▶';

    // Обновление громкости
    if (data.vol !== undefined) {
        currentVolume = parseInt(data.vol);
        document.getElementById('volume-slider').value = currentVolume;
        document.getElementById('volume-value').textContent = currentVolume;
    }

    // Обновление состояния mute
    if (data.mute !== undefined) {
        isMuted = data.mute === '1';
        updateMuteButton();
    }
}

// Обновление статуса подключения
function updateConnectionStatus(online) {
    const status = document.getElementById('connection-status');
    status.className = online ? 'status online' : 'status offline';
}

// Управление воспроизведением
async function control(action) {
    try {
        addMessage(`Выполнение команды: ${action}`, 'info');
        const response = await fetch(`/api/control/${action}`, {
            method: 'POST'
        });

        if (response.ok) {
            addMessage(`Команда ${action} выполнена успешно`, 'success');
            setTimeout(refreshStatus, 500);
        } else {
            addMessage(`Ошибка выполнения ${action}: HTTP ${response.status}`, 'error');
        }
    } catch (error) {
        addMessage(`Ошибка команды ${action}: ${error.message}`, 'error');
        console.error(`Error executing ${action}:`, error);
    }
}

// Toggle Play/Pause
async function togglePlayPause() {
    const action = isPlaying ? 'pause' : 'play';
    await control(action);
}

// Управление громкостью
async function volumeControl(action) {
    try {
        addMessage(`Регулировка громкости: ${action}`, 'info');
        const response = await fetch(`/api/volume/${action}`, {
            method: 'POST'
        });
        if (response.ok) {
            addMessage(`Громкость ${action === 'up' ? 'увеличена' : 'уменьшена'}`, 'success');
        }
        setTimeout(refreshStatus, 300);
    } catch (error) {
        addMessage(`Ошибка регулировки громкости: ${error.message}`, 'error');
        console.error(`Error with volume ${action}:`, error);
    }
}

async function setVolume(value) {
    try {
        document.getElementById('volume-value').textContent = value;

        const response = await fetch('/api/volume/set', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ volume: parseInt(value) })
        });

        if (response.ok) {
            addMessage(`Громкость установлена: ${value}`, 'success');
        }
    } catch (error) {
        addMessage(`Ошибка установки громкости: ${error.message}`, 'error');
        console.error('Error setting volume:', error);
    }
}

// Toggle Mute
async function toggleMute() {
    try {
        const action = isMuted ? 'unmute' : 'mute';
        addMessage(`${action === 'mute' ? 'Отключение' : 'Включение'} звука`, 'info');
        const response = await fetch(`/api/volume/${action}`, {
            method: 'POST'
        });
        if (response.ok) {
            addMessage(`Звук ${action === 'mute' ? 'отключен' : 'включен'}`, 'success');
        }
        isMuted = !isMuted;
        updateMuteButton();
        setTimeout(refreshStatus, 300);
    } catch (error) {
        addMessage(`Ошибка mute: ${error.message}`, 'error');
        console.error('Error toggling mute:', error);
    }
}

function updateMuteButton() {
    const muteBtn = document.getElementById('mute-btn');
    muteBtn.textContent = isMuted ? '🔇' : '🔊';
}
