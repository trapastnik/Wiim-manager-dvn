import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { networkInterfaces } from 'os';

// Модули приложения
import WiiMClient from './wiim-client.js';
import NetworkScanner from './network-scanner.js';
import storage from './storage.js';
import { loadEnv } from './src/utils/env-loader.js';
import { logWithMs } from './src/utils/logger.js';
import * as statsService from './src/services/stats.service.js';
import * as autoRepeatService from './src/services/auto-repeat.service.js';
import { statsMiddleware } from './src/middleware/stats.middleware.js';
import { errorMiddleware, notFoundMiddleware } from './src/middleware/error.middleware.js';
import { createApiRouter } from './src/routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загрузка переменных окружения
loadEnv();

// Конфигурация
const PORT = process.env.PORT || 3000;
const USE_HTTPS = process.env.WIIM_USE_HTTPS !== 'false';
const REQUEST_TIMEOUT = parseInt(process.env.WIIM_REQUEST_TIMEOUT) || 5000;
const ENABLE_STATS = process.env.ENABLE_STATS === 'true';

// Инициализация Express
const app = express();

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/media', express.static('media'));

// Middleware статистики (опционально)
if (ENABLE_STATS) {
  logWithMs('📊 Статистика сервера ВКЛЮЧЕНА (ENABLE_STATS=true)');
  app.use(statsMiddleware(statsService));
} else {
  logWithMs('📊 Статистика сервера ОТКЛЮЧЕНА (для включения: ENABLE_STATS=true)');
}

// Инициализация клиентов и сервисов
const wiimClient = new WiiMClient({
  useHttps: USE_HTTPS,
  timeout: REQUEST_TIMEOUT
});

const networkScanner = new NetworkScanner();

// Зависимости для роутеров
const dependencies = {
  wiimClient,
  storage,
  networkScanner,
  statsService
};

// API маршруты
app.use('/api', createApiRouter(dependencies));

// Middleware обработки ошибок (должен быть последним)
app.use(notFoundMiddleware);
app.use(errorMiddleware);

// Запуск сервера
app.listen(PORT, () => {
  const interfaces = networkInterfaces();
  const addresses = [];

  for (const iface of Object.values(interfaces)) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) {
        addresses.push(addr.address);
      }
    }
  }

  logWithMs(`🚀 Сервер запущен на порту ${PORT}`);
  logWithMs(`🌐 Локально: http://localhost:${PORT}`);
  if (addresses.length > 0) {
    logWithMs(`🌐 В сети: http://${addresses[0]}:${PORT}`);
  }
  logWithMs(`🔒 HTTPS для WiiM: ${USE_HTTPS ? 'включен' : 'выключен'}`);
  logWithMs(`⏱️  Таймаут запросов: ${REQUEST_TIMEOUT}ms`);
});

// Обработка завершения процесса
process.on('SIGINT', () => {
  logWithMs('⏹️  Получен сигнал SIGINT, завершение работы...');

  // Остановка авто-повтора
  autoRepeatService.stopMonitoring();

  process.exit(0);
});

process.on('SIGTERM', () => {
  logWithMs('⏹️  Получен сигнал SIGTERM, завершение работы...');

  // Остановка авто-повтора
  autoRepeatService.stopMonitoring();

  process.exit(0);
});
