# Отчёт о сохранении данных на сервере

**Дата проверки:** 2025-12-21

---

## 📊 ТЕКУЩЕЕ СОСТОЯНИЕ

### ✅ ЧТО СОХРАНЯЕТСЯ ПРАВИЛЬНО

#### 1. Плееры (`data/players.json`)
**Файл:** `storage.js` методы `getPlayers()`, `savePlayers()`, `addPlayer()`, `removePlayer()`

**Что хранится:**
- ID плеера (уникальный)
- IP адрес
- Имя устройства
- UUID (MAC-адрес)
- Дата добавления/обновления

**Вызывается из:**
- `/api/players` (GET, POST, DELETE)
- Автоматически при сканировании сети

---

#### 2. Медиа файлы (`data/media.json`)
**Файл:** `storage.js` методы `getMedia()`, `saveMedia()`, `addMediaFile()`, `removeMediaFile()`

**Что хранится:**
- Список загруженных аудио файлов
- ID файла
- Имя файла
- URL
- Дата добавления

**Вызывается из:**
- `/api/media` (GET, POST, DELETE)
- Автоматически при загрузке файлов

---

#### 3. Назначения плееров (`data/playback-state.json`)
**Файл:** `storage.js` методы `getPlaybackConfig()`, `savePlaybackConfig()`

**Что хранится:**
```json
{
  "playerSelections": {
    "player-1": "/media/track1.mp3",
    "player-2": "/media/track2.mp3"
  },
  "playerGroups": [
    {
      "id": "group-1",
      "name": "Группа 1",
      "playerIds": ["player-1", "player-2"]
    }
  ],
  "lastUpdated": "2025-12-21T10:00:00.000Z"
}
```

**Вызывается из:**
- Frontend → `config-sync.service.js` → `ConfigAPI.syncConfig()`
- Backend: **ПРОБЛЕМА** - нет endpoint `/api/config/sync`

---

#### 4. UI конфигурация (`data/ui-config.json`)
**Файл:** `storage.js` методы `getUIConfig()`, `saveUIConfig()`

**Что хранится:**
```json
{
  "playerLoopModes": {
    "player-1": 2,
    "player-2": 0
  },
  "playerVolumes": {
    "player-1": 75,
    "player-2": 50
  },
  "appSettings": {
    "beepSoundUrl": "default"
  },
  "messagesPanelWidth": 400,
  "loopExperimentalSettings": {
    "useWiimNativeLoop": true,
    "useClientMonitoring": false
  },
  "lastUpdated": "2025-12-21T10:00:00.000Z"
}
```

**Вызывается из:**
- Frontend → `ConfigAPI.saveLoopModes()`
- Frontend → `ConfigAPI.saveSettings()`
- Frontend → `ConfigAPI.savePanelWidth()`
- Backend: **ПРОБЛЕМА** - нет этих endpoints

---

## ❌ ПРОБЛЕМЫ - ЧТО НЕ СОХРАНЯЕТСЯ

### Проблема #1: Отсутствуют endpoints для сохранения UI конфигурации

**Frontend вызывает:**
```javascript
// public/js/api/config-api.js

// 1. Сохранение loop modes
await ConfigAPI.saveLoopModes(loopModes);  // POST /api/config/loop-modes

// 2. Синхронизация конфигурации (selections, groups, volumes)
await ConfigAPI.syncConfig({ playerSelections, playerGroups, playerVolumes });  // POST /api/config/sync

// 3. Сохранение настроек
await ConfigAPI.saveSettings(settings);  // POST /api/config/settings

// 4. Сохранение ширины панели
await ConfigAPI.savePanelWidth(width);  // POST /api/config/panel-width

// 5. Экспериментальные настройки loop
await ConfigAPI.saveLoopExperimentalSettings(settings);  // POST /api/config/loop-experimental

// 6. Очистка битых состояний
await ConfigAPI.cleanupBrokenStates();  // POST /api/config/cleanup
```

