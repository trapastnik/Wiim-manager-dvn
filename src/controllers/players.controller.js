import { logWithMs } from '../utils/logger.js';

/**
 * Контроллер для управления плеерами
 */

export async function getPlayers(req, res, wiimClient, storage) {
  try {
    const players = await storage.getPlayers();
    res.json(players);
  } catch (error) {
    logWithMs(`Ошибка получения списка плееров: ${error.message}`);
    res.status(500).json({ error: 'Ошибка получения списка плееров' });
  }
}

export async function addPlayer(req, res, storage) {
  try {
    const { ip, name } = req.body;

    if (!ip) {
      return res.status(400).json({ error: 'IP адрес обязателен' });
    }

    const players = await storage.getPlayers();

    // Проверка на дубликаты
    if (players.some(p => p.ip === ip)) {
      return res.status(400).json({ error: 'Плеер с таким IP уже добавлен' });
    }

    const newPlayer = {
      id: Date.now().toString(),
      ip,
      name: name || `WiiM ${ip}`,
      addedAt: new Date().toISOString()
    };

    players.push(newPlayer);
    await storage.savePlayers(players);

    logWithMs(`Добавлен новый плеер: ${newPlayer.name} (${ip})`);
    res.json(newPlayer);
  } catch (error) {
    logWithMs(`Ошибка добавления плеера: ${error.message}`);
    res.status(500).json({ error: 'Ошибка добавления плеера' });
  }
}

export async function removePlayer(req, res, storage) {
  try {
    const { id } = req.params;
    const players = await storage.getPlayers();
    const filteredPlayers = players.filter(p => p.id !== id);

    if (filteredPlayers.length === players.length) {
      return res.status(404).json({ error: 'Плеер не найден' });
    }

    await storage.savePlayers(filteredPlayers);
    logWithMs(`Удалён плеер с ID: ${id}`);
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Ошибка удаления плеера: ${error.message}`);
    res.status(500).json({ error: 'Ошибка удаления плеера' });
  }
}

export async function getPlayerStatus(req, res, wiimClient) {
  try {
    const { ip } = req.params;
    const status = await wiimClient.getPlayerStatus(ip);
    res.json(status);
  } catch (error) {
    logWithMs(`Ошибка получения статуса плеера ${req.params.ip}: ${error.message}`);
    res.status(500).json({ error: 'Ошибка получения статуса' });
  }
}

export async function playMedia(req, res, wiimClient) {
  try {
    const { ip } = req.params;
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL обязателен' });
    }

    await wiimClient.playUrl(ip, url);
    logWithMs(`Воспроизведение на ${ip}: ${url}`);
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Ошибка воспроизведения: ${error.message}`);
    res.status(500).json({ error: 'Ошибка воспроизведения' });
  }
}

export async function controlPlayer(req, res, wiimClient) {
  try {
    const { ip, action } = req.params;
    const validActions = ['play', 'pause', 'stop', 'next', 'prev'];

    if (!validActions.includes(action)) {
      return res.status(400).json({ error: 'Недопустимое действие' });
    }

    await wiimClient.setPlayerCmd(ip, action);
    logWithMs(`Команда ${action} отправлена на ${ip}`);
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Ошибка управления плеером: ${error.message}`);
    res.status(500).json({ error: 'Ошибка управления плеером' });
  }
}

export async function setVolume(req, res, wiimClient) {
  try {
    const { ip } = req.params;
    const { volume } = req.body;

    if (volume === undefined || volume < 0 || volume > 100) {
      return res.status(400).json({ error: 'Громкость должна быть от 0 до 100' });
    }

    await wiimClient.setVolume(ip, volume);
    logWithMs(`Громкость на ${ip} установлена: ${volume}`);
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Ошибка установки громкости: ${error.message}`);
    res.status(500).json({ error: 'Ошибка установки громкости' });
  }
}

export async function setMute(req, res, wiimClient) {
  try {
    const { ip } = req.params;
    const { mute } = req.body;

    await wiimClient.setMute(ip, mute ? 1 : 0);
    logWithMs(`Mute на ${ip}: ${mute ? 'включен' : 'выключен'}`);
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Ошибка установки mute: ${error.message}`);
    res.status(500).json({ error: 'Ошибка установки mute' });
  }
}

export async function setLoopMode(req, res, wiimClient) {
  try {
    const { ip } = req.params;
    const { mode } = req.body;

    const validModes = [0, 1, 2]; // 0=off, 1=one, 2=all
    if (!validModes.includes(mode)) {
      return res.status(400).json({ error: 'Недопустимый режим loop' });
    }

    await wiimClient.setLoopMode(ip, mode);
    logWithMs(`Loop mode на ${ip} установлен: ${mode}`);
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Ошибка установки loop mode: ${error.message}`);
    res.status(500).json({ error: 'Ошибка установки loop mode' });
  }
}

export async function playBeep(req, res, wiimClient) {
  try {
    const { ip } = req.params;
    await wiimClient.playBeep(ip);
    logWithMs(`Beep воспроизведён на ${ip}`);
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Ошибка воспроизведения beep: ${error.message}`);
    res.status(500).json({ error: 'Ошибка воспроизведения beep' });
  }
}
