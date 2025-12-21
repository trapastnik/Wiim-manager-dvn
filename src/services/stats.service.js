/**
 * Сервис статистики сервера
 */

// Статистика сервера
const serverStats = {
  startTime: Date.now(),
  requests: {
    total: 0,
    status: 0,
    control: 0,
    media: 0,
    players: 0
  },
  traffic: {
    sent: 0,
    received: 0
  },
  errors: 0,
  activeStreams: 0
};

/**
 * Увеличить счетчик запросов
 * @param {string} category - категория (status, control, media, players)
 */
export function incrementRequests(category = 'total') {
  serverStats.requests.total++;
  if (serverStats.requests[category] !== undefined) {
    serverStats.requests[category]++;
  }
}

/**
 * Добавить отправленный трафик
 * @param {number} bytes - количество байт
 */
export function addSentTraffic(bytes) {
  serverStats.traffic.sent += bytes;
}

/**
 * Добавить полученный трафик
 * @param {number} bytes - количество байт
 */
export function addReceivedTraffic(bytes) {
  serverStats.traffic.received += bytes;
}

/**
 * Увеличить счетчик ошибок
 */
export function incrementErrors() {
  serverStats.errors++;
}

/**
 * Установить количество активных стримов
 * @param {number} count - количество
 */
export function setActiveStreams(count) {
  serverStats.activeStreams = count;
}

/**
 * Получить статистику
 * @returns {Object}
 */
export function getStats() {
  const uptime = Date.now() - serverStats.startTime;

  return {
    uptime,
    requests: serverStats.requests,
    traffic: serverStats.traffic,
    errors: serverStats.errors,
    activeStreams: serverStats.activeStreams,
    requestsPerSecond: (serverStats.requests.total / (uptime / 1000)).toFixed(2)
  };
}

/**
 * Сбросить статистику
 */
export function resetStats() {
  serverStats.startTime = Date.now();
  serverStats.requests = {
    total: 0,
    status: 0,
    control: 0,
    media: 0,
    players: 0
  };
  serverStats.traffic = {
    sent: 0,
    received: 0
  };
  serverStats.errors = 0;
  serverStats.activeStreams = 0;
}