**Backend реально существует:**
```javascript
// src/routes/config.routes.js

router.get('/', ...)      // GET /api/config - ЕСТЬ
router.post('/', ...)     // POST /api/config - ЕСТЬ (но вызывает storage.saveConfig() которого НЕТ!)
```

**ПРОБЛЕМА:**
- Frontend вызывает `/api/config/loop-modes` → **404 Not Found**
- Frontend вызывает `/api/config/sync` → **404 Not Found**
- Frontend вызывает `/api/config/settings` → **404 Not Found**
- Frontend вызывает `/api/config/panel-width` → **404 Not Found**

---

### Проблема #2: Методы storage вызываются, но не существуют

**Контроллер вызывает:**
```javascript
// src/controllers/config.controller.js:9
const config = await storage.getConfig();  // ❌ НЕТ ТАКОГО МЕТОДА

// src/controllers/config.controller.js:20
await storage.saveConfig(config);  // ❌ НЕТ ТАКОГО МЕТОДА
```

**В storage.js есть:**
- `getPlaybackConfig()` - для playerSelections и groups
- `savePlaybackConfig()` - для playerSelections и groups
- `getUIConfig()` - для loopModes, volumes, settings
- `saveUIConfig()` - для loopModes, volumes, settings
- `updateLoopModes()` - только loop modes
- `updateAppSettings()` - только app settings
- `updateMessagesPanelWidth()` - только ширина панели
- `updatePlayerVolume()` - громкость одного плеера

**НО НЕТ:**
- `getConfig()` - общий метод получения всей конфигурации
- `saveConfig()` - общий метод сохранения конфигурации

---

## 🔍 ЧТО ПРОИСХОДИТ СЕЙЧАС

### Сценарий 1: Пользователь включает Loop Mode

```javascript
// Frontend: loop-mode.service.js:51
await ConfigAPI.saveLoopModes(loopModes);
```

**Запрос:**
```
POST /api/config/loop-modes
Body: { loopModes: { "player-1": 2, "player-2": 2 } }
```

**Backend:**
```
❌ 404 Not Found - роут не существует
```

**Результат:**
- ❌ Loop modes НЕ сохраняются на сервере
- ❌ При перезагрузке страницы настройки теряются
- ⚠️ Ошибка в консоли браузера: `Error saving loop modes`

---

### Сценарий 2: Пользователь выбирает трек для плеера

```javascript
// Frontend: config-sync.service.js:27
await ConfigAPI.syncConfig({
  playerSelections: { "player-1": "/media/track.mp3" }
});
```

**Запрос:**
```
POST /api/config/sync
Body: { playerSelections: { "player-1": "/media/track.mp3" } }
```

**Backend:**
```
❌ 404 Not Found - роут не существует
```

**Результат:**
- ❌ Выбор трека НЕ сохраняется
- ❌ При перезагрузке страницы назначения теряются

---

### Сценарий 3: Пользователь меняет громкость

```javascript
// Frontend: config-sync.service.js:73
await ConfigAPI.syncConfig({
  playerVolumes: { "player-1": 75 }
});
```

**Запрос:**
```
POST /api/config/sync
Body: { playerVolumes: { "player-1": 75 } }
```

**Backend:**
```
❌ 404 Not Found
```

**Результат:**
- ❌ Громкость НЕ сохраняется
- ⚠️ Есть debounce 300ms, но запрос всё равно падает

---

## 📝 ЧТО НУЖНО ИСПРАВИТЬ

### Исправление #1: Добавить недостающие endpoints в config.routes.js

**Файл:** `src/routes/config.routes.js`

