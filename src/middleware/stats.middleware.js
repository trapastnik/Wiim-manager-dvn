/**
 * Middleware для подсчета статистики запросов
 */

import { incrementRequests, addSentTraffic, addReceivedTraffic } from '../services/stats.service.js';

/**
 * Middleware для статистики (опционально, можно отключить для производительности)
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
export function statsMiddleware(req, res, next) {
  incrementRequests();

  // Подсчет по категориям
  if (req.path.includes('/status') || req.path.includes('/info')) {
    incrementRequests('status');
  } else if (req.path.includes('/control') || req.path.includes('/volume')) {
    incrementRequests('control');
  } else if (req.path.includes('/media')) {
    incrementRequests('media');
  } else if (req.path.includes('/players')) {
    incrementRequests('players');
  }

  // Подсчет трафика
  const originalSend = res.send;

  res.send = function(data) {
    const responseSize = Buffer.byteLength(JSON.stringify(data));
    addSentTraffic(responseSize);
    return originalSend.call(this, data);
  };

  if (req.body) {
    const requestSize = Buffer.byteLength(JSON.stringify(req.body));
    addReceivedTraffic(requestSize);
  }

  next();
}
