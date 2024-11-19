import * as core from '@actions/core'
import { get } from 'http'
const { spawn } = require('child_process')
const currentDir = require('path').dirname(require.main?.filename || __dirname)

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
      core.debug(
        `This is a post-run step and dns monitor is already running ${pid}`
      )

      if (pid) {
        core.debug(`Sending SIGINT to dns monitor process ${pid}`)
        process.kill(pid, 'SIGINT')
      }

      return
    } else {
      core.debug(`Current directory: ${currentDir}`)
      core.debug(`Running dns-cgroup-monitor... from ${currentDir}`)
      const monitor = spawn('sudo', [`${currentDir}/dist/dns-cgroup-monitor`], {
        stdio: 'ignore', // piping all stdio to /dev/null
        detached: true,
        env: process.env
      })

      const dnsMonitorPid = monitor.pid.toString()
      setDnsMonitorPid(dnsMonitorPid)
      core.debug(`dns monitor pid: ${dnsMonitorPid}`)
      monitor.unref()

      // Set outputs for other workflow steps to use
      core.setOutput('time', new Date().toTimeString())
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
