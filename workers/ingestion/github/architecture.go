package github

import (
	"context"
	"log"
	"strings"

	"github.com/google/go-github/v61/github"
)

type ArchFile struct {
	Path        string `json:"path"`
	Name        string `json:"name"`
	HTMLURL     string `json:"html_url"`
	Content     string `json:"content"`
	Size        int    `json:"size"`
	Language    string `json:"language,omitempty"`
	IsTruncated bool   `json:"is_truncated"`
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

		raw, _ := fileData.GetContent()
		if isUseless(path) {
			continue
		}

		truncatedContent, wasTruncated := truncateWithFlag(raw, 25000)
		
		results = append(results, ArchFile{
			Path:        fileData.GetPath(),
			Name:        fileData.GetName(),
			HTMLURL:     fileData.GetHTMLURL(),
			Content:     truncatedContent,
			Size:        fileData.GetSize(),
			Language:    detectLanguage(fileData.GetName()),
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
	case strings.HasSuffix(ext, ".ts") || strings.Contains(ext, "tsconfig"): return "TypeScript"
	case strings.HasSuffix(ext, ".go") || ext == "go.mod": return "Go"
	case strings.HasSuffix(ext, ".js") || ext == "package.json": return "JavaScript"
	case strings.HasSuffix(ext, ".py"): return "Python"
	case strings.Contains(ext, "docker"): return "Docker"
	case strings.HasSuffix(ext, ".yml") || strings.HasSuffix(ext, ".yaml"): return "YAML"
	default: return "Config"
	}
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
