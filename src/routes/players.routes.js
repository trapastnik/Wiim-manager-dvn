import express from 'express';
import * as playersController from '../controllers/players.controller.js';

/**
 * Маршруты для управления плеерами
 */
export function createPlayersRouter(wiimClient, storage) {
  const router = express.Router();

  // Получить список всех плееров
  router.get('/', (req, res) =>
    playersController.getPlayers(req, res, wiimClient, storage)
  );

  // Добавить плеер
  router.post('/', (req, res) =>
    playersController.addPlayer(req, res, storage)
  );

  // Удалить плеер
  router.delete('/:id', (req, res) =>
    playersController.removePlayer(req, res, storage)
  );

  // Получить статус плеера
  router.get('/:ip/status', (req, res) =>
    playersController.getPlayerStatus(req, res, wiimClient)
  );

  // Воспроизвести медиа
  router.post('/:ip/play', (req, res) =>
    playersController.playMedia(req, res, wiimClient)
  );

  // Управление воспроизведением (play, pause, stop, next, prev)
  router.post('/:ip/control/:action', (req, res) =>
    playersController.controlPlayer(req, res, wiimClient)
  );

  // Установить громкость
  router.post('/:ip/volume', (req, res) =>
    playersController.setVolume(req, res, wiimClient)
  );

  // Установить mute
  router.post('/:ip/mute', (req, res) =>
    playersController.setMute(req, res, wiimClient)
  );

  // Установить режим повтора
  router.post('/:ip/loop', (req, res) =>
    playersController.setLoopMode(req, res, wiimClient)
  );

  // Воспроизвести beep
  router.post('/:ip/beep', (req, res) =>
    playersController.playBeep(req, res, wiimClient)
  );

  return router;
}
