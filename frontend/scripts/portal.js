const API_BASE_URL = window.RESERVE_API_URL || "http://localhost:3000/api";
const accessToken = window.sessionStorage.getItem("reserveAccessToken");

if (!accessToken) {
  window.location.replace("index.html");
} else {
  initializePortal().catch((error) => {
    showPageError(error.message || "Não foi possível carregar esta página.");
  });
}

async function initializePortal() {
  const user = readStoredUser();
  document.querySelectorAll("[data-user-name]").forEach((element) => {
    element.textContent = user?.nome || user?.email || "Usuário";
  });
  const firstName = user?.nome?.trim().split(/\s+/)[0];
  const greeting = document.querySelector("[data-first-name]");
  if (greeting) {
    greeting.textContent = firstName || "equipe";
  }

  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", logout);
  });

  const page = document.body.dataset.page;
  if (page === "dashboard") {
    await loadDashboard();
  } else if (page === "rooms") {
    await loadRoomsPage(Boolean(document.querySelector("[data-include-inactive-rooms]")?.checked));
    document.querySelector("[data-include-inactive-rooms]")?.addEventListener("change", (event) => {
      loadRoomsPage(event.currentTarget.checked).catch((error) => showPageError(error.message));
    });
    setupForm(document.querySelector("[data-room-form]"), createRoom);
  } else if (page === "reservations") {
    await loadReservationsPage(
      Boolean(document.querySelector("[data-include-inactive-reservations]")?.checked),
    );
    document
      .querySelector("[data-include-inactive-reservations]")
      ?.addEventListener("change", (event) => {
        loadReservationsPage(event.currentTarget.checked).catch((error) =>
          showPageError(error.message),
        );
      });
    setupForm(document.querySelector("[data-reservation-form]"), createReservation);
  }
}

function readStoredUser() {
  try {
    return JSON.parse(window.sessionStorage.getItem("reserveUser") || "null");
  } catch {
    return null;
  }
}

function logout() {
  window.sessionStorage.removeItem("reserveAccessToken");
  window.sessionStorage.removeItem("reserveUser");
  window.location.replace("index.html");
}

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "Não foi possível acessar a API. Verifique se o backend está ativo e se FRONTEND_URL no .env corresponde à origem do Live Server (protocolo, host e porta). Reinicie a API após alterar o .env.",
    );
  }

  if (response.status === 401) {
    logout();
    throw new Error("Sua sessão expirou. Entre novamente.");
  }

  if (response.status === 204) {
    return null;
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("A resposta da API não pôde ser processada.");
  }

  if (!response.ok) {
    const details = Array.isArray(result.errors) ? ` ${result.errors.join(" ")}` : "";
    throw new Error(`${result.error || "Não foi possível concluir a solicitação."}${details}`);
  }

  return result;
}

async function loadDashboard() {
  const [rooms, reservations] = await Promise.all([
    apiRequest("/salas"),
    apiRequest("/reservas"),
  ]);
  setText("[data-room-count]", rooms.filter((room) => room.ativo).length);
  setText("[data-reservation-count]", reservations.length);
  setText(
    "[data-pending-count]",
    reservations.filter((reservation) => reservation.ativo && reservation.situacao === "Pendente")
      .length,
  );
}

async function loadRoomsPage(includeInactive = false) {
  const rooms = await apiRequest(
    `/salas${includeInactive ? "?includeInactive=true" : ""}`,
  );
  renderRooms(rooms);
}

async function loadReservationsPage(includeInactive = false) {
  const [rooms, reservations] = await Promise.all([
    apiRequest("/salas?includeInactive=true"),
    apiRequest(`/reservas${includeInactive ? "?includeInactive=true" : ""}`),
  ]);
  populateRoomOptions(rooms);
  renderReservations(reservations, rooms);

  const ownerInput = document.querySelector("#reservation-owner");
  const user = readStoredUser();
  if (ownerInput && user?.nome) {
    ownerInput.value = user.nome;
  }

  const dateInput = document.querySelector("#reservation-date");
  if (dateInput) {
    const today = new Date();
    const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    dateInput.min = localDate;
  }
}

async function createRoom(form) {
  const formData = new FormData(form);
  const resources = String(formData.get("recursos") || "")
    .split(",")
    .map((resource) => resource.trim())
    .filter(Boolean);

  await apiRequest("/salas", {
    method: "POST",
    body: JSON.stringify({
      nome: String(formData.get("nome")).trim(),
      andar: Number(formData.get("andar")),
      capacidade: Number(formData.get("capacidade")),
      recursos: resources,
    }),
  });
  form.reset();
  setFeedback(form, "Sala cadastrada com sucesso.");
  await loadRoomsPage(Boolean(document.querySelector("[data-include-inactive-rooms]")?.checked));
}

async function createReservation(form) {
  const formData = new FormData(form);
  const start = String(formData.get("inicio"));
  const end = String(formData.get("fim"));
  const endField = form.querySelector('[name="fim"]');
  if (start && end && end <= start) {
    showFieldError(endField, "O horário de término deve ser posterior ao início.");
    setRequiredNotice(form, true);
    endField.focus();
    return;
  }

  await apiRequest("/reservas", {
    method: "POST",
    body: JSON.stringify({
      sala: Number(formData.get("sala")),
      data: formData.get("data"),
      inicio: start,
      fim: end,
      responsavel: String(formData.get("responsavel")).trim(),
      finalidade: String(formData.get("finalidade")).trim(),
      situacao: formData.get("situacao"),
    }),
  });
  const owner = form.querySelector('[name="responsavel"]').value;
  form.reset();
  form.querySelector('[name="responsavel"]').value = owner;
  setFeedback(form, "Reserva registrada com sucesso.");
  await loadReservationsPage(
    Boolean(document.querySelector("[data-include-inactive-reservations]")?.checked),
  );
}

