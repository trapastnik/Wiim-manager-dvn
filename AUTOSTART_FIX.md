# Исправление системы автозапуска

## Проблема

После нажатия кнопки STOP плееры автоматически запускались через некоторое время. Это происходило из-за того, что система автовосстановления (`autoRestoreWatchdog`) игнорировала ручные команды STOP.

## Решение

Реализована **многоуровневая защита** от автозапуска после ручного STOP:

### 1. **Проверка флага `manualStops` во всех механизмах автозапуска**

Добавлена проверка в `autoRestoreWatchdog()` (строка 507-510):
```javascript
if (manualStops.has(playerId)) {
  logWithMs(`[AUTO-RESTORE-WATCHDOG] Player ${playerId} was manually stopped, skipping auto-restart`);
  continue;
}
```

### 2. **Удаление из `playerSelections` при STOP**

При нажатии STOP плеер удаляется из конфигурации автовосстановления (строки 1123-1129):
```javascript
const config = storage.getPlaybackConfig();
if (config.playerSelections && config.playerSelections[id]) {
  const filePath = config.playerSelections[id];
  delete config.playerSelections[id];
  storage.savePlaybackConfig(config.playerSelections, config.playerGroups || []);
  logWithMs(`[STOP] Player ${id} removed from auto-restore (was playing: ${filePath})`);
}
```

**Результат:** После перезагрузки сервера остановленные плееры НЕ запускаются автоматически.

### 3. **Добавление в `playerSelections` при PLAY**

При запуске плеера он возвращается в автовосстановление (строки 997-1002):
```javascript
const config = storage.getPlaybackConfig();
const mediaPath = new URL(fileUrl).pathname;
config.playerSelections[id] = mediaPath;
storage.savePlaybackConfig(config.playerSelections, config.playerGroups || []);
logWithMs(`[PLAY] Player ${id}: Added to auto-restore (file: ${mediaPath})`);
```

### 4. **Защита от перезаписи фронтендом**

Endpoint `/api/config/sync` фильтрует остановленные плееры (строки 1079-1091):
```javascript
for (const [playerId, filePath] of Object.entries(playerSelections)) {
  if (manualStops.has(playerId)) {
    logWithMs(`[CONFIG-SYNC] Player ${playerId} was manually stopped, NOT adding to auto-restore`);
    filteredCount++;
    continue;
  }
  filteredSelections[playerId] = filePath;
}
```

**Результат:** Даже если фронтенд попытается восстановить остановленный плеер в конфигурацию, сервер отклонит это.

---

## Механизмы автозапуска в системе

### 1. `monitorPlayerForRepeat()` (строка 140)
- **Назначение:** Индивидуальный мониторинг каждого плеера для автоповтора трека
- **Частота:** Каждые 0.5-2 секунды
- **Защита:** ✅ Проверяет `manualStops` (строка 229)

### 2. `globalRepeatController()` (строка 220)
- **Назначение:** Глобальная проверка всех плееров и групп
- **Частота:** Каждые 15 секунд
- **Защита:** ✅ Проверяет `manualStops` (строки 229, 295, 320)

### 3. `autoRestorePlayback()` (строка 374)
- **Назначение:** Восстановление воспроизведения при старте сервера
- **Частота:** Однократно через 5 секунд после старта
- **Защита:** ✅ Использует `playerSelections` (из которого удалены остановленные плееры)

### 4. `autoRestoreWatchdog()` (строка 489)
- **Назначение:** Проверка что все плееры запустились корректно
- **Частота:** Каждую минуту
- **Защита:** ✅ **ИСПРАВЛЕНО** - добавлена проверка `manualStops` (строка 507)

---

## Тестовые сценарии

### ✅ Сценарий 1: Ручной STOP без перезагрузки

1. Запустить плеер с файлом
2. Нажать STOP
3. Подождать 1-2 минуты

**Ожидаемый результат:** Плеер остаётся остановленным, автозапуск НЕ срабатывает

**Логи для проверки:**
```
[STOP] Player ID=xxx marked as manually stopped
[STOP] Player xxx removed from auto-restore
[AUTO-RESTORE-WATCHDOG] Player xxx was manually stopped, skipping auto-restart
```

---

### ✅ Сценарий 2: STOP + перезагрузка сервера

