# Инструкция по тестированию исправления автозапуска

## Быстрый тест (2 минуты)

### 1. Запустить сервер
```bash
npm start
```

### 2. Открыть браузер
```
http://192.168.0.X:3000
```

### 3. Основной тест: STOP должен останавливать навсегда

**Шаги:**
1. Выбрать файл для любого плеера
2. Нажать кнопку **▶ Играть**
3. Убедиться что плеер запустился
4. Нажать кнопку **⏹ Стоп**
5. Подождать **2-3 минуты**

**Ожидаемый результат:**
- ✅ Плеер остаётся остановленным
- ✅ НЕ запускается автоматически через минуту
- ✅ Статус плеера: `stop`

**Если плеер перезапустился → БАГ НЕ ИСПРАВЛЕН**

---

## Проверка логов

### 1. Смотрим логи в консоли сервера

**При STOP должны быть строки:**
```
[STOP] Player ID=xxx marked as manually stopped
[STOP] Player xxx removed from auto-restore (was playing: /media/...)
```

**Через 1 минуту после STOP:**
```
[AUTO-RESTORE-WATCHDOG] Player xxx was manually stopped, skipping auto-restart
```

**НЕ ДОЛЖНО БЫТЬ:**
```
[AUTO-RESTORE-WATCHDOG] Restarted player xxx  ← ЭТО ОШИБКА!
```

---

## Полный тест после перезагрузки

### 1. Запустить плеер
1. Выбрать файл
2. Нажать **▶ Играть**
3. Убедиться что играет

### 2. Остановить
1. Нажать **⏹ Стоп**
2. Проверить логи (должен быть `[STOP] Player xxx removed from auto-restore`)

### 3. Перезапустить сервер
```bash
# В консоли нажать Ctrl+C
npm start
```

### 4. Проверить результат

**Ожидаемый результат:**
- ✅ Остановленный плеер НЕ запускается
- ✅ В логах НЕТ строки `[AUTO-RESTORE] Started player xxx` для остановленного плеера

**Логи при старте:**
```
[AUTO-RESTORE] Found N players with file assignments
(остановленный плеер НЕ должен быть в этом списке)
```

---

## Тест восстановления после PLAY

### 1. Остановить плеер (STOP)
### 2. Снова запустить (PLAY)
### 3. Перезапустить сервер

**Ожидаемый результат:**
- ✅ После повторного PLAY плеер снова добавляется в автовосстановление
- ✅ После перезагрузки плеер запускается автоматически

**Логи при PLAY:**
```
[PLAY] Player xxx: Removed manual stop flag
[PLAY] Player xxx: Added to auto-restore (file: /media/...)
```

**Логи после перезагрузки:**
```
[AUTO-RESTORE] Started player xxx
```

---

## Проверка файла playback-state.json

### Посмотреть текущее состояние:
```bash
cat data/playback-state.json
```

**После STOP плеера:**
```json
{
  "playerSelections": {
    "player1": "/media/file1.mp3",
    // Остановленный плеер ОТСУТСТВУЕТ в списке!
  },
  "playerGroups": [],
  "lastUpdated": "2025-12-18T..."
}
```

**После PLAY:**
```json
{
  "playerSelections": {
    "player1": "/media/file1.mp3",
    "stopped_player": "/media/file2.mp3"  // Появился обратно!
  },
  "playerGroups": [],
  "lastUpdated": "2025-12-18T..."
}
```

---

## Частые проблемы

### ❌ Плеер всё равно запускается через минуту

**Причина:** Старая версия сервера или кэш браузера

**Решение:**
1. Убедиться что сервер перезапущен после изменений
2. Очистить кэш браузера (Ctrl+Shift+R)
3. Проверить что в `server.js` есть строка 507: `if (manualStops.has(playerId))`

### ❌ После перезагрузки остановленный плеер запускается

**Причина:** Файл `playback-state.json` не обновился

**Решение:**
1. Проверить логи - должна быть строка `[STOP] Player xxx removed from auto-restore`
2. Проверить содержимое `data/playback-state.json`
3. Убедиться что у файла есть права на запись

### ❌ В логах нет строки про `manualStops`

**Причина:** Изменения не применились

**Решение:**
```bash
# Остановить сервер
Ctrl+C

# Проверить синтаксис
node --check server.js

# Запустить снова
npm start
```

---

## Успешный тест выглядит так:

```
[PLAY] Player xxx: Added to auto-restore (file: /media/test.mp3)
→ Плеер играет

[STOP] Player xxx marked as manually stopped
[STOP] Player xxx removed from auto-restore (was playing: /media/test.mp3)
→ Плеер остановлен

... подождать 1-2 минуты ...

[AUTO-RESTORE-WATCHDOG] Checking if all players are playing...
[AUTO-RESTORE-WATCHDOG] Player xxx was manually stopped, skipping auto-restart
[AUTO-RESTORE-WATCHDOG] All players are playing correctly
→ Плеер НЕ перезапустился ✅

... перезапустить сервер ...

[AUTO-RESTORE] Found 5 players with file assignments
[AUTO-RESTORE] Started player yyy
[AUTO-RESTORE] Started player zzz
(player xxx НЕ в списке)
→ Остановленный плеер НЕ запустился ✅
```

---

## Если тест провален

1. Создать issue на GitHub с логами
2. Приложить содержимое `data/playback-state.json`
3. Указать версию Node.js: `node --version`
4. Указать что именно не работает