function setupForm(form, submitAction) {
  if (!form) {
    return;
  }

  const fields = [...form.querySelectorAll("[required]")];
  fields.forEach((field) => {
    field.addEventListener("input", () => clearFieldError(field));
    field.addEventListener("change", () => clearFieldError(field));
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFeedback(form, "");
    let firstInvalidField = null;
    fields.forEach((field) => {
      const valid = field.checkValidity();
      if (!valid && !firstInvalidField) {
        firstInvalidField = field;
      }
      showFieldError(field, valid ? "" : field.validationMessage || "Obrigatório");
    });

    if (firstInvalidField) {
      setRequiredNotice(form, true);
      firstInvalidField.focus();
      return;
    }

    setRequiredNotice(form, false);
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    try {
      await submitAction(form);
    } catch (error) {
      setFeedback(form, error.message, true);
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  });
}

function showFieldError(field, message) {
  field.setAttribute("aria-invalid", String(Boolean(message)));
  const error = document.getElementById(field.getAttribute("aria-describedby")?.split(" ")[0]);
  if (error) {
    error.textContent = message;
  }
}

function clearFieldError(field) {
  if (field.checkValidity()) {
    showFieldError(field, "");
  }
}

function setRequiredNotice(form, isInvalid) {
  const notice = form.querySelector("[data-required-notice]");
  if (notice) {
    notice.textContent = isInvalid ? "Obrigatório: preencha os campos destacados." : "";
  }
}

function setFeedback(form, message, isError = false) {
  const feedback = form.querySelector("[data-form-feedback]");
  if (feedback) {
    feedback.textContent = message;
    feedback.classList.toggle("is-error", isError);
  }
}

function showPageError(message) {
  const feedback = document.querySelector("[data-dashboard-feedback]");
  if (feedback) {
    feedback.textContent = message;
    feedback.classList.add("is-error");
    return;
  }
  const list = document.querySelector("[data-room-list], [data-reservation-list]");
  if (list) {
    list.replaceChildren(createMessage(message, "empty-state is-error"));
  }
}

function populateRoomOptions(rooms) {
  const select = document.querySelector("#reservation-room");
  if (!select) {
    return;
  }
  select.querySelectorAll("option:not(:first-child)").forEach((option) => option.remove());
  rooms.filter((room) => room.ativo).forEach((room) => {
    const option = document.createElement("option");
    option.value = String(room.id);
    option.textContent = `${room.nome} · ${room.capacidade} lugares`;
    select.append(option);
  });
  select.disabled = rooms.length === 0;
  if (rooms.length === 0) {
    setFeedback(
      document.querySelector("[data-reservation-form]"),
      "Cadastre uma sala antes de registrar uma reserva.",
      true,
    );
  }
}

function renderRooms(rooms) {
  const list = document.querySelector("[data-room-list]");
  if (!list) {
    return;
  }
  if (rooms.length === 0) {
    list.replaceChildren(createMessage("Ainda não há salas cadastradas."));
    return;
  }

  list.replaceChildren(
    ...rooms.map((room) => {
      const article = document.createElement("article");
      article.className = "record-card";
      const heading = document.createElement("div");
      heading.className = "record-heading";
      const title = document.createElement("h3");
      title.textContent = room.nome;
      const state = document.createElement("span");
      state.className = `status-badge ${room.ativo ? "status-aprovada" : "status-inativo"}`;
      state.textContent = room.ativo ? "Ativa" : "Desativada";
      const location = document.createElement("span");
      location.className = "record-meta";
      location.textContent = `Andar ${room.andar} · ${room.capacidade} lugares`;
      heading.append(title, state, location);
      const resources = document.createElement("p");
      resources.className = "record-description";
      resources.textContent = room.recursos.length
        ? `Recursos: ${room.recursos.join(", ")}`
        : "Nenhum recurso adicional informado.";
      article.append(heading, resources);
      return article;
    }),
  );
}

function renderReservations(reservations, rooms) {
  const list = document.querySelector("[data-reservation-list]");
  if (!list) {
    return;
  }
  if (reservations.length === 0) {
    list.replaceChildren(createMessage("Ainda não há reservas registradas."));
    return;
  }
  const roomNames = new Map(rooms.map((room) => [room.id, room.nome]));
  list.replaceChildren(
    ...reservations.map((reservation) => {
      const article = document.createElement("article");
      article.className = "record-card";
      const heading = document.createElement("div");
      heading.className = "record-heading";
      const title = document.createElement("h3");
      title.textContent = roomNames.get(reservation.sala) || `Sala ${reservation.sala}`;
      const status = document.createElement("span");
      status.className = `status-badge status-${reservation.situacao.toLowerCase()}`;
      status.textContent = reservation.situacao;
      heading.append(title, status);
      if (!reservation.ativo) {
        const inactive = document.createElement("span");
        inactive.className = "status-badge status-inativo";
        inactive.textContent = "Desativada";
        heading.append(inactive);
      }
      const date = document.createElement("p");
      date.className = "record-meta";
      date.textContent = `${formatDate(reservation.data)} · ${reservation.inicio}–${reservation.fim}`;
      const description = document.createElement("p");
      description.className = "record-description";
      description.textContent = `${reservation.finalidade} · Responsável: ${reservation.responsavel}`;
      article.append(heading, date, description);
      return article;
    }),
  );
}

function formatDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function createMessage(text, className = "empty-state") {
  const message = document.createElement("p");
  message.className = className;
  message.textContent = text;
  return message;
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = String(value);
  }
}
