package agent

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"syscall"
	"time"
)

type cpuSample struct{ idle, total uint64 }

func readCPUSample() (cpuSample, error) {
	file, err := os.Open("/proc/stat")
	if err != nil {
		return cpuSample{}, err
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	if !scanner.Scan() {
		return cpuSample{}, fmt.Errorf("missing cpu line")
	}
	fields := strings.Fields(scanner.Text())
	if len(fields) < 8 || fields[0] != "cpu" {
		return cpuSample{}, fmt.Errorf("invalid cpu line")
	}
	var values []uint64
	for _, field := range fields[1:] {
		value, parseErr := strconv.ParseUint(field, 10, 64)
		if parseErr != nil {
			return cpuSample{}, parseErr
		}
		values = append(values, value)
	}
	var total uint64
	for _, value := range values {
		total += value
	}
	idle := values[3]
	if len(values) > 4 {
		idle += values[4]
	}
	return cpuSample{idle: idle, total: total}, nil
}

func cpuUsage() float64 {
	first, err := readCPUSample()
	if err != nil {
		return 0
	}
	time.Sleep(200 * time.Millisecond)
	second, err := readCPUSample()
	if err != nil || second.total <= first.total {
		return 0
	}
	total := second.total - first.total
	idle := second.idle - first.idle
	value := (1 - float64(idle)/float64(total)) * 100
	if value < 0 {
		return 0
	}
	if value > 100 {
		return 100
	}
	return value
}

func memInfo() (used, total, swapUsed, swapTotal int64) {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return
	}
	values := map[string]int64{}
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 2 {
			value, _ := strconv.ParseInt(fields[1], 10, 64)
			values[strings.TrimSuffix(fields[0], ":")] = value * 1024
		}
	}
	total = values["MemTotal"]
	available := values["MemAvailable"]
	if available == 0 {
		available = values["MemFree"] + values["Buffers"] + values["Cached"]
	}
	used = total - available
	if used < 0 {
		used = 0
	}
	swapTotal = values["SwapTotal"]
	swapUsed = swapTotal - values["SwapFree"]
	if swapUsed < 0 {
		swapUsed = 0
	}
	return
}

func diskInfo() (used, total int64) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs("/", &stat); err != nil {
		return
	}
	total = int64(stat.Blocks) * int64(stat.Bsize)
	available := int64(stat.Bavail) * int64(stat.Bsize)
	used = total - available
	return
}

func loads() (float64, float64, float64) {
	data, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return 0, 0, 0
	}
	fields := strings.Fields(string(data))
	if len(fields) < 3 {
		return 0, 0, 0
	}
	one, _ := strconv.ParseFloat(fields[0], 64)
	five, _ := strconv.ParseFloat(fields[1], 64)
	fifteen, _ := strconv.ParseFloat(fields[2], 64)
	return one, five, fifteen
}

func networkBytes() (rx, tx int64) {
	data, err := os.ReadFile("/proc/net/dev")
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(data), "\n") {
		parts := strings.Split(line, ":")
		if len(parts) != 2 || strings.TrimSpace(parts[0]) == "lo" {
			continue
		}
		fields := strings.Fields(parts[1])
		if len(fields) < 9 {
			continue
		}
		received, _ := strconv.ParseInt(fields[0], 10, 64)
		transmitted, _ := strconv.ParseInt(fields[8], 10, 64)
		rx += received
		tx += transmitted
	}
	return
}

func countNumericDirectories(path string) int {
	entries, err := os.ReadDir(path)
	if err != nil {
		return 0
	}
	count := 0
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		if _, err := strconv.Atoi(entry.Name()); err == nil {
			count++
		}
	}
	return count
}

func tcpConnections() int {
	count := 0
	for _, path := range []string{"/proc/net/tcp", "/proc/net/tcp6"} {
		data, err := os.ReadFile(path)
		if err == nil {
			lines := strings.Split(strings.TrimSpace(string(data)), "\n")
			if len(lines) > 1 {
				count += len(lines) - 1
			}
		}
	}
	return count
}

func uptimeSeconds() int64 {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(data))
	if len(fields) == 0 {
		return 0
	}
	value, _ := strconv.ParseFloat(fields[0], 64)
	return int64(value)
}

func commandOutput(name string, args ...string) string {
	output, err := exec.Command(name, args...).Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(output))
}

func osReleaseValue(content, key string) string {
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		name, value, found := strings.Cut(line, "=")
		if !found || name != key {
			continue
		}
		value = strings.TrimSpace(value)
		if len(value) >= 2 && value[0] == '"' && value[len(value)-1] == '"' {
			if unquoted, err := strconv.Unquote(value); err == nil {
				return strings.TrimSpace(unquoted)
			}
		}
		return strings.Trim(strings.TrimSpace(value), "'")
	}
	return ""
}

func parseOSReleasePrettyName(content string) string {
	if pretty := osReleaseValue(content, "PRETTY_NAME"); pretty != "" {
		return pretty
	}
	return osReleaseValue(content, "NAME")
}

func platformName() string {
	data, err := os.ReadFile("/etc/os-release")
	if err != nil {
		return ""
	}
	return parseOSReleasePrettyName(string(data))
}

func cpuModel() string {
	data, err := os.ReadFile("/proc/cpuinfo")
	if err != nil {
		return ""
	}
	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "model name") || strings.HasPrefix(line, "Hardware") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				return strings.TrimSpace(parts[1])
			}
		}
	}
	return ""
}

func privateIPs() []string {
	addresses, _ := net.InterfaceAddrs()
	result := make([]string, 0, len(addresses))
	for _, address := range addresses {
		ip, _, err := net.ParseCIDR(address.String())
		if err == nil && !ip.IsLoopback() {
			result = append(result, ip.String())
		}
	}
	return result
}

func CollectSystemInfo(version string) SystemInfo {
	hostname, _ := os.Hostname()
	return SystemInfo{
		Hostname: hostname, OS: runtime.GOOS, Platform: platformName(),
		KernelVersion: commandOutput("uname", "-r"), Arch: runtime.GOARCH,
		CPUModel: cpuModel(), CPUCores: runtime.NumCPU(), AgentVersion: version, PrivateIPs: privateIPs(),
	}
}

func CollectMetrics() Metrics {
	memoryUsed, memoryTotal, swapUsed, swapTotal := memInfo()
	diskUsed, diskTotal := diskInfo()
	load1, load5, load15 := loads()
	rx, tx := networkBytes()
	return Metrics{
		CPUUsage: cpuUsage(), MemoryUsed: memoryUsed, MemoryTotal: memoryTotal,
		SwapUsed: swapUsed, SwapTotal: swapTotal, DiskUsed: diskUsed, DiskTotal: diskTotal,
		Load1: load1, Load5: load5, Load15: load15, NetworkRX: rx, NetworkTX: tx,
		TCPConnections: tcpConnections(), ProcessCount: countNumericDirectories("/proc"),
		UptimeSeconds: uptimeSeconds(), CollectedAt: nowISO(),
	}
}
