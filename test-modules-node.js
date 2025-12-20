/**
 * Автоматическое тестирование модулей (без браузера)
 * Проверяет синтаксис и структуру всех модулей
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Автоматическое тестирование модулей WiiM\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`✅ ${name}`);
    return true;
  } catch (error) {
    failedTests++;
    console.log(`❌ ${name}: ${error.message}`);
    return false;
  }
}

// Тест 1: Проверка наличия файлов
console.log('📂 Проверка наличия файлов модулей...\n');

const modules = [
  'public/js/state/AppState.js',
  'public/js/api/base-api.js',
  'public/js/api/players-api.js',
  'public/js/api/media-api.js',
  'public/js/api/config-api.js',
  'public/js/ui/messages.js',
  'public/js/ui/tabs.js',
  'public/js/utils/format.js',
  'public/js/utils/dom.js',
  'public/js/app-main.js'
];

modules.forEach(modulePath => {
  test(`Файл существует: ${modulePath}`, () => {
    const fullPath = join(__dirname, modulePath);
    const content = readFileSync(fullPath, 'utf-8');
    if (content.length === 0) throw new Error('Файл пустой');
  });
});

// Тест 2: Проверка синтаксиса импортов/экспортов
console.log('\n📦 Проверка ES6 синтаксиса...\n');

test('AppState.js экспортирует appState', () => {
  const content = readFileSync(join(__dirname, 'public/js/state/AppState.js'), 'utf-8');
  if (!content.includes('export const appState')) throw new Error('Нет экспорта appState');
  if (!content.includes('class AppState')) throw new Error('Нет класса AppState');
});

test('base-api.js экспортирует функции', () => {
  const content = readFileSync(join(__dirname, 'public/js/api/base-api.js'), 'utf-8');
  if (!content.includes('export async function get')) throw new Error('Нет экспорта get');
  if (!content.includes('export async function post')) throw new Error('Нет экспорта post');
  if (!content.includes('export async function del')) throw new Error('Нет экспорта del');
});

test('players-api.js импортирует base-api', () => {
  const content = readFileSync(join(__dirname, 'public/js/api/players-api.js'), 'utf-8');
  if (!content.includes("import { get, post, del } from './base-api.js'")) {
    throw new Error('Нет импорта base-api');
  }
});

test('format.js экспортирует утилиты', () => {
  const content = readFileSync(join(__dirname, 'public/js/utils/format.js'), 'utf-8');
  if (!content.includes('export function formatFileSize')) throw new Error('Нет formatFileSize');
  if (!content.includes('export function formatTime')) throw new Error('Нет formatTime');
  if (!content.includes('export function formatTimestamp')) throw new Error('Нет formatTimestamp');
});

test('messages.js импортирует зависимости', () => {
  const content = readFileSync(join(__dirname, 'public/js/ui/messages.js'), 'utf-8');
  if (!content.includes("import { appState }")) throw new Error('Нет импорта appState');
  if (!content.includes('export function addMessage')) throw new Error('Нет экспорта addMessage');
});

test('app-main.js импортирует все модули', () => {
  const content = readFileSync(join(__dirname, 'public/js/app-main.js'), 'utf-8');
  if (!content.includes("import { appState }")) throw new Error('Нет импорта appState');
  if (!content.includes("import * as PlayersAPI")) throw new Error('Нет импорта PlayersAPI');
  if (!content.includes('window.appState')) throw new Error('Нет экспорта в window');
});

// Тест 3: Проверка структуры модулей
console.log('\n🔍 Проверка структуры модулей...\n');

test('AppState имеет необходимые методы', () => {
  const content = readFileSync(join(__dirname, 'public/js/state/AppState.js'), 'utf-8');
  const methods = ['getPlayers', 'setPlayers', 'getPlayerStatus', 'setPlayerStatus',
                   'enableDemoMode', 'disableDemoMode', 'reset'];
  methods.forEach(method => {
    if (!content.includes(method)) throw new Error(`Нет метода ${method}`);
  });
});

test('players-api.js имеет все API методы', () => {
  const content = readFileSync(join(__dirname, 'public/js/api/players-api.js'), 'utf-8');
  const methods = ['getPlayers', 'scanPlayers', 'addPlayer', 'removePlayer',
                   'playMedia', 'pausePlayer', 'stopPlayer', 'setVolume'];
  methods.forEach(method => {
    if (!content.includes(`export async function ${method}`)) {
      throw new Error(`Нет метода ${method}`);
    }
  });
});

test('format.js использует правильные форматы', () => {
  const content = readFileSync(join(__dirname, 'public/js/utils/format.js'), 'utf-8');
  if (!content.includes('padStart')) throw new Error('Нет использования padStart');
  if (!content.includes('Math.floor')) throw new Error('Нет Math.floor');
});

// Тест 4: Проверка размеров модулей
console.log('\n📏 Проверка размеров модулей...\n');

modules.forEach(modulePath => {
  test(`Размер модуля ${modulePath.split('/').pop()} < 300 строк`, () => {
    const content = readFileSync(join(__dirname, modulePath), 'utf-8');
    const lines = content.split('\n').length;
    if (lines > 300) throw new Error(`Модуль слишком большой: ${lines} строк`);
  });
});

// Тест 5: Проверка отсутствия глобальных переменных в модулях
console.log('\n🌐 Проверка отсутствия глобальных переменных...\n');

const noGlobalVarsModules = [
  'public/js/api/base-api.js',
  'public/js/api/players-api.js',
  'public/js/utils/format.js'
];

noGlobalVarsModules.forEach(modulePath => {
  test(`${modulePath.split('/').pop()} не использует var/let/const в глобальной области`, () => {
    const content = readFileSync(join(__dirname, modulePath), 'utf-8');
    // Удаляем комментарии и импорты/экспорты
    const cleanContent = content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '')
      .replace(/^import .*/gm, '')
      .replace(/^export .*/gm, '');

    // Проверяем что нет глобальных var/let/const (кроме внутри функций)
    const globalVars = cleanContent.match(/^(var|let|const)\s+\w+/gm);
    if (globalVars && globalVars.length > 0) {
      throw new Error(`Найдены глобальные переменные: ${globalVars.join(', ')}`);
    }
  });
});

// Итоги
console.log('\n' + '='.repeat(60));
console.log('📊 Результаты тестирования:\n');
console.log(`Всего тестов: ${totalTests}`);
console.log(`Пройдено: ${passedTests} ✅`);
console.log(`Провалено: ${failedTests} ❌`);
console.log(`Процент успеха: ${Math.round((passedTests / totalTests) * 100)}%`);
console.log('='.repeat(60));

if (failedTests === 0) {
  console.log('\n🎉 Все тесты пройдены успешно!\n');
  console.log('✨ Модульная система работает корректно');
  console.log('📝 Откройте http://localhost:3000/test-modules.html для интерактивных тестов');
  process.exit(0);
} else {
  console.log('\n⚠️  Некоторые тесты провалены\n');
  process.exit(1);
}
