import { exec } from 'child_process';
import { promisify } from 'util';
import { networkInterfaces, totalmem, freemem } from 'os';

const execAsync = promisify(exec);

class ServerInfo {
  constructor() {
    this.platform = process.platform;
  }

  // Получить информацию о WiFi сети сервера
  async getWiFiInfo() {
    try {
      if (this.platform === 'linux') {
        return await this.getLinuxWiFiInfo();
      } else if (this.platform === 'darwin') {
        return await this.getMacOSWiFiInfo();
      } else {
        return this.getBasicNetworkInfo();
      }
    } catch (error) {
      console.error('[SERVER-INFO] Error getting WiFi info:', error.message);
      return this.getBasicNetworkInfo();
    }
  }

  // Получить WiFi информацию на Linux (Raspberry Pi)
  async getLinuxWiFiInfo() {
    try {
      const wifiInfo = {
        platform: 'Linux',
        interface: null,
        ssid: 'N/A',
        signal: 'N/A',
        frequency: 'N/A',
        bitrate: 'N/A',
        ip: 'N/A'
      };

      // Найти WiFi интерфейс (обычно wlan0)
      const interfaces = networkInterfaces();
      let wifiInterface = null;

      // Проверяем стандартные имена WiFi интерфейсов
      for (const [name, addrs] of Object.entries(interfaces)) {
        if (name.startsWith('wlan') || name.startsWith('wlp')) {
          wifiInterface = name;
          // Получаем IP адрес
          const ipv4 = addrs.find(addr => addr.family === 'IPv4' && !addr.internal);
          if (ipv4) {
            wifiInfo.ip = ipv4.address;
          }
          break;
        }
      }

      if (!wifiInterface) {
        console.log('[SERVER-INFO] WiFi interface not found, using basic info');
        return this.getBasicNetworkInfo();
      }

      wifiInfo.interface = wifiInterface;

      // Получаем детальную информацию через iwconfig
      try {
        const { stdout: iwconfig } = await execAsync(`iwconfig ${wifiInterface} 2>/dev/null`);

        // SSID
        const ssidMatch = iwconfig.match(/ESSID:"([^"]+)"/);
        if (ssidMatch) {
          wifiInfo.ssid = ssidMatch[1];
        }

        // Частота
        const freqMatch = iwconfig.match(/Frequency:([\d.]+)\s+GHz/);
        if (freqMatch) {
          wifiInfo.frequency = freqMatch[1] + ' GHz';
        }

        // Битрейт
        const bitrateMatch = iwconfig.match(/Bit Rate[=:]([\d.]+)\s+Mb\/s/);
        if (bitrateMatch) {
          wifiInfo.bitrate = bitrateMatch[1] + ' Mb/s';
        }

        // Уровень сигнала
        const signalMatch = iwconfig.match(/Signal level[=:]([-\d]+)\s+dBm/);
        if (signalMatch) {
          wifiInfo.signal = signalMatch[1] + ' dBm';
        }
      } catch (err) {
        console.log('[SERVER-INFO] iwconfig failed, trying iw');

        // Пробуем альтернативную команду iw
        try {
          const { stdout: iw } = await execAsync(`iw dev ${wifiInterface} link 2>/dev/null`);

          // SSID
          const ssidMatch = iw.match(/SSID:\s+(.+)/);
          if (ssidMatch) {
            wifiInfo.ssid = ssidMatch[1].trim();
          }

          // Частота
          const freqMatch = iw.match(/freq:\s+([\d]+)/);
          if (freqMatch) {
            const freq = parseInt(freqMatch[1]);
            wifiInfo.frequency = (freq / 1000).toFixed(1) + ' GHz';
          }

          // Уровень сигнала
          const signalMatch = iw.match(/signal:\s+([-\d]+)\s+dBm/);
          if (signalMatch) {
            wifiInfo.signal = signalMatch[1] + ' dBm';
          }
        } catch (iwErr) {
          console.log('[SERVER-INFO] iw also failed');
        }
      }

      return wifiInfo;
    } catch (error) {
      console.error('[SERVER-INFO] Linux WiFi info error:', error.message);
      return this.getBasicNetworkInfo();
    }
  }

  // Получить WiFi информацию на macOS
  async getMacOSWiFiInfo() {
    try {
      const wifiInfo = {
        platform: 'macOS',
        interface: 'en0',
        ssid: 'N/A',
        signal: 'N/A',
        frequency: 'N/A',
        bitrate: 'N/A',
        ip: 'N/A'
      };

      // Получаем IP адрес
      const interfaces = networkInterfaces();
      const en0 = interfaces.en0;
      if (en0) {
        const ipv4 = en0.find(addr => addr.family === 'IPv4' && !addr.internal);
        if (ipv4) {
          wifiInfo.ip = ipv4.address;
        }
      }

      try {
        // Пробуем получить SSID через networksetup
        const { stdout: ssidOutput } = await execAsync('networksetup -getairportnetwork en0 2>/dev/null');
        const ssidMatch = ssidOutput.match(/Current Wi-Fi Network:\s+(.+)/);
        if (ssidMatch) {
          wifiInfo.ssid = ssidMatch[1].trim();
        }
      } catch (err) {
        console.log('[SERVER-INFO] networksetup failed for SSID');
      }

      // Получаем детальную информацию через system_profiler
      try {
        const { stdout } = await execAsync('system_profiler SPAirPortDataType 2>/dev/null');

        // PHY Mode (802.11ac, ax, etc)
        const phyMatch = stdout.match(/PHY Mode:\s+802\.11(\w+)/);
        if (phyMatch) {
          wifiInfo.bitrate = '802.11' + phyMatch[1];
        }

        // Канал и частота
        const channelMatch = stdout.match(/Channel:\s+([\d]+)\s+\(([\d.]+)GHz/);
        if (channelMatch) {
          wifiInfo.frequency = channelMatch[2] + ' GHz';
        }

        // Если SSID не получили через networksetup, пробуем из system_profiler
        if (wifiInfo.ssid === 'N/A') {
          // Ищем текущую сеть (между "Current Network Information:" и следующей секцией)
          const networkMatch = stdout.match(/Current Network Information:\s+([^\s:]+):/);
          if (networkMatch && networkMatch[1] !== '<redacted>') {
            wifiInfo.ssid = networkMatch[1];
          } else if (networkMatch && networkMatch[1] === '<redacted>') {
            wifiInfo.ssid = 'Скрыто (Hidden)';
          }
        }

        // Пробуем получить уровень сигнала через дополнительную команду
        try {
          const { stdout: airportInfo } = await execAsync('/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I 2>/dev/null');

          const rssiMatch = airportInfo.match(/agrCtlRSSI:\s+([-\d]+)/);
          if (rssiMatch) {
            wifiInfo.signal = rssiMatch[1] + ' dBm';
          }
        } catch (airportErr) {
          // airport команда может не быть доступна на некоторых Mac
          console.log('[SERVER-INFO] airport command not available');
        }

      } catch (err) {
        console.log('[SERVER-INFO] system_profiler failed');
      }

      return wifiInfo;
    } catch (error) {
      console.error('[SERVER-INFO] macOS WiFi info error:', error.message);
      return this.getBasicNetworkInfo();
    }
  }

  // Базовая информация о сети (fallback)
  getBasicNetworkInfo() {
    const interfaces = networkInterfaces();
    let ip = 'N/A';
    let interfaceName = 'unknown';

    // Ищем первый не-loopback IPv4 адрес
    for (const [name, addrs] of Object.entries(interfaces)) {
      const ipv4 = addrs.find(addr => addr.family === 'IPv4' && !addr.internal);
      if (ipv4) {
        ip = ipv4.address;
        interfaceName = name;
        break;
      }
    }

    return {
      platform: this.platform,
      interface: interfaceName,
      ssid: 'N/A',
      signal: 'N/A',
      frequency: 'N/A',
      bitrate: 'N/A',
      ip: ip
    };
  }

  // Получить полную информацию о сервере
  async getServerStatus() {
    const wifiInfo = await this.getWiFiInfo();

    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memory: {
        total: Math.round(totalmem() / 1024 / 1024), // MB
        free: Math.round(freemem() / 1024 / 1024),   // MB
        used: Math.round((totalmem() - freemem()) / 1024 / 1024)
      },
      wifi: wifiInfo
    };
  }
}

export default new ServerInfo();
