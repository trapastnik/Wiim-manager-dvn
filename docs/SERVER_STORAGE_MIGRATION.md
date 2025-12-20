# Миграция на серверное хранилище данных

## Проблема

**Было:** Все настройки и конфигурация хранились в `localStorage` браузера клиента.

**Проблемы:**
- ❌ Настройки привязаны к конкретному компьютеру/браузеру
- ❌ При открытии с другого устройства - чистая конфигурация
- ❌ Нет синхронизации между клиентами
- ❌ Потеря данных при очистке кэша браузера

## Решение

**Теперь:** ВСЕ данные хранятся ТОЛЬКО на сервере.

**Преимущества:**
- ✅ Одна конфигурация для всех клиентов
- ✅ Открыли с телефона - та же конфигурация
- ✅ Открыли с планшета - та же конфигурация
- ✅ Открыли с другого компьютера - та же конфигурация
- ✅ Данные не теряются при очистке кэша браузера
- ✅ Единственный источник правды - сервер

## Что было изменено

### 1. Новый файл хранилища: `data/ui-config.json`

```json
{
  "playerLoopModes": {
    "player_id_1": 1,
    "player_id_2": 0
  },
  "appSettings": {
    "beepSoundUrl": "default"
  },
  "messagesPanelWidth": 450,
  "lastUpdated": "2025-12-20T08:20:53.218Z"
}
```

### 2. Расширен `storage.js`

Добавлены методы:
- `getUIConfig()` - получить UI конфигурацию
- `saveUIConfig(config)` - сохранить UI конфигурацию (атомарно)
- `updateLoopModes(playerLoopModes)` - обновить только loopModes
- `updateAppSettings(appSettings)` - обновить только appSettings
- `updateMessagesPanelWidth(width)` - обновить ширину панели

### 3. Новые API endpoints в `server.js`

#### GET `/api/config`
Возвращает всю конфигурацию:
```json
{
  "playerSelections": {...},
  "playerGroups": [...],
  "playerLoopModes": {...},
  "appSettings": {...},
  "messagesPanelWidth": 450
}
```

#### POST `/api/config/loop-modes`
Сохраняет режимы повтора:
```json
{
  "playerLoopModes": {
    "player_id": 1
  }
}
```

#### POST `/api/config/settings`
Сохраняет настройки приложения:
```json
{
  "appSettings": {
    "beepSoundUrl": "default"
  }
}
```

#### POST `/api/config/panel-width`
Сохраняет ширину панели сообщений:
```json
{
  "width": 450
}
```

### 4. Полностью переработан `public/app.js`

**Удалено:**
- ❌ Все вызовы `localStorage.getItem()`
- ❌ Все вызовы `localStorage.setItem()`
- ❌ Зависимость от браузерного хранилища

**Добавлено:**
- ✅ `loadPlayerSelections()` - async загрузка с сервера
- ✅ `loadLoopModes()` - async загрузка с сервера
- ✅ `loadPlayerGroups()` - async загрузка с сервера
- ✅ `loadSettings()` - async загрузка с сервера
- ✅ `saveLoopModes()` - async сохранение на сервер
- ✅ `saveSettings()` - async сохранение на сервер
- ✅ `resetSettings()` - async сброс на сервер
- ✅ Загрузка/сохранение ширины панели через API

## Как это работает

### При загрузке страницы (app.js:47-51)
```javascript
// Загрузка конфигурации с сервера (async)
await loadPlayerSelections();
await loadLoopModes();
await loadPlayerGroups();
await loadSettings();
```

Все данные загружаются с сервера через GET `/api/config`.

### При изменении настроек
Каждое изменение немедленно отправляется на сервер:

```javascript
// Изменение режима повтора
async function saveLoopModes() {
  await fetch('/api/config/loop-modes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerLoopModes })
  });
}
```

### При изменении размера панели
```javascript
fetch('/api/config/panel-width', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ width: panel.offsetWidth })
});
```

## Миграция данных

### Автоматическая миграция

При первом запуске после обновления:
1. Старые данные из `localStorage` будут **проигнорированы**
2. Сервер создаст дефолтную конфигурацию
3. Данные из `playback-state.json` сохранятся (playerSelections, playerGroups)

### Ручная миграция (если нужно)

Если у вас были важные настройки в localStorage:

1. Откройте консоль браузера (F12)
2. Выполните:
```javascript
// Получить старые данные
const oldSettings = JSON.parse(localStorage.getItem('appSettings'));
const oldLoopModes = JSON.parse(localStorage.getItem('playerLoopModes'));

// Отправить на сервер
fetch('/api/config/settings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ appSettings: oldSettings })
});

fetch('/api/config/loop-modes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ playerLoopModes: oldLoopModes })
});
```

## Тестирование

### Проверка работоспособности

1. Откройте интерфейс с компьютера
2. Настройте режим повтора для плеера
3. Измените звук уведомлений
4. Измените размер панели сообщений
5. Откройте интерфейс с телефона/планшета
6. **Убедитесь что все настройки сохранились!**

### Проверка API

```bash
# Получить всю конфигурацию
curl http://localhost:3000/api/config

# Сохранить настройки
curl -X POST http://localhost:3000/api/config/settings \
  -H "Content-Type: application/json" \
  -d '{"appSettings": {"beepSoundUrl": "default"}}'

# Сохранить режимы повтора
curl -X POST http://localhost:3000/api/config/loop-modes \
  -H "Content-Type: application/json" \
  -d '{"playerLoopModes": {"player_id": 1}}'

# Сохранить ширину панели
curl -X POST http://localhost:3000/api/config/panel-width \
  -H "Content-Type: application/json" \
  -d '{"width": 450}'
```

## Структура файлов хранилища

```
data/
├── players.json           # Список плееров
├── media.json             # Список медиа файлов
├── playback-state.json    # Состояние воспроизведения (playerSelections, groups)
└── ui-config.json         # UI конфигурация (NEW!)
```

## Важные детали

### Атомарная запись

Все файлы сохраняются атомарно (temp + rename):
```javascript
writeFileSync(tempFile, JSON.stringify(config, null, 2));
renameSync(tempFile, this.uiConfigFile);
```

Это гарантирует целостность данных даже при сбое во время записи.

### Debounce для playerSelections

Выборы плееров сохраняются с задержкой 300ms:
```javascript
saveSelectionsTimer = setTimeout(() => {
  syncConfigToServer();
}, 300);
```

Это предотвращает частые записи при быстром переключении файлов.

### Защита от ручных STOP

При синхронизации playerSelections фильтруются плееры из `manualStops`:
```javascript
if (manualStops.has(playerId)) {
  // НЕ восстанавливаем в playerSelections
  continue;
}
```

Это сохраняет логику "STOP = STOP, а не временная пауза".

## Обратная совместимость

❌ **НЕТ обратной совместимости с localStorage**

После обновления:
- Старые данные в localStorage будут игнорироваться
- Нужно заново настроить режимы повтора и настройки
- ИЛИ выполнить ручную миграцию (см. выше)

## Дата изменений

**2025-12-20** - Полная миграция на серверное хранилище

## Связанные файлы

- `storage.js:9-14, 355-426` - методы UI конфигурации
- `server.js:1165-1250` - новые API endpoints
- `public/app.js:645-760, 2388-2476` - удаление localStorage, добавление API вызовов

## Автор

Claude AI Assistant
