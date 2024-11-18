package main

import (
	"fmt"
	"os"
	"os/signal"
	"path"

	"github.com/containerd/cgroups"
	"github.com/lawrencegripper/actions-dns-monitoring/pkg/dns"
	"github.com/lawrencegripper/actions-dns-monitoring/pkg/ebpf"
	"github.com/moby/sys/mountinfo"
)

func main() {
	fmt.Println("Let's have a peak at what DNS requests are made by this process on port 53!")

	// TODO: Bug - The DNS upstream server is also redirected by the attached eBPF program
	//       because we're running the dns server in the same cgroup here we need to exclude it
	//       somehow so it can forward to the real upstream DNS server.
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

	mounts, err := mountinfo.GetMounts(mountinfo.FSTypeFilter("cgroup2"))
	if err != nil {
		fmt.Printf("failed to get cgroup2 mounts: %s\n", err.Error())
		os.Exit(103)
	}
	if len(mounts) == 0 {
		fmt.Printf("no cgroup2 mounts found\n")
		os.Exit(104)
	}
	cgroup2Mount := mounts[0]

	cgroupPathForCurrentProcess = path.Join(cgroup2Mount.Mountpoint, cgroupPathForCurrentProcess)

	fmt.Println("Attaching to cgroup: ", cgroupPathForCurrentProcess)

  // then attach the eBPF program to it
	err = ebpf.AttachRedirectorToCGroup(cgroupPathForCurrentProcess, dns.Port)
	if err != nil {
		fmt.Printf("Failed to attach eBPF program to cgroup: %v\n", err)
		os.Exit(105)
	}

	// Now lets wait and see what DNS request happen
	fmt.Println("DNS monitoring proxy started successfully")

	// In the post hook we'll send a sigint and we can output the log
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)
	<-c

	fmt.Println("Sig int received, shutting down")

	fmt.Println("DNS Requests Log:")
	for requestedDomain, logEntry := range dns.BlockingDNSHandler.DNSLog {
		fmt.Println(requestedDomain)
		fmt.Println(logEntry)
	}

	fmt.Println("Blocked Requests Log:")
	for _, logEntry := range dns.BlockingDNSHandler.BlockLog {
		fmt.Println(logEntry)
	}
}