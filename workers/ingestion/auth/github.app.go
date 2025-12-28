package auth

import (
	"crypto/rsa"
	"encoding/json"
	"errors"
	"os"
	"net/http"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const githubAPI = "https://api.github.com"

type GitHubApp struct {
	AppID      string 
	PrivateKey *rsa.PrivateKey
}

func LoadPrivateKey(path string) (*rsa.PrivateKey, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return jwt.ParseRSAPrivateKeyFromPEM(data)
}

func NewGitHubApp(appID, pemPath string) (*GitHubApp, error) {
	key, err := LoadPrivateKey(pemPath)
	if err != nil {
		return nil, err
	}
	return &GitHubApp{
		AppID:      appID,
		PrivateKey: key,
	}, nil
}

func (a *GitHubApp) generateJWT() (string, error) {
	now := time.Now()

	claims := jwt.MapClaims{
		"iat": now.Unix(),
		"exp": now.Add(9 * time.Minute).Unix(),
		"iss": a.AppID,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	return token.SignedString(a.PrivateKey)
}

func (a *GitHubApp) GetInstallationToken(owner, repo string) (string, error) {
	jwtToken, err := a.generateJWT()
	if err != nil {
		return "", err
	}

	installationID, err := getInstallationID(jwtToken, owner, repo)
	if err != nil {
		return "", err
	}

	req, _ := http.NewRequest(
		"POST",
		githubAPI+"/app/installations/"+installationID+"/access_tokens",
		nil,
	)
	req.Header.Set("Authorization", "Bearer "+jwtToken)
	req.Header.Set("Accept", "application/vnd.github+json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	var out struct {
		Token string `json:"token"`
	}
	json.NewDecoder(res.Body).Decode(&out)

	if out.Token == "" {
		return "", errors.New("failed to get installation token")
	}

	return out.Token, nil
}

func getInstallationID(jwtToken, owner, repo string) (string, error) {
	req, _ := http.NewRequest(
		"GET",
		githubAPI+"/repos/"+owner+"/"+repo+"/installation",
		nil,
	)
	req.Header.Set("Authorization", "Bearer "+jwtToken)
	req.Header.Set("Accept", "application/vnd.github+json")

	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	var out struct {
		ID int64 `json:"id"`
	}
	json.NewDecoder(res.Body).Decode(&out)

	if out.ID == 0 {
		return "", errors.New("installation not found")
	}

	return strconv.FormatInt(out.ID, 10), nil
}
