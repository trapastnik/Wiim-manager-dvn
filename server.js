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

    // Получаем данные о воспроизведении (status, title, artist, curpos, totlen)
    const playerStatus = await client.getPlayerStatus();

    // Получаем расширенную информацию (WiFi: essid, RSSI, BSSID)
    const statusEx = await client.getStatusInfo();

    // Объединяем данные: основа - статус воспроизведения, дополнение - WiFi информация
    const combinedData = {
      ...playerStatus.data,
      essid: statusEx.data?.essid,
      RSSI: statusEx.data?.RSSI,
      BSSID: statusEx.data?.BSSID,
      wlanSnr: statusEx.data?.wlanSnr,
      DeviceName: statusEx.data?.DeviceName
    };

    const info = {
      status: playerStatus.status,
      data: combinedData
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
    const { fileUrl } = req.body;
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
    res.json(result);
  } catch (error) {
    logWithMs(`[STOP ERROR] Player ${id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Воспроизведение звукового сигнала на конкретном плеере
app.post('/api/players/:id/beep', async (req, res) => {
  const { id } = req.params;

  try {
    const client = playerClients.get(id);

    if (!client) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Используем Text-to-Speech API для генерации короткого звукового сигнала
    // Альтернативно можно использовать готовый beep файл
    const beepText = "Бип";
    const ttsUrl = `http://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ru&q=${encodeURIComponent(beepText)}`;

    console.log(`[BEEP] Playing beep sound on player ${id}: ${ttsUrl}`);

    // Воспроизводим TTS
    const result = await client.playUrl(ttsUrl);

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
