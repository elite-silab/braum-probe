package agent

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	Server          string `json:"server"`
	NodeID          string `json:"node_id"`
	EnrollmentToken string `json:"enrollment_token,omitempty"`
	AgentSecret     string `json:"agent_secret,omitempty"`
	Interval        int    `json:"interval,omitempty"`
}

func (c *Config) Validate() error {
	c.Server = strings.TrimRight(strings.TrimSpace(c.Server), "/")
	c.NodeID = strings.TrimSpace(c.NodeID)
	if !strings.HasPrefix(c.Server, "https://") && !strings.HasPrefix(c.Server, "http://localhost") && !strings.HasPrefix(c.Server, "http://127.0.0.1") {
		return errors.New("server must use HTTPS (HTTP is only allowed for localhost)")
	}
	if c.NodeID == "" || len(c.NodeID) > 100 {
		return errors.New("invalid node_id")
	}
	if c.AgentSecret == "" && c.EnrollmentToken == "" {
		return errors.New("agent_secret or enrollment_token is required")
	}
	if c.Interval < 60 {
		c.Interval = 60
	}
	return nil
}

func LoadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}
	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	if err := config.Validate(); err != nil {
		return nil, err
	}
	return &config, nil
}

func SaveConfig(path string, config *Config) error {
	if err := config.Validate(); err != nil {
		return err
	}
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	temporary := path + ".tmp"
	if err := os.WriteFile(temporary, append(data, '\n'), 0600); err != nil {
		return err
	}
	if err := os.Rename(temporary, path); err != nil {
		_ = os.Remove(temporary)
		return err
	}
	return os.Chmod(path, 0600)
}
