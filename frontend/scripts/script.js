document.querySelectorAll(".validated-form").forEach((form) => {
  const requiredMessage = form.querySelector(".form-required-message");
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

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const values = requiredFields.map(validateField);
    const isValid = values.every(Boolean);
    const hasInvalidField = values.some((value) => !value);

    updateFormMessage(hasInvalidField);

    if (!isValid) {
      requiredFields.find((field) => field.input.value.trim() === "")?.input.focus();
    }
  });
});
