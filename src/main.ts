import * as core from '@actions/core'
const { spawn } = require('child_process')
const currentDir = require('path').dirname(require.main?.filename || __dirname)
const fs = require('fs')

function getDnsMonitorPid() {
  return core.getState('dns-monitor-pid')
}

function setDnsMonitorPid(pid: string) {
  core.saveState('dns-monitor-pid', pid)
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const pid = parseInt(getDnsMonitorPid())
    if (pid) {
      // This is a post-run step
      core.warning(
        `This is a post-run step and dns monitor is already running ${pid}`
      )

      try {
        const monitorContent = fs.readFileSync('/tmp/dns-monitor.json', 'utf8')
        core.info('DNS Monitor Log:')
        core.info(monitorContent)
      } catch (err) {
        core.warning('Could not read DNS monitor log: ' + err)
      }

      try {
        const monitorContent = fs.readFileSync(
          '/tmp/ebpf-firewall-start.txt',
          'utf8'
        )
        core.info('DNS Monitor Log:')
        core.info(monitorContent)
      } catch (err) {
        core.warning('Could not read DNS monitor log: ' + err)
      }

      if (pid) {
        core.warning(`Sending SIGINT to dns monitor process ${pid}`)
        process.kill(pid, 'SIGINT')
      }
      return
    } else {
      core.warning(`Current directory: ${currentDir}`)
      core.warning(`Running dns-cgroup-monitor... from ${currentDir}`)
      const blockList = process.env.BLOCK_LIST || 'example.com'
      const monitor = spawn(
        'sudo',
        [
          '/bin/bash',
          '-c',
          `exec ${currentDir}/ebpf-cgroup-firewall attach --debug --block-list '${blockList}' --log-file /tmp/dns-monitor.json`
        ],
        {
          stdio: 'ignore', // piping all stdio to /dev/null
          detached: true,
          env: process.env
        }
      )

      const dnsMonitorPid = monitor.pid.toString()
      setDnsMonitorPid(dnsMonitorPid)
      core.warning(`dns monitor pid: ${dnsMonitorPid}`)
      monitor.on('error', (err: any) =>
        core.warning(`dns monitor error: ${err}`)
      )
      monitor.on('close', () => core.warning('dns monitor process exited'))
      monitor.unref()

      // Set outputs for other workflow steps to use
      core.setOutput('time', new Date().toTimeString())
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
