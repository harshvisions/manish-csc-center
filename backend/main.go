package main

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"
)

const (
	uploadsDir  = "./uploads"
	frontendDir = "../frontend"
)

var sessions = struct {
	sync.RWMutex
	tokens map[string]struct{}
}{tokens: make(map[string]struct{})}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		log.Fatalf("could not create uploads dir: %v", err)
	}

	initDB("./manish_csc.db")
	defer db.Close()

	mux := http.NewServeMux()

	// --- API routes ---
	// Go 1.22+ mux supports method + path patterns natively, so we don't
	// need an external router just for a handful of endpoints.
	mux.HandleFunc("GET /api/items", handleGetItems)
	mux.HandleFunc("GET /api/updates", handleGetUpdates)
	mux.HandleFunc("POST /api/login", handleLogin)
	mux.Handle("POST /api/items", requireAdmin(http.HandlerFunc(handleCreateItem)))
	mux.Handle("DELETE /api/items/{id}", requireAdmin(http.HandlerFunc(handleDeleteItem)))
	mux.Handle("POST /api/updates", requireAdmin(http.HandlerFunc(handleCreateUpdate)))
	mux.Handle("DELETE /api/updates/{id}", requireAdmin(http.HandlerFunc(handleDeleteUpdate)))

	// --- uploaded images ---
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadsDir))))

	// --- static frontend (plain HTML/CSS/JS, no build step) ---
	mux.HandleFunc("GET /admin.html", handleAdminPage)
	mux.Handle("/", http.FileServer(http.Dir(frontendDir)))

	handler := logRequests(mux)

	log.Printf("Manish CSC Center running on port %s\n", port)
	log.Fatal(http.ListenAndServe("0.0.0.0:"+port, handler))
}

func handleAdminPage(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("admin_session")
	if err != nil || !validSession(cookie.Value) {
		http.Redirect(w, r, "/admin-login.html", http.StatusFound)
		return
	}
	http.ServeFile(w, r, filepath.Join(frontendDir, "admin.html"))
}

func requireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("admin_session")
		if err != nil || !validSession(cookie.Value) {
			writeError(w, http.StatusUnauthorized, "admin login required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func validSession(token string) bool {
	sessions.RLock()
	defer sessions.RUnlock()
	_, ok := sessions.tokens[token]
	return ok
}

func newSessionToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// logRequests is a tiny middleware that prints each request to stdout -
// handy for debugging while developing locally.
func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
	})
}
