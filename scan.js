import NetworkScanner from './network-scanner.js';

const scanner = new NetworkScanner('192.168.1');

console.log('=== WiiM Network Scanner ===\n');

// Запускаем быстрое сканирование
const devices = await scanner.quickScan();

if (devices.length === 0) {
  console.log('\nWiiM устройства не найдены.');
  console.log('Попробуйте полное сканирование: node scan.js --full');
} else {
  console.log('\nДля использования найденного устройства:');
  console.log(`1. Обновите .env файл:`);
  devices.forEach(d => {
    console.log(`   WIIM_IP=${d.ip}`);
  });
  console.log('2. Перезапустите сервер: npm start');
}

process.exit(0);
