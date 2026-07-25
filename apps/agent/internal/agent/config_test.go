package agent

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSaveAndLoadConfigRemovesBroadPermissions(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	original := &Config{Server: "https://api.example.com", NodeID: "node-1", EnrollmentToken: "once", Interval: 60}
	if err := SaveConfig(path, original); err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0600 {
		t.Fatalf("config mode = %o, want 600", info.Mode().Perm())
	}
	loaded, err := LoadConfig(path)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.NodeID != "node-1" || loaded.EnrollmentToken != "once" {
		t.Fatalf("unexpected config: %#v", loaded)
	}
}

func TestConfigRejectsPlainHTTPRemoteServer(t *testing.T) {
	config := &Config{Server: "http://api.example.com", NodeID: "node-1", EnrollmentToken: "once"}
	if err := config.Validate(); err == nil {
		t.Fatal("expected insecure server validation error")
	}
}
