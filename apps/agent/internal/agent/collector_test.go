package agent

import "testing"

func TestParseOSReleasePrettyName(t *testing.T) {
	content := `PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"
NAME="Debian GNU/Linux"
ID=debian
`
	if got := parseOSReleasePrettyName(content); got != "Debian GNU/Linux 12 (bookworm)" {
		t.Fatalf("pretty name = %q", got)
	}
}

func TestParseOSReleaseFallsBackToName(t *testing.T) {
	content := "NAME=Alpine Linux\nID=alpine\n"
	if got := parseOSReleasePrettyName(content); got != "Alpine Linux" {
		t.Fatalf("fallback name = %q", got)
	}
}
