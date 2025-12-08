import https from 'https';
import http from 'http';

class WiiMClient {
  constructor(ipAddress, useHttps = true) {
    this.baseUrl = (useHttps ? 'https://' : 'http://') + ipAddress;
    this.useHttps = useHttps;
    this.agent = useHttps ? new https.Agent({ rejectUnauthorized: false }) : null;
  }

  decodeHex(hexString) {
    if (!hexString || hexString === 'Unknown') return 'Unknown';
    try {
      let str = '';
      for (let i = 0; i < hexString.length; i += 2) {
        const charCode = parseInt(hexString.substr(i, 2), 16);
        if (charCode > 0) str += String.fromCharCode(charCode);
      }
      return str || hexString;
    } catch (e) {
      return hexString;
    }
  }

  processPlayerData(data) {
    if (!data) return data;
    const processed = Object.assign({}, data);
    if (processed.Title) processed.Title = this.decodeHex(processed.Title);
    if (processed.Artist) processed.Artist = this.decodeHex(processed.Artist);
    if (processed.Album) processed.Album = this.decodeHex(processed.Album);
    if (processed.essid) processed.essid = this.decodeHex(processed.essid);
    return processed;
  }

  async request(endpoint, options = {}) {
    const url = this.baseUrl + endpoint;
    const client = this.useHttps ? https : http;
    return new Promise((resolve, reject) => {
      const req = client.get(url, Object.assign({}, options, { agent: this.agent, timeout: 5000 }), (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const result = data ? JSON.parse(data) : {};
            const processed = this.processPlayerData(result);
            resolve({ status: res.statusCode, data: processed });
          } catch (e) {
            resolve({ status: res.statusCode, data: data });
          }
        });
      });
      req.on('error', (error) => { reject(error); });
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      req.end();
    });
  }

  async getPlayerStatus() {
    try {
      return await this.request('/httpapi.asp?command=getPlayerStatus');
    } catch (error) {
      throw new Error('Failed to get player status: ' + error.message);
    }
  }

  async getStatusInfo() {
    try {
      // Используем getStatusEx для получения расширенной информации включая SSID, RSSI и другие данные
      return await this.request('/httpapi.asp?command=getStatusEx');
    } catch (error) {
      throw new Error('Failed to get status info: ' + error.message);
    }
  }

  async play() { return await this.request('/httpapi.asp?command=setPlayerCmd:play'); }
  async pause() { return await this.request('/httpapi.asp?command=setPlayerCmd:pause'); }
  async stop() { return await this.request('/httpapi.asp?command=setPlayerCmd:stop'); }
  async next() { return await this.request('/httpapi.asp?command=setPlayerCmd:next'); }
  async prev() { return await this.request('/httpapi.asp?command=setPlayerCmd:prev'); }
  
  async setVolume(volume) {
    const vol = Math.max(0, Math.min(100, parseInt(volume)));
    return await this.request('/httpapi.asp?command=setPlayerCmd:vol:' + vol);
  }
  
  async volumeUp() { return await this.request('/httpapi.asp?command=setPlayerCmd:vol+'); }
  async volumeDown() { return await this.request('/httpapi.asp?command=setPlayerCmd:vol-'); }
  async mute() { return await this.request('/httpapi.asp?command=setPlayerCmd:mute:1'); }
  async unmute() { return await this.request('/httpapi.asp?command=setPlayerCmd:mute:0'); }

  // Режимы повтора: 0 = один раз, 1 = повтор одной, 2 = повтор всех, -1 = случайный порядок
  async setLoopMode(mode) {
    const validModes = [0, 1, 2, -1];
    const loopMode = validModes.includes(mode) ? mode : 0;
    return await this.request('/httpapi.asp?command=setPlayerCmd:loopmode:' + loopMode);
  }

  async getDeviceInfo() {
    try {
      return await this.request('/httpapi.asp?command=getPlayerStatus');
    } catch (error) {
      throw new Error('Failed to get device info: ' + error.message);
    }
  }

  // Воспроизведение URL
  async playUrl(url) {
    try {
      const encodedUrl = encodeURIComponent(url);
      return await this.request('/httpapi.asp?command=setPlayerCmd:play:' + encodedUrl);
    } catch (error) {
      throw new Error('Failed to play URL: ' + error.message);
    }
  }
}

export default WiiMClient;
