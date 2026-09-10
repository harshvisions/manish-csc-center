const cartContent = document.getElementById("cart-content");
const checkoutForm = document.getElementById("checkout-form");
const receipt = document.getElementById("receipt");
const locationBtn = document.getElementById("location-btn");
const locationStatus = document.getElementById("location-status");

document.getElementById("brand-name").textContent = SHOP.name;
let cart = [];
let cartKey = "";
const FREE_DELIVERY_THRESHOLD = 199;
const DELIVERY_CHARGE = 30;

function formatCurrency(value) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function saveCart() {
  localStorage.setItem(cartKey, JSON.stringify(cart));
}

function getOrderTotals() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryCharge = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE;
  return { subtotal, deliveryCharge, total: subtotal + deliveryCharge };
}

function renderCart() {
  if (cart.length === 0) {
    cartContent.innerHTML = '<p class="empty-note">Your electronics cart is empty.</p>';
    document.getElementById("receipt-btn").disabled = true;
    return;
  }

  const { subtotal, deliveryCharge, total } = getOrderTotals();
  cartContent.innerHTML = cart.map((item) => `
    <div class="cart-row">
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${formatCurrency(item.price)} each</small>
      </div>
      <div class="cart-controls">
        <button type="button" data-cart-action="decrease" data-cart-id="${item.id}" aria-label="Decrease quantity">-</button>
        <span>${item.quantity}</span>
        <button type="button" data-cart-action="increase" data-cart-id="${item.id}" aria-label="Increase quantity">+</button>
        <strong>${formatCurrency(item.price * item.quantity)}</strong>
      </div>
    </div>`).join("");
  const deliveryText = deliveryCharge === 0 ? "FREE" : formatCurrency(deliveryCharge);
  cartContent.insertAdjacentHTML("beforeend", `
    <div class="cart-summary">
      <div><span>Subtotal</span><strong>${formatCurrency(subtotal)}</strong></div>
      <div class="delivery-summary"><span>Delivery</span><strong>${deliveryText}</strong></div>
      <div class="cart-total"><strong>Total</strong><strong>${formatCurrency(total)}</strong></div>
    </div>`);

  cartContent.querySelectorAll("[data-cart-action]").forEach((button) => {
    button.addEventListener("click", () => changeQuantity(button.dataset.cartId, button.dataset.cartAction));
  });
  document.getElementById("receipt-btn").disabled = false;
}

function changeQuantity(itemId, action) {
  const item = cart.find((entry) => String(entry.id) === String(itemId));
  if (!item) return;
  item.quantity += action === "increase" ? 1 : -1;
  cart = cart.filter((entry) => entry.quantity > 0);
  saveCart();
  renderCart();
}

locationBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    locationStatus.textContent = "Location is not supported. Enter your address instead.";
    return;
  }
  locationStatus.textContent = "Getting your location...";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      const mapUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
      document.getElementById("customer-location").value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)} (${mapUrl})`;
      locationStatus.textContent = "Location added.";
    },
    () => { locationStatus.textContent = "Could not get location. Enter your address instead."; },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

checkoutForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (cart.length === 0) return;

  const formData = new FormData(checkoutForm);
  const { subtotal, deliveryCharge, total } = getOrderTotals();
  const receiptNumber = `MCS-${Date.now().toString().slice(-8)}`;
  const lines = [
    `*${SHOP.name} - ELECTRONICS RECEIPT*`,
    `Receipt: ${receiptNumber}`,
    `Date: ${new Date().toLocaleString()}`,
    "",
    ...cart.map((item) => `${item.title} x ${item.quantity} = ${formatCurrency(item.price * item.quantity)}`),
    "",
    `Subtotal: ${formatCurrency(subtotal)}`,
    `Delivery: ${deliveryCharge === 0 ? "FREE" : formatCurrency(deliveryCharge)}`,
    `*Total: ${formatCurrency(total)}*`,
    "",
    `Customer: ${formData.get("customer-name")}`,
    `Phone: ${formData.get("customer-phone")}`,
    `Location: ${formData.get("customer-location")}`,
  ];
  const message = lines.join("\n");
  receipt.hidden = false;
  receipt.innerHTML = `<h3>Receipt ${receiptNumber}</h3><pre>${escapeHtml(message)}</pre>`;
  receipt.scrollIntoView({ behavior: "smooth", block: "center" });
  window.open(`https://wa.me/${SHOP.whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
});

async function loadCustomerCart() {
  const response = await fetch(`${API_BASE}/api/customer/key`);
  if (!response.ok) throw new Error("Could not identify this customer device.");
  const { customerKey } = await response.json();
  cartKey = `electronics-cart-${customerKey}`;
  cart = JSON.parse(localStorage.getItem(cartKey) || "[]");
  renderCart();
}

loadCustomerCart().catch(() => {
  cartContent.innerHTML = '<p class="empty-note">Could not load your cart. Please refresh the page.</p>';
});