**Добавить:**
```javascript
// Синхронизация конфигурации (playerSelections, groups, volumes)
router.post('/sync', (req, res) =>
  configController.syncConfig(req, res, storage)
);

// Сохранить loop modes
router.post('/loop-modes', (req, res) =>
  configController.saveLoopModes(req, res, storage)
);

// Сохранить настройки приложения
router.post('/settings', (req, res) =>
  configController.saveSettings(req, res, storage)
);

// Сохранить ширину панели
router.post('/panel-width', (req, res) =>
  configController.savePanelWidth(req, res, storage)
);

// Сохранить экспериментальные настройки loop
router.post('/loop-experimental', (req, res) =>
  configController.saveLoopExperimentalSettings(req, res, storage)
);

// Очистка битых состояний
router.post('/cleanup', (req, res) =>
  configController.cleanupBrokenStates(req, res, storage)
);
```

---

### Исправление #2: Добавить методы в config.controller.js

**Файл:** `src/controllers/config.controller.js`

**Добавить:**
```javascript
export async function syncConfig(req, res, storage) {
  try {
    const { playerSelections, playerGroups, playerVolumes } = req.body;

    // Сохраняем playerSelections и playerGroups
    if (playerSelections !== undefined || playerGroups !== undefined) {
      const currentConfig = storage.getPlaybackConfig();
      const newSelections = playerSelections || currentConfig.playerSelections;
      const newGroups = playerGroups || currentConfig.playerGroups;
      storage.savePlaybackConfig(newSelections, newGroups);
    }

    // Сохраняем playerVolumes
    if (playerVolumes !== undefined) {
      const uiConfig = storage.getUIConfig();
      uiConfig.playerVolumes = { ...uiConfig.playerVolumes, ...playerVolumes };
      storage.saveUIConfig(uiConfig);
    }

    logWithMs('Config synced');
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Error syncing config: ${error.message}`);
    res.status(500).json({ error: 'Error syncing config' });
  }
}

export async function saveLoopModes(req, res, storage) {
  try {
    const { loopModes } = req.body;
    storage.updateLoopModes(loopModes);
    logWithMs('Loop modes saved');
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Error saving loop modes: ${error.message}`);
    res.status(500).json({ error: 'Error saving loop modes' });
  }
}

export async function saveSettings(req, res, storage) {
  try {
    const settings = req.body;
    storage.updateAppSettings(settings);
    logWithMs('Settings saved');
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Error saving settings: ${error.message}`);
    res.status(500).json({ error: 'Error saving settings' });
  }
}

