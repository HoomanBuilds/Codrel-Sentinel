package github

import (
	"github.com/google/go-github/v61/github"
)


func NewClient(token string) *github.Client {
	return github.NewClient(nil).WithAuthToken(token)
}