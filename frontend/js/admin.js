document.getElementById("admin-brand").textContent = SHOP.name;

const form = document.getElementById("item-form");
const submitBtn = document.getElementById("submit-btn");
const formError = document.getElementById("form-error");
const imageInput = document.getElementById("image");
const imagePreview = document.getElementById("image-preview");
const itemsList = document.getElementById("items-list");
const itemsHeading = document.getElementById("items-heading");
const updateForm = document.getElementById("update-form");
const updateSubmitBtn = document.getElementById("update-submit-btn");
const updateFormError = document.getElementById("update-form-error");
const updateImageInput = document.getElementById("update-image");
const updateImagePreview = document.getElementById("update-image-preview");
const updatesList = document.getElementById("updates-list");
const updatesHeading = document.getElementById("updates-heading");

let items = [];
let updates = [];

// show a live preview of the picked image before upload
imageInput.addEventListener("change", () => {
  const file = imageInput.files[0];
  if (!file) {
    imagePreview.style.display = "none";
    imagePreview.src = "";
    return;
  }
  imagePreview.src = URL.createObjectURL(file);
  imagePreview.style.display = "block";
});

updateImageInput.addEventListener("change", () => {
  const file = updateImageInput.files[0];
  if (!file) {
    updateImagePreview.style.display = "none";
    updateImagePreview.src = "";
    return;
  }
  updateImagePreview.src = URL.createObjectURL(file);
  updateImagePreview.style.display = "block";
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideFormError();

  const title = form.title.value.trim();
  if (!title) {
    showFormError("Please enter a title.");
    return;
  }

  const formData = new FormData(form);
  // FormData already picked up the image file automatically from the
  // <input type="file"> - no extra handling needed here.

  submitBtn.disabled = true;
  submitBtn.textContent = "Adding...";

  try {
    const res = await fetch(`${API_BASE}/api/items`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to add item");
    }

    const newItem = await res.json();
    items.unshift(newItem);
    renderItems();

    form.reset();
    imagePreview.style.display = "none";
    imagePreview.src = "";
  } catch (err) {
    showFormError(err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Add Item";
  }
});

updateForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  updateFormError.style.display = "none";
  updateSubmitBtn.disabled = true;
  updateSubmitBtn.textContent = "Adding...";

  try {
    const res = await fetch(`${API_BASE}/api/updates`, {
      method: "POST",
      body: new FormData(updateForm),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to add update");
    }
    const newUpdate = await res.json();
    updates.unshift(newUpdate);
    renderUpdates();
    updateForm.reset();
    updateImagePreview.style.display = "none";
    updateImagePreview.src = "";
  } catch (err) {
    updateFormError.textContent = err.message;
    updateFormError.style.display = "block";
  } finally {
    updateSubmitBtn.disabled = false;
    updateSubmitBtn.textContent = "Add Update";
  }
});

function showFormError(msg) {
  formError.textContent = msg;
  formError.style.display = "block";
}

function hideFormError() {
  formError.style.display = "none";
}

async function loadItems() {
  itemsList.innerHTML = `<p class="empty-note">Loading items...</p>`;
  try {
    const res = await fetch(`${API_BASE}/api/items`);
    if (!res.ok) throw new Error("request failed");
    items = await res.json();
    renderItems();
    await loadUpdates();
  } catch (err) {
    itemsList.innerHTML = `<p class="empty-note">Could not load items. Is the backend running?</p>`;
  }
}

async function loadUpdates() {
  updatesList.innerHTML = `<p class="empty-note">Loading updates...</p>`;
  try {
    const res = await fetch(`${API_BASE}/api/updates`);
    if (!res.ok) throw new Error("request failed");
    updates = await res.json();
    renderUpdates();
  } catch (err) {
    updatesList.innerHTML = `<p class="empty-note">Could not load updates.</p>`;
  }
}

function renderUpdates() {
  updatesHeading.textContent = `Existing Updates (${updates.length})`;
  if (updates.length === 0) {
    updatesList.innerHTML = `<p class="empty-note">No updates yet. Add your first one!</p>`;
    return;
  }
  updatesList.innerHTML = updates.map((update) => `
    <div class="item-row">
      <div class="item-thumb">${update.imageUrl ? `<img src="${update.imageUrl}" alt="${escapeHtml(update.title)}">` : "no image"}</div>
      <div class="item-info">
        <div class="name">${escapeHtml(update.title)}</div>
        <span class="badge badge-csc" style="margin-top:4px;">${escapeHtml(update.category)}</span>
        ${update.description ? `<div class="desc">${escapeHtml(update.description)}</div>` : ""}
      </div>
      <button class="btn-delete" data-delete-update-id="${update.id}">Delete</button>
    </div>`).join("");
  updatesList.querySelectorAll("[data-delete-update-id]").forEach((btn) => {
    btn.addEventListener("click", () => handleUpdateDelete(btn.dataset.deleteUpdateId, btn));
  });
}

async function handleUpdateDelete(id, btn) {
  if (!confirm("Delete this update? This cannot be undone.")) return;
  btn.disabled = true;
  btn.textContent = "Deleting...";
  try {
    const res = await fetch(`${API_BASE}/api/updates/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete update");
    updates = updates.filter((update) => String(update.id) !== String(id));
    renderUpdates();
  } catch (err) {
    alert(err.message);
    btn.disabled = false;
    btn.textContent = "Delete";
  }
}

function renderItems() {
  itemsHeading.textContent = `Existing Items (${items.length})`;

  if (items.length === 0) {
    itemsList.innerHTML = `<p class="empty-note">No items yet. Add your first one!</p>`;
    return;
  }

  itemsList.innerHTML = items.map(renderRow).join("");

  itemsList.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => handleDelete(btn.dataset.deleteId, btn));
  });
}

function renderRow(item) {
  const badgeClass = item.category === "CSC Service" ? "badge-csc" : "badge-electronics";
  const thumb = item.imageUrl
    ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.title)}">`
    : "no image";
  const desc = item.description ? `<div class="desc">${escapeHtml(item.description)}</div>` : "";

  return `
    <div class="item-row">
      <div class="item-thumb">${thumb}</div>
      <div class="item-info">
        <div class="name">${escapeHtml(item.title)}</div>
        <span class="badge ${badgeClass}" style="margin-top:4px;">${escapeHtml(item.category)}</span>
        ${desc}
      </div>
      <button class="btn-delete" data-delete-id="${item.id}">Delete</button>
    </div>`;
}

async function handleDelete(id, btn) {
  if (!confirm("Delete this item? This cannot be undone.")) return;

  btn.disabled = true;
  btn.textContent = "Deleting...";

  try {
    const res = await fetch(`${API_BASE}/api/items/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete item");
    items = items.filter((it) => String(it.id) !== String(id));
    renderItems();
  } catch (err) {
    alert(err.message);
    btn.disabled = false;
    btn.textContent = "Delete";
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

loadItems();

