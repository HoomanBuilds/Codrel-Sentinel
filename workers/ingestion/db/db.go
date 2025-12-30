package db

import (
	"database/sql"
	"log"
	"os"
	"strings"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
)

var DB *sql.DB

func InitDB() {
	_ = godotenv.Load()
	connStr := os.Getenv("DATABASE_URL")

	if connStr == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	if !strings.Contains(connStr, "binary_parameters=yes") {
		if strings.Contains(connStr, "?") {
			connStr += "&binary_parameters=yes"
		} else {
			connStr += "?binary_parameters=yes"
		}
	}

	var err error
	DB, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Failed to open database connection:", err)
	}

	if err = DB.Ping(); err != nil {
		log.Fatal("Failed to ping database:", err)
	}

	log.Println("✅ Connected to Database (Binary Parameters Enabled)")
}

func UpdateStatus(repoID string, status string) error {
	query := `
    UPDATE repositories 
    SET status = $1, updated_at = NOW() 
    WHERE id = $2
  `
	_, err := DB.Exec(query, status, repoID)
	if err != nil {
		log.Printf("❌ Failed to update status for %s to %s: %v", repoID, status, err)
		return err
	}

	log.Printf("🔄 Repo %s status updated to: %s", repoID, status)
	return nil
}

func MarkFailed(repoID string, errMsg string) error {
	query := `
    UPDATE repositories 
    SET status = 'FAILED', error = $1, updated_at = NOW() 
    WHERE id = $2
  `
	_, err := DB.Exec(query, errMsg, repoID)
	return err
}