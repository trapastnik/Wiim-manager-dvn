import express from 'express';
import multer from 'multer';
import WiiMClient from './wiim-client.js';
import NetworkScanner from './network-scanner.js';
import storage from './storage.js';
import serverInfo from './server-info.js';
import { readFileSync, readdirSync, statSync, unlinkSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { networkInterfaces } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загрузка .env файла
function loadEnv() {
  try {
    const envPath = join(__dirname, '.env');
    const envFile = readFileSync(envPath, 'utf-8');
    const lines = envFile.split('\\n');
    
    lines.forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        process.env[key.trim()] = value;
      }
    });
  } catch (error) {
    console.log('Warning: .env file not found, using defaults');
  }
}

loadEnv();

// Утилита для логирования с миллисекундами
function logWithMs(message) {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  const timestamp = `${hours}:${minutes}:${seconds}.${milliseconds}`;
  console.log(`[${timestamp}] ${message}`);
}

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use('/media', express.static('media'));

// Конфигурация Multer для загрузки файлов
const upload = multer({
  dest: 'media/',
  limits: { fileSize: 100 * 1024 * 1024 }
});

// Конфигурация
const PORT = process.env.PORT || 3000;
const USE_HTTPS = process.env.WIIM_USE_HTTPS !== 'false';
const REQUEST_TIMEOUT = parseInt(process.env.WIIM_REQUEST_TIMEOUT) || 5000;
const ENABLE_STATS = process.env.ENABLE_STATS === 'true';

// Мапа клиентов для каждого плеера
const playerClients = new Map();

// Статистика сервера
const serverStats = {
  startTime: Date.now(),
  requests: {
    total: 0,
    status: 0,
    control: 0,
    media: 0,
    players: 0
  },
  traffic: {
    sent: 0,
    received: 0
  },
  errors: 0,
  activeStreams: 0
};

// Middleware для подсчета статистики (опционально, можно отключить для производительности)
if (ENABLE_STATS) {
  console.log('📊 Статистика сервера ВКЛЮЧЕНА (ENABLE_STATS=true)');
  app.use((req, res, next) => {
    serverStats.requests.total++;

    // Подсчет по категориям
    if (req.path.includes('/status') || req.path.includes('/info')) serverStats.requests.status++;
    else if (req.path.includes('/control') || req.path.includes('/volume')) serverStats.requests.control++;
    else if (req.path.includes('/media')) serverStats.requests.media++;
    else if (req.path.includes('/players')) serverStats.requests.players++;

    // Подсчет трафика
    const startTime = Date.now();
    const originalSend = res.send;

    res.send = function(data) {
      const responseSize = Buffer.byteLength(JSON.stringify(data));
      serverStats.traffic.sent += responseSize;
      return originalSend.call(this, data);
    };

    if (req.body) {
      serverStats.traffic.received += Buffer.byteLength(JSON.stringify(req.body));
    }

    next();
  });
} else {
  console.log('⚡ Статистика сервера ОТКЛЮЧЕНА для максимальной производительности');
}

// Инициализация клиентов из сохраненных плееров
const initializePlayers = () => {
  const data = storage.getPlayers();
  console.log('=== Инициализация плееров ===');
  data.players.forEach(player => {
    playerClients.set(player.id, new WiiMClient(player.ip, USE_HTTPS, REQUEST_TIMEOUT));
    console.log(`  ID: ${player.id} → IP: ${player.ip} → Имя: ${player.name}`);
  });
  console.log(`Загружено плееров: ${data.players.length}`);
  console.log(`Активный плеер: ${data.activePlayer}`);
};

initializePlayers();

// ================================================
// СИСТЕМА АВТОПОВТОРА ТРЕКОВ
// ================================================

// Хранилище состояния плееров для автоповтора
const autoRepeatState = new Map(); // playerId -> { lastUrl, monitoring: true/false, groupId: string|null }

// Мониторинг плеера для автоповтора
async function monitorPlayerForRepeat(playerId) {
  const state = autoRepeatState.get(playerId);
  if (!state || !state.monitoring) return;

  const client = playerClients.get(playerId);
  if (!client) {
    logWithMs(`[AUTO-REPEAT] Player ${playerId} client not found, stopping monitor`);
    stopMonitoring(playerId);
    return;
  }

  try {
    const status = await client.getPlayerStatus();
    const playerStatus = status.data?.status;
    const curpos = parseInt(status.data?.curpos) || 0;
    const totlen = parseInt(status.data?.totlen) || 0;

    // Если плеер остановлен и трек закончился - перезапускаем
    if (playerStatus === 'stop' && curpos >= totlen && totlen > 0) {
      logWithMs(`[AUTO-REPEAT] Player ${playerId}: Track ended (${curpos}ms >= ${totlen}ms), restarting...`);

      // Перезапускаем тот же файл
      if (state.lastUrl) {
        const playCommand = '/httpapi.asp?command=setPlayerCmd:play:' + encodeURIComponent(state.lastUrl);
        await client.request(playCommand);
        logWithMs(`[AUTO-REPEAT] Player ${playerId}: Restarted successfully`);

        // Продолжаем мониторинг через 1 секунду
        setTimeout(() => monitorPlayerForRepeat(playerId), 1000);
      } else {
        logWithMs(`[AUTO-REPEAT] Player ${playerId}: No URL to restart`);
        stopMonitoring(playerId);
      }
    } else if (playerStatus === 'play' || playerStatus === 'load' || playerStatus === 'stop') {
      // Плеер играет, загружается, или остановлен (но трек ещё не закончился)
      // Продолжаем мониторинг
      setTimeout(() => monitorPlayerForRepeat(playerId), 500);
    } else {
      // Неизвестный статус - продолжаем мониторинг на всякий случай
      logWithMs(`[AUTO-REPEAT] Player ${playerId}: Unknown status '${playerStatus}', continuing monitor`);
      setTimeout(() => monitorPlayerForRepeat(playerId), 1000);
    }
  } catch (error) {
    logWithMs(`[AUTO-REPEAT] Player ${playerId}: Monitor error: ${error.message}`);
    // При ошибке пробуем ещё раз через 2 секунды
    setTimeout(() => monitorPlayerForRepeat(playerId), 2000);
  }
}

