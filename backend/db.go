package main

import (
	"database/sql"
	"log"

	_ "github.com/mattn/go-sqlite3"
)

// global db handle, kept simple on purpose - this is a small single-file app,
// no need for a repository/DI layer here.
var db *sql.DB

func initDB(path string) {
	var err error
	db, err = sql.Open("sqlite3", path)
	if err != nil {
		log.Fatalf("could not open database: %v", err)
	}

	if err = db.Ping(); err != nil {
		log.Fatalf("could not connect to database: %v", err)
	}

	schema := `
	CREATE TABLE IF NOT EXISTS items (
		id          INTEGER PRIMARY KEY AUTOINCREMENT,
		title       TEXT NOT NULL,
		category    TEXT NOT NULL,
		description TEXT,
		image_url   TEXT,
		created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS updates (
		id          INTEGER PRIMARY KEY AUTOINCREMENT,
		title       TEXT NOT NULL,
		category    TEXT NOT NULL,
		description TEXT,
		image_url   TEXT,
		created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);`

	if _, err = db.Exec(schema); err != nil {
		log.Fatalf("could not create items table: %v", err)
	}

	var priceColumn int
	err = db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('items') WHERE name = 'price'`).Scan(&priceColumn)
	if err != nil {
		log.Fatalf("could not inspect items table: %v", err)
	}
	if priceColumn == 0 {
		if _, err = db.Exec(`ALTER TABLE items ADD COLUMN price REAL NOT NULL DEFAULT 0`); err != nil {
			log.Fatalf("could not add item price column: %v", err)
		}
	}

	log.Println("database ready:", path)
}
