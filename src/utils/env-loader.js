/**
 * Загрузчик переменных окружения из .env файла
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Загрузить .env файл
 */
export function loadEnv() {
  try {
    const envPath = join(__dirname, '../../.env');
    const envFile = readFileSync(envPath, 'utf-8');
    const lines = envFile.split('\n');

    lines.forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        process.env[key.trim()] = value;
      }
    });

    console.log('✅ .env файл загружен');
  } catch (error) {
    console.log('⚠️  Warning: .env file not found, using defaults');
  }
}

/**
 * Получить конфигурацию из env переменных
 * @returns {Object} конфигурация
 */
export function getConfig() {
  return {
    port: process.env.PORT || 3000,
    useHttps: process.env.WIIM_USE_HTTPS !== 'false',
    requestTimeout: parseInt(process.env.WIIM_REQUEST_TIMEOUT) || 5000,
    enableStats: process.env.ENABLE_STATS === 'true'
  };
}
