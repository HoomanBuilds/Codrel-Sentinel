package github

import "regexp"

// ARCH_PATTERNS: The "Architecture Skeleton" Regex List
var ARCH_PATTERNS = []*regexp.Regexp{
	regexp.MustCompile(`(?i)^README(\.md|\.txt|\.rst)?$`),
	regexp.MustCompile(`(?i)^package\.json$`),
	regexp.MustCompile(`(?i)^tsconfig.*\.json$`),
	regexp.MustCompile(`(?i)^go\.mod$`),
	regexp.MustCompile(`(?i)^Dockerfile.*$`),
	regexp.MustCompile(`(?i)^docker-compose.*\.y(a)?ml$`),
	regexp.MustCompile(`(?i).*\.config\.(js|ts|mjs|cjs|json)$`),
	regexp.MustCompile(`(?i)^\.eslintrc\.(json|js|yml)$`),
	regexp.MustCompile(`(?i)^requirements\.txt$`),
	regexp.MustCompile(`(?i)^pyproject\.toml$`),
}

// KNOWN_DEEP_FILES: Files the AI always wants, even if they aren't in the root.
var KNOWN_DEEP_FILES = []string{
	".github/workflows/main.yml",
	"src/app.ts",
	"cmd/main.go",
}