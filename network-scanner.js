import https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class NetworkScanner {
  constructor(subnet = '192.168.1') {
    this.subnet = subnet;
  }

  // Проверка одного IP на наличие WiiM устройства
  async checkWiiMDevice(ip) {
    // ТОЛЬКО проверка через API - это единственный надёжный способ
    // Веб-интерфейс есть у многих устройств (камеры, роутеры и т.д.)
    const apiResult = await this.checkWiiMAPI(ip);
    return apiResult;
  }

  // Проверка через httpapi.asp
  async checkWiiMAPI(ip) {
    return new Promise((resolve) => {
      const agent = new https.Agent({
        rejectUnauthorized: false
      });

      const options = {
        hostname: ip,
        port: 443,
        path: '/httpapi.asp?command=getStatusEx',
        method: 'GET',
        agent: agent,
        timeout: 5000
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            // Строгая проверка: устройство должно иметь специфичные для WiiM/Linkplay поля
            const isWiiM = (
              (json.DeviceName !== undefined || json.uuid !== undefined) &&
              (json.firmware !== undefined || json.project !== undefined || json.hardware !== undefined)
            );

            if (isWiiM) {
              console.log(`[SCAN] Найден WiiM (API): ${ip} - Имя: ${json.DeviceName || 'Unknown'}, UUID: ${json.uuid || 'Unknown'}, FW: ${json.firmware || 'N/A'}`);
              resolve({ ip, found: true, data: json, method: 'api' });
            } else {
              // Устройство ответило JSON, но это не WiiM
              console.log(`[SCAN] ${ip} - Ответил JSON, но не WiiM устройство`);
              resolve({ ip, found: false });
            }
          } catch (e) {
            // Не JSON или ошибка парсинга - точно не WiiM
            resolve({ ip, found: false });
          }
        });
      });

      req.on('error', () => {
        resolve({ ip, found: false });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ ip, found: false });
      });

      req.end();
    });
  }

  // УДАЛЕНО: Проверка через веб-интерфейс больше не используется
  // Причина: слишком много false positives (камеры, роутеры и т.д. тоже имеют /doc/index.html)
  // Теперь обнаруживаются ТОЛЬКО устройства с работающим WiiM API

  // Сканирование подсети
  async scanSubnet(start = 1, end = 254) {
    console.log(`Сканирование ${this.subnet}.${start}-${end}...`);
    const promises = [];

    for (let i = start; i <= end; i++) {
      const ip = `${this.subnet}.${i}`;
      promises.push(this.checkWiiMDevice(ip));
    }

    const results = await Promise.all(promises);
    const found = results.filter(r => r.found);

    console.log(`\nНайдено WiiM устройств: ${found.length}`);
    found.forEach(device => {
      console.log(`  IP: ${device.ip}`);
      console.log(`  Статус: ${device.data.status || 'unknown'}`);
      console.log(`  Громкость: ${device.data.vol || 'unknown'}`);
      console.log('');
    });

    return found;
  }

  // Быстрое сканирование - сканирует всю подсеть параллельно
  async quickScan() {
    console.log(`Быстрое сканирование сети ${this.subnet}.0/24...`);
    console.log(`Проверка IP адресов от ${this.subnet}.1 до ${this.subnet}.254...`);

    // Сканируем весь диапазон параллельно с коротким таймаутом
    const promises = [];
    for (let i = 1; i <= 254; i++) {
      const ip = `${this.subnet}.${i}`;
      promises.push(this.checkWiiMDevice(ip));
    }

    console.log('Запущена параллельная проверка 254 адресов...');
    const results = await Promise.all(promises);
    const found = results.filter(r => r.found);

    console.log(`\nНайдено WiiM устройств: ${found.length}`);
    found.forEach(device => {
      console.log(`  IP: ${device.ip}`);
      console.log(`  Имя: ${device.data.DeviceName || 'unknown'}`);
      console.log(`  Статус: ${device.data.status || 'unknown'}`);
      console.log('');
    });

    return found;
  }
}

export default NetworkScanner;
