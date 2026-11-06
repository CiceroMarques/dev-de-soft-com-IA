const express = require('express');
const { createReservationsController } = require('../controllers/reservations.controller');

function createReservationsRouter(reservationsRepository, roomsRepository) {
  const router = express.Router();
  const controller = createReservationsController(reservationsRepository, roomsRepository);

  router.get('/', controller.list);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}

module.exports = { createReservationsRouter };
