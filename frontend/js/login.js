const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const submitButton = loginForm.querySelector("button");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.hidden = true;
  submitButton.disabled = true;
  submitButton.textContent = "Logging in...";

  try {
    const response = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: document.getElementById("admin-id").value.trim(),
        password: document.getElementById("admin-password").value,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || "Login failed");
    }

    window.location.href = "/admin.html";
  } catch (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Login";
  }
});