// Запуск мониторинга для плеера
function startMonitoring(playerId, fileUrl, groupId = null) {
  logWithMs(`[AUTO-REPEAT] Starting monitor for player ${playerId}${groupId ? ` (group: ${groupId})` : ''}`);
  autoRepeatState.set(playerId, {
    lastUrl: fileUrl,
    monitoring: true,
    groupId: groupId
  });

  // Начинаем мониторинг через 1 секунду после запуска
  setTimeout(() => monitorPlayerForRepeat(playerId), 1000);
}

// Остановка мониторинга для плеера
function stopMonitoring(playerId) {
  const state = autoRepeatState.get(playerId);
  if (state) {
    state.monitoring = false;
    logWithMs(`[AUTO-REPEAT] Stopped monitor for player ${playerId}`);
  }
}

// ================================================
// ГЛОБАЛЬНЫЙ КОНТРОЛЛЕР АВТОПОВТОРА
// Проверяет каждые 15 секунд все плееры и перезапускает застрявшие
// ================================================

// Хранилище для отслеживания ручных остановок
const manualStops = new Set(); // playerId -> была ли ручная команда стоп

// Глобальный контроллер - проверяет все плееры каждые 15 секунд
async function globalRepeatController() {
  const activeCount = autoRepeatState.size;
  logWithMs(`[GLOBAL-CTRL] Check cycle - tracking ${activeCount} players`);

  // Группируем плееры по groupId
  const groupedPlayers = new Map(); // groupId -> [playerIds]
  const soloPlayers = []; // плееры без группы

  for (const [playerId, state] of autoRepeatState.entries()) {
    if (!state.monitoring || manualStops.has(playerId)) continue;

    if (state.groupId) {
      if (!groupedPlayers.has(state.groupId)) {
        groupedPlayers.set(state.groupId, []);
      }
      groupedPlayers.get(state.groupId).push(playerId);
    } else {
      soloPlayers.push(playerId);
    }
  }

  // Проверяем соло-плееры
  for (const playerId of soloPlayers) {
    await checkAndRestartPlayer(playerId, null);
  }

  // Проверяем группы
  for (const [groupId, playerIds] of groupedPlayers.entries()) {
    logWithMs(`[GLOBAL-CTRL] Checking group ${groupId} with ${playerIds.length} players`);

    // Проверяем статусы всех плееров в группе
    const groupStatuses = [];
    for (const playerId of playerIds) {
      const status = await checkPlayerStatus(playerId);
      groupStatuses.push({ playerId, status });
    }

    // Если хотя бы ОДИН плеер застрял или закончился - перезапускаем ВСЮ группу
    const needsRestart = groupStatuses.some(({ status }) => status && status.needsRestart);

    if (needsRestart) {
      logWithMs(`[GLOBAL-CTRL] Group ${groupId}: At least one player needs restart, restarting ALL ${playerIds.length} players`);

      // Перезапускаем всю группу с задержкой 100ms между плеерами
      for (let i = 0; i < playerIds.length; i++) {
        const playerId = playerIds[i];
        const state = autoRepeatState.get(playerId);
        if (!state || !state.lastUrl) continue;

        try {
          const client = playerClients.get(playerId);
          if (client) {
            const playCommand = '/httpapi.asp?command=setPlayerCmd:play:' + encodeURIComponent(state.lastUrl);
            await client.request(playCommand);
            logWithMs(`[GLOBAL-CTRL] Group ${groupId}: Restarted player ${i+1}/${playerIds.length}`);

            // Задержка между плеерами (кроме последнего)
            if (i < playerIds.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        } catch (error) {
          logWithMs(`[GLOBAL-CTRL] Group ${groupId}: Error restarting player ${playerId}: ${error.message}`);
        }
      }
    }
  }

  // Следующая проверка через 15 секунд
  setTimeout(globalRepeatController, 15000);
}

// Проверка статуса одного плеера
async function checkPlayerStatus(playerId) {
  const state = autoRepeatState.get(playerId);
  if (!state || !state.monitoring || manualStops.has(playerId)) return null;

  const client = playerClients.get(playerId);
  if (!client) return null;

  try {
    const status = await client.getPlayerStatus();
    const playerStatus = status.data?.status;
    const curpos = parseInt(status.data?.curpos) || 0;
    const totlen = parseInt(status.data?.totlen) || 0;

    // Проверяем: застрял или закончился
    const needsRestart = (playerStatus === 'stop' && totlen > 0) &&
                         (curpos < totlen || curpos >= totlen);

    return { playerStatus, curpos, totlen, needsRestart };
  } catch (error) {
    logWithMs(`[GLOBAL-CTRL] Player ${playerId}: Status check error: ${error.message}`);
    return null;
  }
}

// Проверка и перезапуск одного плеера (для соло-плееров)
async function checkAndRestartPlayer(playerId, groupId) {
  const state = autoRepeatState.get(playerId);
  if (!state || !state.monitoring || manualStops.has(playerId)) return;

  const client = playerClients.get(playerId);
  if (!client || !state.lastUrl) return;

  try {
    const status = await client.getPlayerStatus();
    const playerStatus = status.data?.status;
    const curpos = parseInt(status.data?.curpos) || 0;
    const totlen = parseInt(status.data?.totlen) || 0;

    // КРИТИЧНО: Если плеер в stop и трек НЕ закончился (застрял) - перезапускаем
    if (playerStatus === 'stop' && curpos < totlen && totlen > 0) {
      logWithMs(`[GLOBAL-CTRL] Player ${playerId}: STUCK in stop (${curpos}ms < ${totlen}ms), force restarting...`);
      const playCommand = '/httpapi.asp?command=setPlayerCmd:play:' + encodeURIComponent(state.lastUrl);
      await client.request(playCommand);
      logWithMs(`[GLOBAL-CTRL] Player ${playerId}: Force restarted successfully`);
    }
    // Также перезапускаем если трек закончился
    else if (playerStatus === 'stop' && curpos >= totlen && totlen > 0) {
      logWithMs(`[GLOBAL-CTRL] Player ${playerId}: Track ended (${curpos}ms >= ${totlen}ms), restarting...`);
      const playCommand = '/httpapi.asp?command=setPlayerCmd:play:' + encodeURIComponent(state.lastUrl);
      await client.request(playCommand);
      logWithMs(`[GLOBAL-CTRL] Player ${playerId}: Restarted successfully`);
    }
  } catch (error) {
    // Игнорируем ошибки в глобальном контроллере - не критично
    logWithMs(`[GLOBAL-CTRL] Player ${playerId}: Check error: ${error.message}`);
  }
}

// Запускаем глобальный контроллер через 20 секунд после старта сервера
setTimeout(() => {
  logWithMs('[GLOBAL-CTRL] Starting global repeat controller (check interval: 15s)');
  globalRepeatController();
}, 20000);

// ================================================
// АВТОВОССТАНОВЛЕНИЕ ВОСПРОИЗВЕДЕНИЯ ПРИ СТАРТЕ
// ================================================

// Функция получения primary IP сервера
function getServerPrimaryIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

async function autoRestorePlayback() {
  logWithMs('[AUTO-RESTORE] Starting playback restoration...');

  try {
    const config = storage.getPlaybackConfig();
    const playerSelections = config.playerSelections || {};
    const playerGroups = config.playerGroups || [];

    const playerIds = Object.keys(playerSelections);
    logWithMs(`[AUTO-RESTORE] Found ${playerIds.length} players with file assignments`);
    logWithMs(`[AUTO-RESTORE] Found ${playerGroups.length} groups`);

    if (playerIds.length === 0) {
      logWithMs('[AUTO-RESTORE] No players to restore');
      return;
    }

    // Запускаем группы последовательно
    if (playerGroups.length > 0) {
      for (let groupIndex = 0; groupIndex < playerGroups.length; groupIndex++) {
        const group = playerGroups[groupIndex];
        const groupPlayerIds = group.playerIds.filter(id => playerSelections[id]); // только плееры с файлами

        if (groupPlayerIds.length === 0) {
          logWithMs(`[AUTO-RESTORE] Group "${group.name}": no players with files, skipping`);
          continue;
        }

        const groupId = `group_${group.name}_${Date.now()}`;
        logWithMs(`[AUTO-RESTORE] Starting group ${groupIndex+1}/${playerGroups.length} "${group.name}" (${groupId}) with ${groupPlayerIds.length} players`);

        for (let i = 0; i < groupPlayerIds.length; i++) {
          const playerId = groupPlayerIds[i];
          const filePath = playerSelections[playerId];
          const client = playerClients.get(playerId);

          if (!client) {
            logWithMs(`[AUTO-RESTORE] Player ${playerId} not found, skipping`);
            continue;
          }

          // Формируем полный URL файла
          const serverUrl = `http://${getServerPrimaryIP()}:${PORT}${filePath}`;

          try {
            const playCommand = '/httpapi.asp?command=setPlayerCmd:play:' + encodeURIComponent(serverUrl);
            await client.request(playCommand);
            logWithMs(`[AUTO-RESTORE] Group "${group.name}": Started player ${i+1}/${groupPlayerIds.length} (${playerId})`);

            // Запускаем мониторинг
            startMonitoring(playerId, serverUrl, groupId);

            // Задержка между плеерами группы
            if (i < groupPlayerIds.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } catch (error) {
            logWithMs(`[AUTO-RESTORE] Error starting player ${playerId}: ${error.message}`);
          }
        }

        // Задержка между группами
        if (groupIndex < playerGroups.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    // Запускаем оставшиеся плееры (не в группах)
    const groupPlayerIds = new Set();
    playerGroups.forEach(group => group.playerIds.forEach(id => groupPlayerIds.add(id)));

    const soloPlayerIds = playerIds.filter(id => !groupPlayerIds.has(id));

    if (soloPlayerIds.length > 0) {
      logWithMs(`[AUTO-RESTORE] Starting ${soloPlayerIds.length} solo players`);

      for (let i = 0; i < soloPlayerIds.length; i++) {
        const playerId = soloPlayerIds[i];
        const filePath = playerSelections[playerId];
        const client = playerClients.get(playerId);

        if (!client) {
          logWithMs(`[AUTO-RESTORE] Player ${playerId} not found, skipping`);
          continue;
        }

        // Формируем полный URL файла
        const serverUrl = `http://${getServerPrimaryIP()}:${PORT}${filePath}`;

        try {
          const playCommand = '/httpapi.asp?command=setPlayerCmd:play:' + encodeURIComponent(serverUrl);
          await client.request(playCommand);
          logWithMs(`[AUTO-RESTORE] Started solo player ${i+1}/${soloPlayerIds.length} (${playerId})`);

          // Запускаем мониторинг
          startMonitoring(playerId, serverUrl, null);

          // Задержка между плеерами
          if (i < soloPlayerIds.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          logWithMs(`[AUTO-RESTORE] Error starting player ${playerId}: ${error.message}`);
        }
      }
    }

    logWithMs('[AUTO-RESTORE] Playback restoration completed');
  } catch (error) {
    logWithMs(`[AUTO-RESTORE] Fatal error: ${error.message}`);
  }
}

// Watchdog для автовосстановления - проверяет что все плееры запустились
async function autoRestoreWatchdog() {
  logWithMs('[AUTO-RESTORE-WATCHDOG] Checking if all players are playing...');

  try {
    const config = storage.getPlaybackConfig();
    const playerSelections = config.playerSelections || {};
    const playerIds = Object.keys(playerSelections);

    if (playerIds.length === 0) {
      logWithMs('[AUTO-RESTORE-WATCHDOG] No players to check');
      return;
    }

    const notPlayingPlayers = [];
    const manuallyStoppedCount = 0;

    for (const playerId of playerIds) {
      // КРИТИЧНО: Проверяем был ли ручной STOP
      if (manualStops.has(playerId)) {
        logWithMs(`[AUTO-RESTORE-WATCHDOG] Player ${playerId} was manually stopped, skipping auto-restart`);
        continue;
      }

      const client = playerClients.get(playerId);
      if (!client) continue;

      try {
        const status = await client.getPlayerStatus();
        const playerStatus = status.data?.status;

        if (playerStatus !== 'play') {
          notPlayingPlayers.push({ playerId, status: playerStatus, filePath: playerSelections[playerId] });
        }
      } catch (error) {
        logWithMs(`[AUTO-RESTORE-WATCHDOG] Error checking player ${playerId}: ${error.message}`);
        notPlayingPlayers.push({ playerId, filePath: playerSelections[playerId] });
      }
    }

    if (notPlayingPlayers.length > 0) {
      logWithMs(`[AUTO-RESTORE-WATCHDOG] Found ${notPlayingPlayers.length} players not playing, restarting...`);

      for (const { playerId, filePath } of notPlayingPlayers) {
        const client = playerClients.get(playerId);
        if (!client) continue;

        const serverUrl = `http://${getServerPrimaryIP()}:${PORT}${filePath}`;

        try {
          const playCommand = '/httpapi.asp?command=setPlayerCmd:play:' + encodeURIComponent(serverUrl);
          await client.request(playCommand);
          logWithMs(`[AUTO-RESTORE-WATCHDOG] Restarted player ${playerId}`);

          // Убеждаемся что мониторинг активен
          if (!autoRepeatState.has(playerId) || !autoRepeatState.get(playerId).monitoring) {
            const groupId = autoRepeatState.get(playerId)?.groupId || null;
            startMonitoring(playerId, serverUrl, groupId);
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          logWithMs(`[AUTO-RESTORE-WATCHDOG] Error restarting player ${playerId}: ${error.message}`);
        }
      }
    } else {
      logWithMs('[AUTO-RESTORE-WATCHDOG] All players are playing correctly');
    }
  } catch (error) {
    logWithMs(`[AUTO-RESTORE-WATCHDOG] Fatal error: ${error.message}`);
  }
}

// Запускаем автовосстановление через 5 секунд после старта
// (даём время плеерам инициализироваться)
setTimeout(() => {
  autoRestorePlayback();
}, 5000);

// Запускаем watchdog через 10 секунд после старта (чтобы проверить что всё запустилось)
setTimeout(() => {
  autoRestoreWatchdog();
}, 10000);

// Повторяем watchdog каждую минуту для надёжности
setInterval(() => {
  autoRestoreWatchdog();
}, 60000);

// Функция получения активного клиента
const getActiveClient = () => {
  const activePlayer = storage.getActivePlayer();
  if (!activePlayer) return null;
  return playerClients.get(activePlayer.id);
};

console.log('=== WiiM Web Control ===');
console.log('PORT:', PORT);
console.log('USE_HTTPS:', USE_HTTPS);
console.log('REQUEST_TIMEOUT:', REQUEST_TIMEOUT + 'ms');
console.log('ENABLE_STATS:', ENABLE_STATS);

// API ENDPOINTS - PLAYERS

// Получить список плееров
app.get('/api/players', (req, res) => {
  const data = storage.getPlayers();
  res.json(data);
});

// Сканирование сети
app.post('/api/players/scan', async (req, res) => {
  try {
    let { subnet } = req.body;

    // Если подсеть не указана, автоматически определяем из IP сервера
    if (!subnet) {
      const nets = networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          // Ищем IPv4 адрес не loopback
          if (net.family === 'IPv4' && !net.internal) {
            // Извлекаем первые 3 октета (например, из 192.168.0.18 получаем 192.168.0)
            const parts = net.address.split('.');
            subnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
            console.log(`Автоматически определена подсеть: ${subnet}.0/24`);
            break;
          }
        }
        if (subnet) break;
      }

      // Если не смогли определить, используем дефолтную
      if (!subnet) {
        subnet = '192.168.1';
        console.log(`Используется подсеть по умолчанию: ${subnet}.0/24`);
      }
    }

    const scanner = new NetworkScanner(subnet);
    const devices = await scanner.quickScan();

    devices.forEach(device => {
      // Используем реальное имя из устройства если доступно
      const deviceName = device.data?.DeviceName || `WiiM Player (${device.ip})`;

      storage.addPlayer({
        ip: device.ip,
        name: deviceName,
        useHttps: USE_HTTPS
      });

      const playersData = storage.getPlayers();
      const addedPlayer = playersData.players.find(p => p.ip === device.ip);
      if (addedPlayer) {
        playerClients.set(addedPlayer.id, new WiiMClient(device.ip, USE_HTTPS, REQUEST_TIMEOUT));
      }
    });

    res.json({ success: true, found: devices.length, devices, subnet });
  } catch (error) {
    console.error('Ошибка сканирования:', error);
    res.status(500).json({ error: error.message });
  }
});

// Добавить плеер вручную
app.post('/api/players', (req, res) => {
  try {
    const { ip, name, useHttps } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP address required' });
    }
    
    storage.addPlayer({
      ip,
      name: name || 'WiiM Player (' + ip + ')',
      useHttps: useHttps !== undefined ? useHttps : USE_HTTPS
    });
    
    const playersData = storage.getPlayers();
    const addedPlayer = playersData.players.find(p => p.ip === ip);
    if (addedPlayer) {
      playerClients.set(addedPlayer.id, new WiiMClient(ip, useHttps !== undefined ? useHttps : USE_HTTPS, REQUEST_TIMEOUT));
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Удалить плеер
app.delete('/api/players/:id', (req, res) => {
  try {
    const { id } = req.params;
    playerClients.delete(id);
    storage.removePlayer(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Установить активный плеер
app.post('/api/players/:id/activate', (req, res) => {
  try {
    const { id } = req.params;
    storage.setActivePlayer(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API ENDPOINTS - PLAYER CONTROL (сохраняем все существующие)

app.get('/api/status', async (req, res) => {
  try {
    const client = getActiveClient();
    if (!client) return res.status(404).json({ error: 'No active player' });
    const status = await client.getPlayerStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/info', async (req, res) => {
  try {
    const client = getActiveClient();
    if (!client) return res.status(404).json({ error: 'No active player' });
    const info = await client.getStatusInfo();
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/control/play', async (req, res) => {
  try {
    const client = getActiveClient();
    if (!client) return res.status(404).json({ error: 'No active player' });
    const result = await client.play();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/control/pause', async (req, res) => {
  try {
    const client = getActiveClient();
    if (!client) return res.status(404).json({ error: 'No active player' });
    const result = await client.pause();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/control/stop', async (req, res) => {
  try {
    const client = getActiveClient();
    if (!client) return res.status(404).json({ error: 'No active player' });
    const result = await client.stop();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/control/next', async (req, res) => {
  try {
    const client = getActiveClient();
    if (!client) return res.status(404).json({ error: 'No active player' });
    const result = await client.next();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/control/prev', async (req, res) => {
  try {
    const client = getActiveClient();
    if (!client) return res.status(404).json({ error: 'No active player' });
    const result = await client.prev();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/volume/set', async (req, res) => {
  try {
    const client = getActiveClient();
    if (!client) return res.status(404).json({ error: 'No active player' });
    const { volume } = req.body;
    if (volume === undefined) return res.status(400).json({ error: 'Volume parameter required' });
    const result = await client.setVolume(volume);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/volume/up', async (req, res) => {
  try {
    const client = getActiveClient();
    if (!client) return res.status(404).json({ error: 'No active player' });
    const result = await client.volumeUp();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/volume/down', async (req, res) => {
  try {
    const client = getActiveClient();
    if (!client) return res.status(404).json({ error: 'No active player' });
    const result = await client.volumeDown();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/volume/mute', async (req, res) => {
  try {
    const client = getActiveClient();
    if (!client) return res.status(404).json({ error: 'No active player' });
    const result = await client.mute();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/volume/unmute', async (req, res) => {
  try {
    const client = getActiveClient();
    if (!client) return res.status(404).json({ error: 'No active player' });
    const result = await client.unmute();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API ENDPOINTS - MEDIA

app.get('/api/media', (req, res) => {
  try {
    const mediaData = storage.getMedia();
    res.json(mediaData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/media/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    storage.addMediaFile({
      name: req.file.originalname,
      filename: req.file.filename,
      path: '/media/' + req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
    
    res.json({ success: true, file: req.file });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/media/play', async (req, res) => {
  try {
    const client = getActiveClient();
    if (!client) return res.status(404).json({ error: 'No active player' });

    const { fileUrl } = req.body;
    if (!fileUrl) return res.status(400).json({ error: 'File URL required' });

    const result = await client.request('/httpapi.asp?command=setPlayerCmd:play:' + encodeURIComponent(fileUrl));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/media/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    console.log(`[SERVER] DELETE request for file: ${filename}`);

    // Удаляем файл из файловой системы
    const filePath = join(__dirname, 'media', filename);
    try {
      unlinkSync(filePath);
      console.log(`[SERVER] Physical file deleted: ${filePath}`);
    } catch (err) {
      console.error('[SERVER] Error deleting physical file:', err);
    }

    // Удаляем из storage
    console.log(`[SERVER] Calling storage.removeMediaFile(${filename})`);
    const result = storage.removeMediaFile(filename);
    console.log(`[SERVER] Storage removal result: ${result}`);

    res.json({ success: true });
  } catch (error) {
    console.error('[SERVER] Error in delete endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// API ENDPOINTS - MULTI-PLAYER CONTROL

// Получить статус конкретного плеера
app.get('/api/players/:id/status', async (req, res) => {
  const { id } = req.params;
  try {
    const client = playerClients.get(id);

    if (!client) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // ОПТИМИЗАЦИЯ: используем только getStatusEx (getStatusInfo)
    // Он возвращает ВСЁ: status, title, artist, curpos, totlen, WiFi info
    // Это в 2 раза быстрее чем 2 отдельных запроса!
    const statusEx = await client.getStatusInfo();

    const info = {
      status: statusEx.status,
      data: statusEx.data
    };

    console.log(`[STATUS] Player ${id}: status=${info.data?.status}, RSSI=${info.data?.RSSI}, SSID=${info.data?.essid}`);
    res.json(info);
  } catch (error) {
    console.error(`[STATUS ERROR] Player ${id}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Воспроизведение на конкретном плеере
app.post('/api/players/:id/play', async (req, res) => {
  const { id } = req.params;
  const t0 = Date.now();

  // Получаем информацию о плеере для диагностики
  const playersData = storage.getPlayers();
  const playerInfo = playersData.players.find(p => p.id === id);
  const playerName = playerInfo ? playerInfo.name : 'Unknown';
  const playerIp = playerInfo ? playerInfo.ip : 'Unknown';

  logWithMs(`[PLAY] Request received for player ID=${id}, Name=${playerName}, IP=${playerIp}`);

  try {
    const { fileUrl, loopMode, groupId } = req.body;
    const client = playerClients.get(id);

    if (!client) {
      logWithMs(`[PLAY] Player ${id} (${playerName}) not found in playerClients map`);
      return res.status(404).json({ error: 'Player not found' });
    }

    if (fileUrl) {
      // Проверяем существование файла
      const urlPath = new URL(fileUrl).pathname;
      const filename = urlPath.split('/').pop();
      const filePath = join(__dirname, 'media', filename);

      if (!existsSync(filePath)) {
        logWithMs(`[PLAY] File not found: ${filePath}`);
        return res.status(404).json({ error: 'Media file not found on server' });
      }

      const command = '/httpapi.asp?command=setPlayerCmd:play:' + encodeURIComponent(fileUrl);
      const t1 = Date.now();
      logWithMs(`[PLAY] Player ${id}: Sending WiiM API command (offset: ${t1-t0}ms)`);

      const result = await client.request(command);
      const t2 = Date.now();
      logWithMs(`[PLAY] Player ${id}: WiiM API responded (took: ${t2-t1}ms, total: ${t2-t0}ms)`);
      logWithMs(`[PLAY] Player ${id}: HTTP Status=${result.status}, Data=${JSON.stringify(result.data)}`);

      // НЕМЕДЛЕННО отправляем ответ клиенту для максимальной синхронности группы
      const t3 = Date.now();
      logWithMs(`[PLAY] Player ${id}: Sending response to client (total: ${t3-t0}ms)`);
      res.json({ ...result, _debug: { command, fileUrl, playerId: id, timing: { total: t3-t0, apiCall: t2-t1 } } });

      // Запускаем систему автоповтора для этого плеера
      // Серверный автоповтор работает ВМЕСТО loopMode (который не работает с play:URL)
      startMonitoring(id, fileUrl, groupId);

      // Снимаем флаг ручной остановки - плеер снова запущен
      if (manualStops.has(id)) {
        manualStops.delete(id);
        logWithMs(`[PLAY] Player ${id}: Removed manual stop flag`);
      }

      // КРИТИЧНО: Сохраняем плеер в playerSelections для автовосстановления после перезагрузки
      const config = storage.getPlaybackConfig();
      const mediaPath = new URL(fileUrl).pathname;
      config.playerSelections[id] = mediaPath; // Сохраняем путь /media/filename
      storage.savePlaybackConfig(config.playerSelections, config.playerGroups || []);
      logWithMs(`[PLAY] Player ${id}: Added to auto-restore (file: ${mediaPath})`);

      // Проверяем статус АСИНХРОННО (не блокируя ответ клиенту)
      // Fire-and-forget - для диагностики
      setImmediate(async () => {
        const t2a = Date.now();
        logWithMs(`[PLAY] Player ${id}: Requesting immediate status check (offset: ${t2a-t0}ms)`);

        try {
          const statusResult = await client.getPlayerStatus();
          const t2b = Date.now();
          logWithMs(`[PLAY] Player ${id}: Immediate status received (took: ${t2b-t2a}ms)`);
          logWithMs(`[PLAY] Player ${id}: Immediate Status - HTTP=${statusResult.status}, status=${statusResult.data?.status}, title=${statusResult.data?.Title}, curpos=${statusResult.data?.curpos}`);
        } catch (err) {
          logWithMs(`[PLAY] Player ${id}: Immediate status check failed: ${err.message}`);
        }
      });

      // Также проверяем статус через 1 секунду для сравнения
      setTimeout(async () => {
        try {
          const status = await client.getPlayerStatus();
          logWithMs(`[PLAY] Player ${id}: Delayed status (1s) - status=${status.data?.status}, title=${status.data?.Title}, curpos=${status.data?.curpos}`);
        } catch (err) {
          logWithMs(`[PLAY] Player ${id}: Delayed status check error: ${err.message}`);
        }
      }, 1000);
    } else {
      logWithMs(`[PLAY] Player ${id}: resume playback`);
      const result = await client.play();
      logWithMs(`[PLAY] Resume result: ${JSON.stringify(result)}`);
      res.json(result);
    }
  } catch (error) {
    logWithMs(`[PLAY ERROR] Player ${id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Пауза на конкретном плеере
app.post('/api/players/:id/pause', async (req, res) => {
  const { id } = req.params; // Перемещаем наверх, чтобы было доступно в catch

  try {
    // Получаем информацию о плеере для диагностики
    const playersData = storage.getPlayers();
    const playerInfo = playersData.players.find(p => p.id === id);
    const playerName = playerInfo ? playerInfo.name : 'Unknown';
    const playerIp = playerInfo ? playerInfo.ip : 'Unknown';

    logWithMs(`[PAUSE] Request for player ID=${id}, Name=${playerName}, IP=${playerIp}`);

    const client = playerClients.get(id);

    if (!client) {
      logWithMs(`[PAUSE] Player ${id} (${playerName}) not found`);
      return res.status(404).json({ error: 'Player not found' });
    }

    const result = await client.pause();
    logWithMs(`[PAUSE] Player ${playerName} (${playerIp}) paused successfully`);
    res.json(result);
  } catch (error) {
    logWithMs(`[PAUSE ERROR] Player ${id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Синхронизация конфигурации для автовосстановления
app.post('/api/config/sync', async (req, res) => {
  try {
    const { playerSelections, playerGroups } = req.body;

    if (!playerSelections) {
      return res.status(400).json({ error: 'playerSelections is required' });
    }

    // КРИТИЧНО: Фильтруем остановленные вручную плееры
    // Не позволяем фронтенду восстановить их в playerSelections после STOP
    const filteredSelections = {};
    let filteredCount = 0;

    for (const [playerId, filePath] of Object.entries(playerSelections)) {
      if (manualStops.has(playerId)) {
        logWithMs(`[CONFIG-SYNC] Player ${playerId} was manually stopped, NOT adding to auto-restore`);
        filteredCount++;
        continue;
      }
      filteredSelections[playerId] = filePath;
    }

    const saved = storage.savePlaybackConfig(filteredSelections, playerGroups || []);

    if (saved) {
      logWithMs(`[CONFIG-SYNC] Saved configuration: ${Object.keys(filteredSelections).length} players (filtered ${filteredCount}), ${(playerGroups || []).length} groups`);
      res.json({ success: true, message: 'Configuration saved' });
    } else {
      res.status(500).json({ error: 'Failed to save configuration' });
    }
  } catch (error) {
    logWithMs(`[CONFIG-SYNC ERROR] ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Остановка на конкретном плеере
app.post('/api/players/:id/stop', async (req, res) => {
  const { id } = req.params; // Перемещаем наверх, чтобы было доступно в catch

  try {
    // Получаем информацию о плеере для диагностики
    const playersData = storage.getPlayers();
    const playerInfo = playersData.players.find(p => p.id === id);
    const playerName = playerInfo ? playerInfo.name : 'Unknown';
    const playerIp = playerInfo ? playerInfo.ip : 'Unknown';

    logWithMs(`[STOP] Request for player ID=${id}, Name=${playerName}, IP=${playerIp}`);

    const client = playerClients.get(id);

    if (!client) {
      logWithMs(`[STOP] Player ${id} (${playerName}) not found`);
      return res.status(404).json({ error: 'Player not found' });
    }

    const result = await client.stop();
    logWithMs(`[STOP] Player ${playerName} (${playerIp}) stopped successfully`);

    // Останавливаем мониторинг автоповтора
    stopMonitoring(id);

    // Помечаем как ручную остановку для глобального контроллера
    manualStops.add(id);
    logWithMs(`[STOP] Player ${id} marked as manually stopped`);

    // КРИТИЧНО: Удаляем плеер из playerSelections чтобы после перезагрузки НЕ запускался
    const config = storage.getPlaybackConfig();
    if (config.playerSelections && config.playerSelections[id]) {
      const filePath = config.playerSelections[id];
      delete config.playerSelections[id];
      storage.savePlaybackConfig(config.playerSelections, config.playerGroups || []);
      logWithMs(`[STOP] Player ${id} removed from auto-restore (was playing: ${filePath})`);
    }

    res.json(result);
  } catch (error) {
    logWithMs(`[STOP ERROR] Player ${id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Воспроизведение звукового сигнала на конкретном плеере
app.post('/api/players/:id/beep', async (req, res) => {
  const { id } = req.params;
  const { beepUrl } = req.body; // Получаем URL кастомного файла из тела запроса

  try {
    const client = playerClients.get(id);

    if (!client) {
      return res.status(404).json({ error: 'Player not found' });
    }

    let soundUrl;

    // Если передан кастомный URL, используем его
    if (beepUrl && beepUrl !== 'default') {
      soundUrl = beepUrl;
      console.log(`[BEEP] Playing custom beep sound on player ${id}: ${soundUrl}`);
    } else {
      // Используем Text-to-Speech API для генерации короткого звукового сигнала по умолчанию
      const beepText = "Бип";
      soundUrl = `http://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ru&q=${encodeURIComponent(beepText)}`;
      console.log(`[BEEP] Playing default TTS beep on player ${id}: ${soundUrl}`);
    }

    // Воспроизводим звук
    const result = await client.playUrl(soundUrl);

    res.json({
      status: 'success',
      message: 'Beep sound playing',
      data: result
    });
  } catch (error) {
    console.error(`[BEEP ERROR] Player ${id}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Установка громкости на конкретном плеере
app.post('/api/players/:id/volume', async (req, res) => {
  const { id } = req.params;

  try {
    const { volume } = req.body;
    const client = playerClients.get(id);

    if (!client) {
      return res.status(404).json({ error: 'Player not found' });
    }

    if (volume === undefined) {
      return res.status(400).json({ error: 'Volume value required' });
    }

    const result = await client.setVolume(volume);
    res.json(result);
  } catch (error) {
    logWithMs(`[VOLUME ERROR] Player ${id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Установка режима повтора на конкретном плеере
app.post('/api/players/:id/loopmode', async (req, res) => {
  const { id } = req.params;

  try {
    const { mode } = req.body;
    const client = playerClients.get(id);

    if (!client) {
      logWithMs(`[LOOPMODE] Player ${id} not found`);
      return res.status(404).json({ error: 'Player not found' });
    }

    if (mode === undefined) {
      return res.status(400).json({ error: 'Loop mode required (0=single, 1=repeat one, 2=repeat all, -1=shuffle)' });
    }

    const playersData = storage.getPlayers();
    const playerInfo = playersData.players.find(p => p.id === id);
    const playerName = playerInfo ? playerInfo.name : id;

    logWithMs(`[LOOPMODE] Setting loop mode for ${playerName}: ${mode}`);

    const result = await client.setLoopMode(mode);
    logWithMs(`[LOOPMODE] ${playerName} loop mode set successfully`);
    res.json(result);
  } catch (error) {
    logWithMs(`[LOOPMODE ERROR] Player ${id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// API ENDPOINT - SERVER INFO

app.get('/api/server-info', async (req, res) => {
  try {
    const nets = networkInterfaces();
    const addresses = [];

    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        // Пропускаем внутренние и non-IPv4 адреса
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push({
            name: name,
            address: net.address
          });
        }
      }
    }

    // Получаем информацию о WiFi сервера
    const serverStatus = await serverInfo.getServerStatus();

    res.json({
      port: PORT,
      addresses: addresses,
      primaryAddress: addresses.length > 0 ? addresses[0].address : 'localhost',
      server: serverStatus
    });
  } catch (error) {
    console.error('[SERVER-INFO] Error:', error);
    // Fallback на базовую информацию
    const nets = networkInterfaces();
    const addresses = [];

    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push({
            name: name,
            address: net.address
          });
        }
      }
    }

    res.json({
      port: PORT,
      addresses: addresses,
      primaryAddress: addresses.length > 0 ? addresses[0].address : 'localhost',
      server: {
        wifi: {
          ssid: 'N/A',
          signal: 'N/A',
          error: error.message
        }
      }
    });
  }
});

// API ENDPOINT - SERVER STATS

app.get('/api/stats', (req, res) => {
  const uptime = Date.now() - serverStats.startTime;
  const mediaData = storage.getMedia();
  const playersData = storage.getPlayers();

  res.json({
    uptime: uptime,
    requests: serverStats.requests,
    traffic: serverStats.traffic,
    errors: serverStats.errors,
    players: {
      total: playersData.players.length,
      online: playerClients.size
    },
    media: {
      files: mediaData.files.length,
      totalSize: mediaData.files.reduce((sum, f) => sum + f.size, 0)
    },
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  });
});

// ================================================
// DYNAMIC M3U PLAYLIST GENERATION
// ================================================

// Генерация m3u плейлиста из одного файла (для loopmode)
app.get('/api/playlist/:filename', (req, res) => {
  const { filename } = req.params;
  const serverUrl = `http://${req.headers.host}`;
  const fileUrl = `${serverUrl}/media/${filename}`;

  // M3U формат
  const m3uContent = `#EXTM3U\n#EXTINF:-1,${filename}\n${fileUrl}\n`;

  res.setHeader('Content-Type', 'audio/x-mpegurl');
  res.setHeader('Content-Disposition', `inline; filename="${filename}.m3u"`);
  res.send(m3uContent);

  console.log(`[M3U] Generated playlist for ${filename}: ${fileUrl}`);
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  const nets = networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }

  console.log('=================================');
  console.log('WiiM Web Control запущен!');
  console.log('=================================');
  console.log('');
  console.log('📡 ОТКРОЙТЕ ИНТЕРФЕЙС ПО АДРЕСУ:');

  if (addresses.length > 0) {
    addresses.forEach(addr => {
      console.log('   http://' + addr + ':' + PORT);
    });
  } else {
    console.log('   http://localhost:' + PORT);
  }

  console.log('');
  console.log('⚠️  НЕ используйте localhost для управления WiiM плеерами!');
  console.log('   Используйте IP адрес из списка выше.');
  console.log('');

  const activePlayer = storage.getActivePlayer();
  if (activePlayer) {
    console.log('Активный плеер: ' + activePlayer.name + ' (' + activePlayer.ip + ')');
  }

  console.log('=================================');
});
