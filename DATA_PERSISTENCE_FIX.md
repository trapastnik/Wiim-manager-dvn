# Исправление сохранения данных на сервере

**Дата:** 2025-12-21
**Статус:** ✅ ИСПРАВЛЕНО

---

## 🔧 ЧТО БЫЛО ИСПРАВЛЕНО

### Проблема
Frontend пытался сохранять данные через API endpoints, которые не существовали на backend:
- `/api/config/sync` → 404
- `/api/config/loop-modes` → 404
- `/api/config/settings` → 404
- `/api/config/panel-width` → 404
- `/api/config/loop-experimental` → 404
- `/api/config/cleanup` → 404

**Результат:** Loop modes, выбор треков, группы, громкости НЕ сохранялись при перезагрузке.

---

## ✅ ВНЕСЁННЫЕ ИЗМЕНЕНИЯ

### 1. storage.js - Добавлены общие методы (строки 423-468)

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

### 2. src/routes/config.routes.js - Добавлены 6 endpoints (строки 35-63)

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

### 3. src/controllers/config.controller.js - Добавлены 6 методов (строки 67-151)

#### syncConfig()
Синхронизирует playerSelections, playerGroups, playerVolumes.

#### saveLoopModes()
Сохраняет режимы повтора для всех плееров.

#### saveSettings()
Сохраняет настройки приложения (beepSoundUrl и др.).

#### savePanelWidth()
Сохраняет ширину панели сообщений.

#### saveLoopExperimentalSettings()
Сохраняет экспериментальные настройки Loop режима.

#### cleanupBrokenStates()
Очищает битые состояния (несуществующие плееры из конфигурации).

---

## 📊 ТЕПЕРЬ СОХРАНЯЕТСЯ

| Данные | Файл | Endpoint | Статус |
|--------|------|----------|--------|
| Плееры | `data/players.json` | `/api/players` | ✅ Работало |
| Медиа файлы | `data/media.json` | `/api/media` | ✅ Работало |
| Выбор треков | `data/playback-state.json` | `/api/config/sync` | ✅ **ИСПРАВЛЕНО** |
| Группы плееров | `data/playback-state.json` | `/api/config/sync` | ✅ **ИСПРАВЛЕНО** |
| Loop modes | `data/ui-config.json` | `/api/config/loop-modes` | ✅ **ИСПРАВЛЕНО** |
| Громкости | `data/ui-config.json` | `/api/config/sync` | ✅ **ИСПРАВЛЕНО** |
| Настройки | `data/ui-config.json` | `/api/config/settings` | ✅ **ИСПРАВЛЕНО** |
| Ширина панели | `data/ui-config.json` | `/api/config/panel-width` | ✅ **ИСПРАВЛЕНО** |

---

## 🎯 РЕЗУЛЬТАТ

### До исправления:
- ❌ При перезагрузке страницы терялись Loop modes
- ❌ Терялись назначения треков для плееров
- ❌ Терялись группы плееров
- ❌ Терялись сохранённые громкости

### После исправления:
- ✅ Все настройки сохраняются на сервере
- ✅ При перезагрузке страницы всё восстанавливается
- ✅ Настройки сохраняются в JSON файлы в папке `data/`
- ✅ Атомарная запись (защита от корруптирования при сбое)
- ✅ Debounce 300ms (не более 1 запроса в 300ms)

---

## 🧪 КАК ПРОВЕРИТЬ

### 1. Запустить сервер
```bash
npm start
```

### 2. Открыть браузер
```
http://localhost:3000
```

### 3. Тестовый сценарий:

**Шаг 1:** Добавить плеер (если нет)
**Шаг 2:** Выбрать трек для плеера
**Шаг 3:** Включить Loop Mode
**Шаг 4:** Изменить громкость
**Шаг 5:** Создать группу плееров
**Шаг 6:** Перезагрузить страницу (F5)

**Ожидаемый результат:**
- ✅ Выбранный трек остался назначен
- ✅ Loop Mode остался включен
- ✅ Громкость осталась той же
- ✅ Группа плееров сохранилась

### 4. Проверить файлы:

```bash
cat data/playback-state.json
cat data/ui-config.json
```

Должны содержать:
- `playerSelections` с выбранными треками
- `playerGroups` с созданными группами
- `playerLoopModes` с режимами повтора
- `playerVolumes` с громкостями

---

## 📝 ТЕХНИЧЕСКИЕ ДЕТАЛИ

### Архитектура сохранения:

```
Frontend (config-sync.service.js)
    ↓ debounce 300ms
ConfigAPI.syncConfig()
    ↓ POST /api/config/sync
config.routes.js
    ↓
config.controller.js → syncConfig()
    ↓
storage.js → savePlaybackConfig() + saveUIConfig()
    ↓
data/playback-state.json + data/ui-config.json
```

### Защита данных:

1. **Debounce 300ms** - не более 1 сохранения в 300ms
2. **Атомарная запись** - сначала `.tmp` файл, затем rename
3. **Проверка демо-режима** - в демо не сохраняем
4. **Очистка битых состояний** - удаление несуществующих плееров

---

## 🔍 ФАЙЛЫ ИЗМЕНЕНЫ

1. `storage.js` - добавлено 46 строк (методы getConfig/saveConfig)
2. `src/routes/config.routes.js` - добавлено 29 строк (6 endpoints)
3. `src/controllers/config.controller.js` - добавлено 86 строк (6 методов)

**Всего:** 161 строка кода

---

*Исправлено: 2025-12-21*
