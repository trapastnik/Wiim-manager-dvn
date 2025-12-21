/**
 * Сервис для отслеживания прогресса сканирования
 */

let scanProgress = {
  isScanning: false,
  current: 0,
  total: 254,
  progress: 0,
  currentIP: '',
  found: 0,
  devices: []
};

export function updateProgress(data) {
  scanProgress = {
    ...scanProgress,
    ...data,
    isScanning: true
  };
}

export function startScan() {
  scanProgress = {
    isScanning: true,
    current: 0,
    total: 254,
    progress: 0,
    currentIP: '',
    found: 0,
    devices: []
  };
}

export function completeScan(devices = []) {
  scanProgress = {
    ...scanProgress,
    isScanning: false,
    progress: 100,
    devices: devices
  };
}

export function getProgress() {
  return { ...scanProgress };
}

export function resetProgress() {
  scanProgress = {
    isScanning: false,
    current: 0,
    total: 254,
    progress: 0,
    currentIP: '',
    found: 0,
    devices: []
  };
}
