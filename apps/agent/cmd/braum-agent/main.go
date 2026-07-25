package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/elite-silab/braum-probe/apps/agent/internal/agent"
)

var version = "dev"

func main() {
	configPath := flag.String("config", "/etc/braum-agent/config.json", "configuration file")
	initConfig := flag.Bool("init-config", false, "create the initial configuration file")
	server := flag.String("server", "", "Workers API base URL")
	nodeID := flag.String("node", "", "node ID")
	token := flag.String("token", "", "one-time enrollment token")
	showVersion := flag.Bool("version", false, "print version")
	flag.Parse()

	if *showVersion {
		fmt.Printf("braum-agent %s\n", version)
		return
	}
	if *initConfig {
		config := &agent.Config{Server: *server, NodeID: *nodeID, EnrollmentToken: *token, Interval: 60}
		if err := agent.SaveConfig(*configPath, config); err != nil {
			log.Fatalf("initialize config: %v", err)
		}
		return
	}

	config, err := agent.LoadConfig(*configPath)
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	client := agent.NewAPIClient(config.Server)
	system := agent.CollectSystemInfo(version)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if config.AgentSecret == "" {
		secret, interval, enrollErr := client.Enroll(ctx, config, system)
		if enrollErr != nil {
			log.Fatalf("enroll agent: %v", enrollErr)
		}
		config.AgentSecret = secret
		config.EnrollmentToken = ""
		config.Interval = interval
		if err := agent.SaveConfig(*configPath, config); err != nil {
			log.Fatalf("save enrolled credentials: %v", err)
		}
		log.Printf("agent enrolled for node %s", config.NodeID)
	}

	backoff := 5 * time.Second
	var probeRunning atomic.Bool
	for {
		if ctx.Err() != nil {
			return
		}
		data, heartbeatErr := client.Heartbeat(ctx, config, system, agent.CollectMetrics())
		if heartbeatErr != nil {
			log.Printf("heartbeat failed: %v", heartbeatErr)
			select {
			case <-ctx.Done():
				return
			case <-time.After(backoff):
			}
			if backoff < 5*time.Minute {
				backoff *= 2
			}
			continue
		}
		backoff = 5 * time.Second
		if data.HeartbeatInterval >= 60 {
			config.Interval = data.HeartbeatInterval
		}
		if len(data.Targets) > 0 && probeRunning.CompareAndSwap(false, true) {
			targets := append([]agent.Target(nil), data.Targets...)
			reportConfig := *config
			go func() {
				defer probeRunning.Store(false)
				results := agent.ProbeAll(ctx, targets)
				if err := client.Report(ctx, &reportConfig, results); err != nil {
					log.Printf("report probe results: %v", err)
				}
			}()
		}
		jitter := time.Duration(rand.Intn(5000)) * time.Millisecond
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Duration(config.Interval)*time.Second + jitter):
		}
	}
}