1. Запустить плеер с файлом
2. Нажать STOP
3. Перезапустить сервер (`npm start`)
4. Проверить статус плеера

**Ожидаемый результат:** После перезагрузки плеер НЕ запускается

**Логи для проверки:**
```
[AUTO-RESTORE] Found N players with file assignments
(плеер xxx НЕ должен быть в списке)
```

---

### ✅ Сценарий 3: STOP → PLAY → Автовосстановление

1. Запустить плеер
2. Нажать STOP
3. Нажать PLAY (с файлом)
4. Перезапустить сервер

**Ожидаемый результат:**
- После STOP: плеер не запускается автоматически
- После PLAY: плеер добавляется в автовосстановление
- После перезагрузки: плеер запускается автоматически

**Логи для проверки:**
```
[STOP] Player xxx removed from auto-restore
[PLAY] Player xxx: Removed manual stop flag
[PLAY] Player xxx: Added to auto-restore (file: /media/...)
[AUTO-RESTORE] Started player xxx
```

---

### ✅ Сценарий 4: Выбор файла в UI после STOP

1. Запустить плеер
2. Нажать STOP
3. Выбрать файл в выпадающем списке (НЕ нажимая PLAY)
4. Подождать 1-2 минуты

**Ожидаемый результат:** Плеер НЕ запускается автоматически (выбор файла ≠ команда PLAY)

**Логи для проверки:**
```
[CONFIG-SYNC] Player xxx was manually stopped, NOT adding to auto-restore
[CONFIG-SYNC] Saved configuration: N players (filtered 1)
```

---

### ✅ Сценарий 5: Групповой STOP

1. Запустить группу плееров
2. Нажать "Остановить все"
3. Подождать 1-2 минуты

**Ожидаемый результат:** Все плееры остаются остановленными

**Логи для проверки:**
```
[STOP] Player xxx1 marked as manually stopped
[STOP] Player xxx2 marked as manually stopped
...
[AUTO-RESTORE-WATCHDOG] Player xxx1 was manually stopped, skipping auto-restart
[AUTO-RESTORE-WATCHDOG] Player xxx2 was manually stopped, skipping auto-restart
```

---

### ✅ Сценарий 6: Сбой плеера (отключение WiFi)

1. Запустить плеер
2. Отключить WiFi на плеере или отключить его от питания
3. Подождать 1-2 минуты
4. Включить плеер обратно

**Ожидаемый результат:** Плеер автоматически перезапускается (это НЕ ручной STOP, это сбой)

**Логи для проверки:**
```
[AUTO-RESTORE-WATCHDOG] Found 1 players not playing, restarting...
[AUTO-RESTORE-WATCHDOG] Restarted player xxx
```

---

## Файлы изменены

1. **server.js** (4 изменения):
   - Строки 507-510: Проверка `manualStops` в `autoRestoreWatchdog()`
   - Строки 997-1002: Добавление в `playerSelections` при PLAY
   - Строки 1079-1091: Фильтрация в `/api/config/sync`
   - Строки 1123-1129: Удаление из `playerSelections` при STOP

## Логирование

Все изменения имеют подробное логирование для отладки:

- `[STOP]` - операции остановки
- `[PLAY]` - операции запуска
- `[AUTO-RESTORE]` - автовосстановление при старте
- `[AUTO-RESTORE-WATCHDOG]` - проверка воспроизведения
- `[GLOBAL-CTRL]` - глобальный контроллер повтора
- `[CONFIG-SYNC]` - синхронизация с фронтендом

## Резюме

**STOP = STOP**
- ✅ Останавливает мониторинг
- ✅ Добавляет флаг `manualStops`
- ✅ Удаляет из `playerSelections`
- ✅ Предотвращает автозапуск навсегда (до следующего PLAY)

**PLAY = PLAY**
- ✅ Запускает воспроизведение
- ✅ Снимает флаг `manualStops`
- ✅ Добавляет в `playerSelections`
- ✅ Включает автовосстановление после перезагрузки

**Автовосстановление = только после сбоев или перезагрузки**
- ✅ При старте сервера запускает плееры из `playerSelections`
- ✅ При сбое плеера (WiFi, питание) перезапускает автоматически
- ✅ НЕ трогает плееры с флагом `manualStops`
