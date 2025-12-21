/**
 * Middleware для обработки ошибок
 */

import { incrementErrors } from '../services/stats.service.js';
import { logCategory } from '../utils/logger.js';

/**
 * Middleware для обработки ошибок
 * @param {Error} err - ошибка
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
export function errorMiddleware(err, req, res, next) {
  incrementErrors();
  logCategory('ERROR', `${req.method} ${req.path}: ${err.message}`);

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    path: req.path
  });
}

/**
 * Middleware для 404 (не найдено)
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export function notFoundMiddleware(req, res) {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
}
