# Manish CSC Center & Electronics Shop

A local CSC (Common Service Center) & Electronics shop website with an admin
panel for managing the catalog.

**Stack:** Go backend (standard library only, no framework) + plain HTML/CSS/JS
frontend. One server, one port, no build step, no Node/npm needed at all.

Tested end-to-end before being handed off: server builds clean, serves the
HTML/CSS/JS, and every API route (list, create w/ image upload, delete) has
been hit with real requests and confirmed working.

---

## Folder structure

```
manish-csc-center/
├── backend/
│   ├── main.go          # routing + server startup
│   ├── db.go             # sqlite connection + schema
│   ├── models.go         # Item struct
│   ├── handlers.go       # GET/POST/DELETE handlers, upload logic
│   ├── go.mod
│   ├── go.sum
│   └── uploads/           # uploaded images land here (gitignored, kept via .gitkeep)
│
├── frontend/
│   ├── index.html         # public storefront
│   ├── admin.html         # admin panel
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── config.js      # shop name / whatsapp / email - edit this file
│       ├── app.js         # storefront logic (catalog + updates)
│       └── admin.js       # admin login and management logic
│
└── README.md
```

No `package.json`, no `node_modules`, no bundler. Open `frontend/*.html`
straight in a browser during design tweaks if you want, but for the app to
actually load data you need the Go server running (see below), since it's
what serves both the API and the static files together.

---

## Admin panel and updates

Homepage updates and discounts are stored in SQLite and can only be added or
deleted from the authenticated admin panel. The default local login is:

```text
ID: admin
Password: manish@123
```

Set `ADMIN_ID` and `ADMIN_PASSWORD` environment variables before deployment to
replace the defaults. Catalog and update write routes require an admin session.

## Why one server for everything

The Go backend serves the API **and** the `frontend/` folder as static
files, from the same port. That means:

- no CORS setup needed (same origin)
- no separate frontend dev server / npm install
- `go run` is the entire local setup

If you'd rather split them (e.g. host the frontend on Netlify and the API
elsewhere), you'd need to re-introduce CORS headers in `main.go` and point
`API_BASE` in `frontend/js/config.js` at the API's public URL. Not needed
for a simple local/single-VPS deployment like this one.

---

## Requirements

- Go 1.22+ (`go version`)
- A C compiler — gcc or clang (needed by the `mattn/go-sqlite3` driver,
  which uses CGO). On Ubuntu/Debian: `sudo apt install build-essential`.
  On macOS: `xcode-select --install`. On Windows: install
  [TDM-GCC](https://jmeubank.github.io/tdm-gcc/) or use WSL.

That's it — no Node, no npm.

---

## Running it locally

```bash
cd backend
go mod download
go run .
```

You'll see:

```
database ready: ./manish_csc.db
Manish CSC Center running at http://localhost:8080
```

Open in your browser:

- Storefront: **http://localhost:8080/**
- Admin panel: **http://localhost:8080/admin.html**

That's the whole setup. The SQLite database file and the `uploads/` folder
are created automatically on first run.

### Building a binary for deployment

```bash
cd backend
go build -o server .
./server
```

Copy `server`, the `frontend/` folder, and an empty `uploads/` folder to
your host, keeping them in the same relative layout as in this repo
(`main.go` expects `../frontend` relative to the binary — run the binary
from inside `backend/`, same as `go run .`).

---

## API reference

| Method | Route | Body | Notes |
|---|---|---|---|
| GET | `/api/items` | — | returns all items, newest first |
| POST | `/api/items` | `multipart/form-data`: `title`, `category`, `description`, `image` (file, optional) | `category` must be `CSC Service` or `Electronics` |
| DELETE | `/api/items/{id}` | — | deletes the row and its image file |
| GET | `/api/updates` | — | returns homepage updates and discounts |
| POST | `/api/updates` | `multipart/form-data`: `update-title`, `update-category`, `update-description`, `update-image` (file, optional) | admin session required |
| DELETE | `/api/updates/{id}` | — | admin session required; deletes the update and image |
| POST | `/api/login` | JSON: `id`, `password` | creates an admin session |
| GET | `/uploads/{filename}` | — | serves an uploaded image |
| GET | `/` , `/admin.html`, `/css/*`, `/js/*` | — | static frontend files |

---

## Customizing shop details

Everything shop-specific lives in **`frontend/js/config.js`**:

```js
const SHOP = {
  name: "Manish CSC Center & Electronics Shop",
  whatsappNumber: "919999999999", // country code + number, no + / spaces
  whatsappMessage: "Hello! I would like to know more about your services.",
  email: "manishcsccenter@example.com",
  address: "Main Market Road, Meerut, Uttar Pradesh, India",
  phone: "+91 99999 99999",
};
```

The current logo is already installed at `frontend/images/logo.png` and is
used by both the public site and admin panel. Replace that file if you want to
use a different logo.

```html
<img src="images/logo.png" alt="Manish CSC Center logo">
```

---

## GitHub files

Upload the project source and assets, including `backend/`, `frontend/`,
`README.md`, `.gitignore`, `backend/go.mod`, and `backend/go.sum`.

Do not upload `backend/*.db`, files inside `backend/uploads/` except
`.gitkeep`, compiled `server` or `.exe` files, `.env` files, logs, or local
editor folders. The supplied `logo.png` and `background.jpg` inside
`frontend/images/` should be uploaded.

## Hosting

This application is designed to run as one Go server. Vercel can host the
static `frontend/` files, but it cannot run this unchanged as a persistent Go
server with SQLite and local image uploads. Deploying only the frontend to
Vercel will make the catalog, admin login, and uploads unavailable.

For the complete application, use a Go-capable host such as Render, Railway,
Fly.io, or a VPS. Keep the frontend and backend together and set `ADMIN_ID`
and `ADMIN_PASSWORD` in that host's environment settings. If Vercel is
required, the backend must first be rewritten as serverless API functions and
SQLite/local uploads must be replaced with hosted database and file storage.

## Pushing to GitHub

```bash
cd manish-csc-center
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

`.gitignore` already excludes the compiled `server` binary, the SQLite
`.db` file, and uploaded images, so the repo only ships source.
