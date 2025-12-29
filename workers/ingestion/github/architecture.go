package github

import (
	"context"
	"log"
	"strings"

	"github.com/google/go-github/v61/github"
)


type ArchFile struct {
	Path        string                 `json:"path"`
	Name        string                 `json:"name"`
	HTMLURL     string                 `json:"html_url"`
	Content     string                 `json:"content"`
	Size        int                    `json:"size"`
	Language    string                 `json:"language,omitempty"`
	Role        string                 `json:"role"`
	Importance  float32                `json:"importance"`
	Signals     map[string]interface{} `json:"signals,omitempty"`
	IsTruncated bool                   `json:"is_truncated"`
}


func FetchRepoArchitecture(client *github.Client, owner, repo string) ([]ArchFile, error) {
	ctx := context.Background()
	log.Printf("[ingest] architecture scan: %s/%s", owner, repo)

	_, directoryContent, _, err := client.Repositories.GetContents(ctx, owner, repo, "", nil)
	if err != nil {
		return nil, err
	}

	var targets []string
	for _, item := range directoryContent {
		if item.GetType() != "file" {
			continue
		}
		for _, re := range ARCH_PATTERNS {
			if re.MatchString(item.GetName()) {
				targets = append(targets, item.GetPath())
				break
			}
		}
	}

	targets = append(targets, KNOWN_DEEP_FILES...)

	var results []ArchFile

	for _, path := range targets {
		fileData, _, _, err := client.Repositories.GetContents(ctx, owner, repo, path, nil)
		if err != nil {
			continue
		}

		if isUseless(path) {
			continue
		}

		raw, _ := fileData.GetContent()
		truncatedContent, wasTruncated := truncateWithFlag(raw, 25000)

		role := detectRole(fileData.GetPath())

		results = append(results, ArchFile{
			Path:        fileData.GetPath(),
			Name:        fileData.GetName(),
			HTMLURL:     fileData.GetHTMLURL(),
			Content:     truncatedContent,
			Size:        fileData.GetSize(),
			Language:    detectLanguage(fileData.GetName()),
			Role:        role,
			Importance:  roleImportance(role),
			Signals:     extractSignals(fileData.GetPath(), truncatedContent),
			IsTruncated: wasTruncated,
		})

		log.Printf("[ingest] indexed: %s (%d bytes)", path, fileData.GetSize())
	}

	_ = writeJSON("architecture.json", results)
	return results, nil
}


func detectLanguage(filename string) string {
	ext := strings.ToLower(filename)
	switch {
	case strings.HasSuffix(ext, ".ts") || strings.Contains(ext, "tsconfig"):
		return "TypeScript"
	case strings.HasSuffix(ext, ".go") || ext == "go.mod":
		return "Go"
	case strings.HasSuffix(ext, ".js") || ext == "package.json":
		return "JavaScript"
	case strings.HasSuffix(ext, ".py"):
		return "Python"
	case strings.Contains(ext, "docker"):
		return "Docker"
	case strings.HasSuffix(ext, ".yml") || strings.HasSuffix(ext, ".yaml"):
		return "YAML"
	default:
		return "Config"
	}
}

func detectRole(path string) string {
	p := strings.ToLower(path)

	if strings.HasPrefix(p, "readme") ||
		strings.HasSuffix(p, ".md") ||
		strings.Contains(p, "docs/") {
		return "documentation"
	}

	if strings.Contains(p, ".github/workflows") ||
		strings.Contains(p, "ci") && strings.HasSuffix(p, ".yml") {
		return "ci_pipeline"
	}

	if strings.Contains(p, "dockerfile") {
		return "runtime_config"
	}
	if strings.Contains(p, "docker-compose") ||
		strings.Contains(p, "compose.") {
		return "runtime_orchestration"
	}

	if p == "package.json" ||
		p == "go.mod" ||
		p == "requirements.txt" ||
		p == "pyproject.toml" ||
		p == "pom.xml" {
		return "dependency_manifest"
	}

	if strings.Contains(p, "tsconfig") ||
		strings.Contains(p, "babel") ||
		strings.Contains(p, "webpack") ||
		strings.Contains(p, "vite") ||
		strings.Contains(p, "rollup") ||
		strings.Contains(p, "jest") ||
		strings.Contains(p, "eslint") ||
		strings.Contains(p, "prettier") {
		return "build_config"
	}

	if strings.Contains(p, "terraform") ||
		strings.HasSuffix(p, ".tf") ||
		strings.Contains(p, "helm") ||
		strings.HasSuffix(p, "chart.yaml") ||
		strings.Contains(p, "k8s") ||
		strings.Contains(p, "kubernetes") {
		return "infra_config"
	}

	if strings.HasSuffix(p, "main.go") ||
		strings.HasSuffix(p, "app.go") ||
		strings.HasSuffix(p, "server.go") ||
		strings.HasSuffix(p, "index.js") ||
		strings.HasSuffix(p, "index.ts") ||
		strings.HasSuffix(p, "app.ts") ||
		strings.HasSuffix(p, "app.js") {
		return "entrypoint"
	}

	if strings.Contains(p, "test") &&
		(strings.HasSuffix(p, ".js") ||
			strings.HasSuffix(p, ".ts") ||
			strings.HasSuffix(p, ".go")) {
		return "test_config"
	}

	return "config"
}


func roleImportance(role string) float32 {
	switch role {
	case "entrypoint":
		return 1.0
	case "runtime_config", "runtime_orchestration":
		return 0.9
	case "ci_pipeline":
		return 0.85
	case "dependency_manifest":
		return 0.8
	case "build_config":
		return 0.7
	case "documentation":
		return 0.6
	default:
		return 0.4
	}
}


func extractSignals(path, content string) map[string]interface{} {
	p := strings.ToLower(path)
	c := strings.ToLower(content)

	signals := map[string]interface{}{}

	if strings.Contains(p, "dockerfile") {
		if strings.Contains(c, "node") {
			signals["runtime"] = "node"
		}
		if strings.Contains(c, "python") {
			signals["runtime"] = "python"
		}
		if strings.Contains(c, "expose") {
			signals["exposes_port"] = true
		}
	}

	if p == "package.json" {
		if strings.Contains(c, "\"express\"") {
			signals["framework"] = "express"
		}
		if strings.Contains(c, "\"jest\"") {
			signals["test_runner"] = "jest"
		}
	}

	if strings.HasPrefix(p, "readme") {
		if strings.Contains(c, "backend") {
			signals["project_type"] = "backend"
		}
		if strings.Contains(c, "payment") {
			signals["domain"] = "payments"
		}
	}

	if len(signals) == 0 {
		return nil
	}
	return signals
}


func truncateWithFlag(text string, limit int) (string, bool) {
	if len(text) > limit {
		return text[:limit] + "\n\n... [CONTENT TRUNCATED FOR TOKEN EFFICIENCY] ...", true
	}
	return text, false
}

func isUseless(path string) bool {
	p := strings.ToLower(path)

	if strings.HasSuffix(p, ".lock") ||
		strings.HasSuffix(p, ".sum") ||
		p == "package-lock.json" ||
		p == "pnpm-lock.yaml" {
		return true
	}

	if strings.HasSuffix(p, ".exe") ||
		strings.HasSuffix(p, ".bin") ||
		strings.HasSuffix(p, ".pyc") {
		return true
	}

	if strings.HasSuffix(p, ".png") ||
		strings.HasSuffix(p, ".jpg") ||
		strings.HasSuffix(p, ".svg") ||
		strings.HasSuffix(p, ".pdf") {
		return true
	}

	return false
}
