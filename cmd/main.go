package main

import (
	"fmt"
	"os"
	"os/signal"

	"github.com/containerd/cgroups"
	"github.com/lawrencegripper/actions-dns-monitoring/pkg/dns"
	"github.com/lawrencegripper/actions-dns-monitoring/pkg/ebpf"
)

func main() {
	fmt.Println("Let's have a peak at what DNS requests are made by this process on port 53!")

	dns, err := dns.StartDNSMonitoringProxy([]string{"example.com"})
	if err != nil {
		fmt.Printf("Failed to start DNS blocking proxy: %v\n", err)
		os.Exit(101)
	}

	// Actions should already be running the worker in a cgroup so we can just attach to that
	// first find it:
	cgroupProcFile := fmt.Sprintf("/proc/%d/cgroup", os.Getpid())
	_, cgroupPathForCurrentProcess, err := cgroups.ParseCgroupFileUnified(cgroupProcFile)
	if err != nil {
		fmt.Printf("Failed to get cgroup path: %v\n", err)
		os.Exit(102)
	}
  // then attach the eBPF program to it
	err = ebpf.AttachRedirectorToCGroup(cgroupPathForCurrentProcess, dns.Port)
	if err != nil {
		fmt.Printf("Failed to attach eBPF program to cgroup: %v\n", err)
		os.Exit(103)
	}

	// Now lets wait and see what DNS request happen
	fmt.Println("DNS monitoring proxy started successfully")

	// In the post hook we'll send a sigint and we can output the log
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)
	<-c

	fmt.Println("Sig int received, shutting down")

	fmt.Println("DNS Requests Log:")
	for _, logEntry := range dns.BlockingDNSHandler.DNSLog {
		fmt.Println(logEntry)
	}

	fmt.Println("Blocked Requests Log:")
	for _, logEntry := range dns.BlockingDNSHandler.BlockLog {
		fmt.Println(logEntry)
	}
}