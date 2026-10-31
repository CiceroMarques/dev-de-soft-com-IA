const express = require('express');
const { createRoomsController } = require('../controllers/rooms.controller');

function createRoomsRouter(roomsRepository) {
  const router = express.Router();
  const controller = createRoomsController(roomsRepository);

  router.get('/', controller.list);
  router.get('/:id', controller.getById);
  router.post('/', controller.create);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.remove);

  return router;
}

module.exports = { createRoomsRouter };
