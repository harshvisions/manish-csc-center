package main

// Item is a single product or service listed in the catalog.
// Category is expected to be either "CSC Service" or "Electronics" -
// enforced in the handler, not at the DB level, to keep the schema simple.
type Item struct {
	ID          int64   `json:"id"`
	Title       string  `json:"title"`
	Category    string  `json:"category"`
	Price       float64 `json:"price"`
	Description string  `json:"description"`
	ImageURL    string  `json:"imageUrl"`
	CreatedAt   string  `json:"createdAt"`
}

type Update struct {
	ID          int64  `json:"id"`
	Title       string `json:"title"`
	Category    string `json:"category"`
	Description string `json:"description"`
	ImageURL    string `json:"imageUrl"`
	CreatedAt   string `json:"createdAt"`
}
