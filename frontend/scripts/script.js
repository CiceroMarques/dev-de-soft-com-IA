const API_BASE_URL = window.RESERVE_API_URL || "http://localhost:3000/api";

document.querySelectorAll(".validated-form").forEach((form) => {
  const requiredMessage = form.querySelector(".form-required-message");
  const responseMessage = form.querySelector(".form-response-message");
  const submitButton = form.querySelector('button[type="submit"]');
  const requiredFields = Array.from(form.querySelectorAll(".required-field")).map((input) => ({
    input,
    error: document.getElementById(input.getAttribute("aria-describedby")),
  }));

  function updateFormMessage(hasInvalidField) {
    if (!requiredMessage) {
      return;
    }

    requiredMessage.textContent = hasInvalidField ? "Obrigatório" : "";
  }

  function validateField(field) {
    const isEmpty = field.input.value.trim() === "";

    if (field.error) {
      field.error.textContent = isEmpty ? "Obrigatório" : "";
    }

    field.input.setAttribute("aria-invalid", String(isEmpty));

    return !isEmpty;
  }

  requiredFields.forEach((field) => {
    field.input.addEventListener("input", () => {
      if (field.input.value.trim() !== "") {
        validateField(field);
      }

      const hasInvalidField = requiredFields.some(({ input }) => input.value.trim() === "");
      updateFormMessage(hasInvalidField);
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const values = requiredFields.map(validateField);
    const isValid = values.every(Boolean);
    const hasInvalidField = values.some((value) => !value);

    updateFormMessage(hasInvalidField);
    if (responseMessage) {
      responseMessage.textContent = "";
      responseMessage.classList.remove("is-error");
    }

    if (!isValid) {
      requiredFields.find((field) => field.input.value.trim() === "")?.input.focus();
      return;
    }

    const operation = form.dataset.authForm;
    if (!operation || !responseMessage) {
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.setAttribute("aria-busy", "true");
    }

    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      const response = await fetch(`${API_BASE_URL}/auth/${operation}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        responseMessage.textContent = result.error || "Não foi possível concluir a solicitação.";
        responseMessage.classList.add("is-error");
        return;
      }

      if (operation === "login" && result.accessToken) {
        window.sessionStorage.setItem("reserveAccessToken", result.accessToken);
        responseMessage.textContent = `Bem-vindo(a), ${result.user.nome}. Login realizado com sucesso.`;
      } else {
        responseMessage.textContent = result.message;
      }
    } catch (error) {
      responseMessage.textContent =
        error instanceof TypeError
          ? "Não foi possível conectar à API. Verifique se o backend está em execução."
          : "A resposta da API não pôde ser processada.";
      responseMessage.classList.add("is-error");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
      }
    }
  });
});