export async function savePanelWidth(req, res, storage) {
  try {
    const { width } = req.body;
    storage.updateMessagesPanelWidth(width);
    logWithMs(`Panel width saved: ${width}px`);
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Error saving panel width: ${error.message}`);
    res.status(500).json({ error: 'Error saving panel width' });
  }
}

export async function saveLoopExperimentalSettings(req, res, storage) {
  try {
    const settings = req.body;
    storage.updateLoopExperimentalSettings(settings);
    logWithMs('Loop experimental settings saved');
    res.json({ success: true });
  } catch (error) {
    logWithMs(`Error saving loop experimental settings: ${error.message}`);
    res.status(500).json({ error: 'Error saving loop experimental settings' });
  }
}

export async function cleanupBrokenStates(req, res, storage) {
  try {
    const result = storage.cleanupPlaybackState();
    logWithMs(`Cleanup completed: ${result.removedSelections} selections, ${result.removedGroups} groups removed`);
    res.json(result);
  } catch (error) {
    logWithMs(`Error cleaning up broken states: ${error.message}`);
    res.status(500).json({ error: 'Error cleaning up broken states' });
  }
}
```

---

### Исправление #3: Добавить getConfig() и saveConfig() в storage.js

**Файл:** `storage.js`

**Добавить методы для общей конфигурации:**
```javascript
// Получить всю конфигурацию (playback + UI)
getConfig() {
  const playbackConfig = this.getPlaybackConfig();
  const uiConfig = this.getUIConfig();

  return {
    playerSelections: playbackConfig.playerSelections,
    playerGroups: playbackConfig.playerGroups,
    playerLoopModes: uiConfig.playerLoopModes,
    playerVolumes: uiConfig.playerVolumes,
    appSettings: uiConfig.appSettings,
    messagesPanelWidth: uiConfig.messagesPanelWidth,
    loopExperimentalSettings: uiConfig.loopExperimentalSettings,
    lastUpdated: new Date().toISOString()
  };
}

// Сохранить всю конфигурацию
saveConfig(config) {
  // Сохраняем playback конфигурацию
  if (config.playerSelections !== undefined || config.playerGroups !== undefined) {
    this.savePlaybackConfig(
      config.playerSelections || {},
      config.playerGroups || []
    );
  }

  // Сохраняем UI конфигурацию
  const uiConfig = {};
  if (config.playerLoopModes !== undefined) uiConfig.playerLoopModes = config.playerLoopModes;
  if (config.playerVolumes !== undefined) uiConfig.playerVolumes = config.playerVolumes;
  if (config.appSettings !== undefined) uiConfig.appSettings = config.appSettings;
  if (config.messagesPanelWidth !== undefined) uiConfig.messagesPanelWidth = config.messagesPanelWidth;
  if (config.loopExperimentalSettings !== undefined) uiConfig.loopExperimentalSettings = config.loopExperimentalSettings;

  if (Object.keys(uiConfig).length > 0) {
    const currentUIConfig = this.getUIConfig();
    this.saveUIConfig({ ...currentUIConfig, ...uiConfig });
  }

  return true;
}
```

---

## 📊 ИТОГОВАЯ КАРТИНА

### До исправления:

| Данные | Сохраняются? | Файл | Проблема |
|--------|--------------|------|----------|
| Плееры | ✅ ДА | `players.json` | Работает |
| Медиа файлы | ✅ ДА | `media.json` | Работает |
| Выбор треков | ❌ НЕТ | `playback-state.json` | Нет endpoint `/sync` |
| Группы плееров | ❌ НЕТ | `playback-state.json` | Нет endpoint `/sync` |
| Loop modes | ❌ НЕТ | `ui-config.json` | Нет endpoint `/loop-modes` |
| Громкости | ❌ НЕТ | `ui-config.json` | Нет endpoint `/sync` |
| Настройки | ❌ НЕТ | `ui-config.json` | Нет endpoint `/settings` |
| Ширина панели | ❌ НЕТ | `ui-config.json` | Нет endpoint `/panel-width` |

### После исправления:

| Данные | Сохраняются? | Файл | Работает через |
|--------|--------------|------|----------------|
| Плееры | ✅ ДА | `players.json` | `/api/players` |
| Медиа файлы | ✅ ДА | `media.json` | `/api/media` |
| Выбор треков | ✅ ДА | `playback-state.json` | `/api/config/sync` |
| Группы плееров | ✅ ДА | `playback-state.json` | `/api/config/sync` |
| Loop modes | ✅ ДА | `ui-config.json` | `/api/config/loop-modes` |
| Громкости | ✅ ДА | `ui-config.json` | `/api/config/sync` |
| Настройки | ✅ ДА | `ui-config.json` | `/api/config/settings` |
| Ширина панели | ✅ ДА | `ui-config.json` | `/api/config/panel-width` |

---

## 🔧 ПРИОРИТЕТ ИСПРАВЛЕНИЯ

### ⚠️ КРИТИЧНО - не работают основные функции:
1. ❌ Сохранение Loop modes - **важная функция**
2. ❌ Сохранение выбора треков - **критично для работы**
3. ❌ Сохранение групп плееров - **важная функция**
4. ❌ Сохранение громкостей - **UX страдает**

### Рекомендация:
**НЕМЕДЛЕННО добавить все недостающие endpoints и методы**

Без этого приложение теряет 70% настроек при каждой перезагрузке страницы!

---

*Отчёт создан: 2025-12-21*
