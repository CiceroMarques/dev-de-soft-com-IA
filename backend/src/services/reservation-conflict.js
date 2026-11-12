const NON_BLOCKING_STATUSES = new Set(['Cancelada', 'Finalizada']);

function isBlockingReservation(reservation) {
  return (
    reservation.ativo !== false &&
    reservation.ativo !== 0 &&
    !NON_BLOCKING_STATUSES.has(reservation.situacao)
  );
}

/**
 * Checks whether a reservation overlaps another active reservation for the same room and date.
 *
 * @param {object} novaReserva - Reservation being created or updated.
 * @param {Array<object>} reservas - Existing reservations to compare.
 * @returns {boolean} Whether an active reservation overlaps the requested time.
 */
function existeConflito(novaReserva, reservas) {
  if (!isBlockingReservation(novaReserva)) {
    return false;
  }

  return reservas.some((reserva) => {
    if (!isBlockingReservation(reserva) || (novaReserva.id && reserva.id === novaReserva.id)) {
      return false;
    }

    return (
      Number(reserva.sala) === Number(novaReserva.sala) &&
      reserva.data === novaReserva.data &&
      novaReserva.inicio < reserva.fim &&
      novaReserva.fim > reserva.inicio
    );
  });
}

module.exports = { existeConflito };
