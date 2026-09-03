// Edit these before you go live.
// Frontend and backend are served from the same origin (see backend/main.go),
// so API_BASE stays empty - fetch('/api/items') just works.

const API_BASE = "";

const SHOP = {
  name: "Manish CSC Center & Electronics Shop",
  whatsappNumber: "919027105727", // country code + number, no + / spaces / dashes
  whatsappMessage: "Hello! I would like to know more about your services.",
  email: "harsh902710@gmail.com",
  address: "Shop Address",
  addressLink: "https://maps.app.goo.gl/vNCdhziFTVfgDTXHA",
  phone: "+91 9027105727",
};

function whatsappLink() {
  return `https://wa.me/${SHOP.whatsappNumber}?text=${encodeURIComponent(SHOP.whatsappMessage)}`;
}

function mailtoLink() {
  return `mailto:${SHOP.email}?subject=${encodeURIComponent("Inquiry from website")}`;
}
