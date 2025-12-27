package main

import "log"

func main() {
	cfg := LoadConfig()

	if err := StartWorker(cfg); err != nil {
		log.Fatal(err)
	}
}
