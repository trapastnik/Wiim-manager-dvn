import express from 'express';
import * as scannerController from '../controllers/scanner.controller.js';

/**
 * Маршруты для сканирования сети
 */
export function createScannerRouter(networkScanner) {
  const router = express.Router();

  // Сканировать сеть на наличие WiiM устройств
  router.post('/scan', (req, res) =>
    scannerController.scanNetwork(req, res, networkScanner)
  );

  return router;
}
