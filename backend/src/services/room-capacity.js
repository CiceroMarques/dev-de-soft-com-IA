/**
 * Checks whether a class fits in an existing room.
 *
 * @param {number} quantidadeAlunos - Number of students in the class.
 * @param {number|string} salaId - Identifier of the room being requested.
 * @param {Array<object>} salas - Available rooms, each with id and capacidade.
 * @returns {boolean} Whether the room exists and can accommodate the class.
 */
function cabeNaSala(quantidadeAlunos, salaId, salas) {
  const roomId = Number(salaId);
  if (
    !Number.isInteger(quantidadeAlunos) ||
    quantidadeAlunos < 0 ||
    !Number.isSafeInteger(roomId) ||
    roomId < 1 ||
    !Array.isArray(salas)
  ) {
    return false;
  }

  const sala = salas.find((room) => Number(room.id) === roomId);
  return Boolean(sala && Number.isInteger(sala.capacidade) && quantidadeAlunos <= sala.capacidade);
}

module.exports = { cabeNaSala };
