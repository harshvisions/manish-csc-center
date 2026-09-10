// wire up header/hero/footer text and links from config.js so the shop
// details only need to be edited in one place
document.getElementById("brand-name").textContent = SHOP.name;
document.getElementById("hero-title").textContent = "Welcome to " + SHOP.name;
document.getElementById("footer-brand").textContent = SHOP.name;
document.querySelector("#footer-address span").textContent = SHOP.address;
document.getElementById("footer-address").href = SHOP.addressLink;
document.getElementById("footer-phone").textContent = SHOP.phone;
document.getElementById("footer-email").textContent = SHOP.email;
document.getElementById("footer-email").href = mailtoLink();
document.getElementById("footer-whatsapp").href = whatsappLink();
document.getElementById("whatsapp-btn").href = whatsappLink();
document.getElementById("hero-whatsapp-btn").href = whatsappLink();
document.getElementById("email-btn").href = mailtoLink();
document.getElementById("year").textContent = new Date().getFullYear();
document.querySelectorAll("[data-whatsapp-link]").forEach((link) => {
  link.href = whatsappLink();
  link.target = "_blank";
  link.rel = "noopener noreferrer";
});

// ---------- catalog ----------

let allItems = [];
let activeFilter = "All";

const catalogContent = document.getElementById("catalog-content");
const filtersEl = document.getElementById("filters");
const updatesContent = document.getElementById("updates-content");

filtersEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-btn");
  if (!btn) return;

  activeFilter = btn.dataset.category;
  [...filtersEl.querySelectorAll(".filter-btn")].forEach((b) =>
    b.classList.toggle("active", b === btn)
  );
  renderCatalog();
});

function renderSkeleton() {
  let html = '<div class="grid">';
  for (let i = 0; i < 8; i++) {
    html += `
      <div class="card skeleton">
        <div class="card-image"></div>
        <div class="card-body">
          <div class="line" style="width:60px"></div>
          <div class="line" style="width:80%"></div>
          <div class="line" style="width:100%"></div>
        </div>
      </div>`;
  }
  html += "</div>";
  catalogContent.innerHTML = html;
}

function renderCatalog() {
  const items =
    activeFilter === "All"
      ? allItems
      : allItems.filter((it) => it.category === activeFilter);

  if (items.length === 0) {
    catalogContent.innerHTML = `
      <div class="state-message">
        <strong>No items to show yet.</strong>
        Check back soon, or add items from the Admin panel.
      </div>`;
    return;
  }

  const cards = items.map(renderCard).join("");
  catalogContent.innerHTML = `<div class="grid">${cards}</div>`;
  catalogContent.querySelectorAll("[data-add-to-cart]").forEach((button) => {
    button.addEventListener("click", () => addToCart(button.dataset.addToCart));
  });
}

function renderCard(item) {
  const badgeClass = item.category === "CSC Service" ? "badge-csc" : "badge-electronics";

  const image = item.imageUrl
    ? `<img src="${item.imageUrl}" alt="${escapeHtml(item.title)}" loading="lazy">`
    : `<div class="no-image">No image</div>`;

  const description = item.description
    ? `<p>${escapeHtml(item.description)}</p>`
    : "";

  return `
    <div class="card">
      <div class="card-image">${image}</div>
      <div class="card-body">
        <span class="badge ${badgeClass}">${escapeHtml(item.category)}</span>
        <h3>${escapeHtml(item.title)}</h3>
        ${description}
        ${item.category === "Electronics" ? `
          <div class="card-order-row">
            <strong>${formatCurrency(item.price)}</strong>
            <button type="button" class="add-cart-btn" data-add-to-cart="${item.id}">Add to cart</button>
          </div>` : ""}
      </div>
    </div>`;
}

function formatCurrency(value) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

async function addToCart(itemId) {
  const item = allItems.find((entry) => String(entry.id) === String(itemId));
  if (!item || item.category !== "Electronics") return;
  const response = await fetch(`${API_BASE}/api/customer/key`);
  if (!response.ok) return;
  const { customerKey } = await response.json();
  const cartKey = `electronics-cart-${customerKey}`;
  const cart = JSON.parse(localStorage.getItem(cartKey) || "[]");
  const existing = cart.find((entry) => String(entry.id) === String(item.id));
  if (existing) existing.quantity += 1;
  else cart.push({ id: item.id, title: item.title, price: Number(item.price || 0), quantity: 1 });
  localStorage.setItem(cartKey, JSON.stringify(cart));
  window.location.href = "/cart.html";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function loadCatalog() {
  renderSkeleton();
  try {
    const res = await fetch(`${API_BASE}/api/items`);
    if (!res.ok) throw new Error("request failed");
    allItems = await res.json();
    renderCatalog();
  } catch (err) {
    catalogContent.innerHTML = `
      <div class="state-message">
        <strong>Could not load the catalog.</strong>
        Make sure the backend server is running.
      </div>`;
  }
}

loadCatalog();

async function loadUpdates() {
  try {
    const res = await fetch(`${API_BASE}/api/updates`);
    if (!res.ok) throw new Error("request failed");
    const updates = await res.json();
    if (updates.length === 0) {
      updatesContent.innerHTML = '<div class="updates-empty">No updates or discounts available right now.</div>';
      return;
    }
    updatesContent.innerHTML = `<div class="updates-grid">${updates.map(renderUpdate).join("")}</div>`;
    updatesContent.querySelectorAll("[data-whatsapp-link]").forEach((link) => {
      link.href = whatsappLink();
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
  } catch (err) {
    updatesContent.innerHTML = '<div class="updates-empty">Updates are temporarily unavailable.</div>';
  }
}

function renderUpdate(update) {
  const categoryClass = update.category === "CSC Services"
    ? "update-badge-csc"
    : update.category === "Special Offer" ? "update-badge-offer" : "update-badge-repair";
  const image = update.imageUrl
    ? `<img src="${update.imageUrl}" alt="${escapeHtml(update.title)}" loading="lazy">`
    : "";
  return `<article class="update-card">
    ${image}
    <div class="update-card-body">
      <span class="update-badge ${categoryClass}">${escapeHtml(update.category)}</span>
      <h3>${escapeHtml(update.title)}</h3>
      <p>${escapeHtml(update.description || "Contact us for more details.")}</p>
      <a class="update-link" href="#" data-whatsapp-link>Ask on WhatsApp &rarr;</a>
    </div>
  </article>`;
}

loadUpdates();
