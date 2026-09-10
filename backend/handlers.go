package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const maxUploadSize = 10 << 20 // 10MB

var allowedCategories = map[string]bool{
	"CSC Service": true,
	"Electronics": true,
}

var allowedImageExt = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".webp": true,
	".gif":  true,
}

var allowedUpdateCategories = map[string]bool{
	"CSC Services":   true,
	"Special Offer":  true,
	"Repair Service": true,
}

func handleCustomerKey(w http.ResponseWriter, r *http.Request) {
	address := r.RemoteAddr
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		address = strings.TrimSpace(strings.Split(forwarded, ",")[0])
	}
	if host, _, err := net.SplitHostPort(address); err == nil {
		address = host
	}
	salt := os.Getenv("CUSTOMER_KEY_SALT")
	digest := sha256.Sum256([]byte(salt + ":" + address))
	writeJSON(w, http.StatusOK, map[string]string{"customerKey": hex.EncodeToString(digest[:])})
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	var credentials struct {
		ID       string `json:"id"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&credentials); err != nil {
		writeError(w, http.StatusBadRequest, "invalid login request")
		return
	}

	adminID := os.Getenv("ADMIN_ID")
	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if adminID == "" {
		adminID = "admin"
	}
	if adminPassword == "" {
		adminPassword = "manish@123"
	}
	if credentials.ID != adminID || credentials.Password != adminPassword {
		writeError(w, http.StatusUnauthorized, "invalid ID or password")
		return
	}

	token, err := newSessionToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not create login session")
		return
	}
	sessions.Lock()
	sessions.tokens[token] = struct{}{}
	sessions.Unlock()
	http.SetCookie(w, &http.Cookie{
		Name:     "admin_session",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	writeJSON(w, http.StatusOK, map[string]string{"message": "login successful"})
}

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// GET /api/items - returns everything in the catalog, newest first.
func handleGetItems(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`SELECT id, title, category, price, description, image_url, created_at
		FROM items ORDER BY created_at DESC`)
	if err != nil {
		log.Println("query items:", err)
		writeError(w, http.StatusInternalServerError, "failed to fetch items")
		return
	}
	defer rows.Close()

	items := []Item{}
	for rows.Next() {
		var it Item
		if err := rows.Scan(&it.ID, &it.Title, &it.Category, &it.Price, &it.Description, &it.ImageURL, &it.CreatedAt); err != nil {
			log.Println("scan item:", err)
			continue
		}
		items = append(items, it)
	}

	writeJSON(w, http.StatusOK, items)
}

func handleGetUpdates(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`SELECT id, title, category, description, image_url, created_at
		FROM updates ORDER BY created_at DESC`)
	if err != nil {
		log.Println("query updates:", err)
		writeError(w, http.StatusInternalServerError, "failed to fetch updates")
		return
	}
	defer rows.Close()

	updates := []Update{}
	for rows.Next() {
		var update Update
		if err := rows.Scan(&update.ID, &update.Title, &update.Category, &update.Description, &update.ImageURL, &update.CreatedAt); err != nil {
			log.Println("scan update:", err)
			continue
		}
		updates = append(updates, update)
	}
	writeJSON(w, http.StatusOK, updates)
}

// POST /api/items - expects multipart/form-data with fields:
// title, category, description, and an optional "image" file.
func handleCreateItem(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)

	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		writeError(w, http.StatusBadRequest, "form too large or invalid (max 10MB)")
		return
	}

	title := strings.TrimSpace(r.FormValue("title"))
	category := strings.TrimSpace(r.FormValue("category"))
	price, err := strconv.ParseFloat(strings.TrimSpace(r.FormValue("price")), 64)
	description := strings.TrimSpace(r.FormValue("description"))

	if title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}
	if !allowedCategories[category] {
		writeError(w, http.StatusBadRequest, "category must be 'CSC Service' or 'Electronics'")
		return
	}
	if err != nil || price < 0 {
		writeError(w, http.StatusBadRequest, "price must be a valid non-negative number")
		return
	}

	imageURL, err := saveUploadedImage(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	res, err := db.Exec(
		`INSERT INTO items (title, category, price, description, image_url) VALUES (?, ?, ?, ?, ?)`,
		title, category, price, description, imageURL,
	)
	if err != nil {
		log.Println("insert item:", err)
		writeError(w, http.StatusInternalServerError, "failed to save item")
		return
	}

	id, _ := res.LastInsertId()

	var it Item
	err = db.QueryRow(`SELECT id, title, category, price, description, image_url, created_at
		FROM items WHERE id = ?`, id).
		Scan(&it.ID, &it.Title, &it.Category, &it.Price, &it.Description, &it.ImageURL, &it.CreatedAt)
	if err != nil {
		log.Println("fetch inserted item:", err)
		writeError(w, http.StatusInternalServerError, "item saved but could not be reloaded")
		return
	}

	writeJSON(w, http.StatusCreated, it)
}

func handleCreateUpdate(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		writeError(w, http.StatusBadRequest, "form too large or invalid (max 10MB)")
		return
	}

	title := strings.TrimSpace(r.FormValue("update-title"))
	category := strings.TrimSpace(r.FormValue("update-category"))
	description := strings.TrimSpace(r.FormValue("update-description"))
	if title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}
	if !allowedUpdateCategories[category] {
		writeError(w, http.StatusBadRequest, "invalid update category")
		return
	}

	imageURL, err := saveUploadedImageField(r, "update-image")
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	res, err := db.Exec(`INSERT INTO updates (title, category, description, image_url) VALUES (?, ?, ?, ?)`, title, category, description, imageURL)
	if err != nil {
		log.Println("insert update:", err)
		writeError(w, http.StatusInternalServerError, "failed to save update")
		return
	}

	id, _ := res.LastInsertId()
	var update Update
	err = db.QueryRow(`SELECT id, title, category, description, image_url, created_at FROM updates WHERE id = ?`, id).
		Scan(&update.ID, &update.Title, &update.Category, &update.Description, &update.ImageURL, &update.CreatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "update saved but could not be reloaded")
		return
	}
	writeJSON(w, http.StatusCreated, update)
}

// saveUploadedImage pulls the "image" file out of the request (if present),
// validates its extension, and writes it to the uploads folder with a
// unique, collision-proof filename. Returns the public URL path to store
// in the DB, or "" if no file was uploaded.
func saveUploadedImage(r *http.Request) (string, error) {
	return saveUploadedImageField(r, "image")
}

func saveUploadedImageField(r *http.Request, fieldName string) (string, error) {
	file, header, err := r.FormFile(fieldName)
	if err != nil {
		// no file uploaded - that's fine, image is optional
		return "", nil
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !allowedImageExt[ext] {
		return "", fmt.Errorf("only jpg, jpeg, png, webp or gif images are allowed")
	}

	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	dstPath := filepath.Join(uploadsDir, filename)

	dst, err := os.Create(dstPath)
	if err != nil {
		log.Println("create upload file:", err)
		return "", fmt.Errorf("failed to save image")
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		log.Println("write upload file:", err)
		return "", fmt.Errorf("failed to save image")
	}

	return "/uploads/" + filename, nil
}

// DELETE /api/items/{id} - removes the DB row and best-effort deletes the
// image file from disk too.
func handleDeleteItem(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid item id")
		return
	}

	var imageURL string
	err = db.QueryRow(`SELECT image_url FROM items WHERE id = ?`, id).Scan(&imageURL)
	if err != nil {
		writeError(w, http.StatusNotFound, "item not found")
		return
	}

	if _, err := db.Exec(`DELETE FROM items WHERE id = ?`, id); err != nil {
		log.Println("delete item:", err)
		writeError(w, http.StatusInternalServerError, "failed to delete item")
		return
	}

	if imageURL != "" {
		localPath := strings.Replace(imageURL, "/uploads/", uploadsDir+"/", 1)
		_ = os.Remove(localPath) // ignore error, file might already be gone
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "item deleted"})
}

func handleDeleteUpdate(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid update id")
		return
	}

	var imageURL string
	if err := db.QueryRow(`SELECT image_url FROM updates WHERE id = ?`, id).Scan(&imageURL); err != nil {
		writeError(w, http.StatusNotFound, "update not found")
		return
	}
	if _, err := db.Exec(`DELETE FROM updates WHERE id = ?`, id); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete update")
		return
	}
	if imageURL != "" {
		localPath := strings.Replace(imageURL, "/uploads/", uploadsDir+"/", 1)
		_ = os.Remove(localPath)
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "update deleted"})
}
