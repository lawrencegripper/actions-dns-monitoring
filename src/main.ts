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
      core.debug(
        `This is a post-run step and dns monitor is already running ${pid}`
      )

      try {
        const monitorContent = fs.readFileSync('/tmp/dns-monitor.log', 'utf8')
        core.info('DNS Monitor Log:')
        core.info(monitorContent)
      } catch (err) {
        core.warning('Could not read DNS monitor log: ' + err)
      }

      if (pid) {
        core.debug(`Sending SIGINT to dns monitor process ${pid}`)
        process.kill(pid, 'SIGINT')
      }

      // Wait for process to exit
      await new Promise<void>(resolve => {
        const checkInterval = setInterval(() => {
          try {
            process.kill(pid, 0)
          } catch {
            clearInterval(checkInterval)
            resolve()
          }
        }, 100)
      })

      // output captured logs
      try {
        const logContent = fs.readFileSync('/tmp/dnsrequests.log', 'utf8')
        core.info('DNS Requests Log:')
        core.info(logContent)
      } catch (err) {
        core.warning('Could not read DNS requests log: ' + err)
      }

      try {
        const blockedContent = fs.readFileSync('/tmp/dnsblocked.log', 'utf8')
        core.warning('DNS Blocked Requests:')
        core.warning(blockedContent)
      } catch (err) {
        core.warning('Could not read DNS blocked requests log: ' + err)
      }
      return
    } else {
      core.debug(`Current directory: ${currentDir}`)
      core.debug(`Running dns-cgroup-monitor... from ${currentDir}`)
      const monitor = spawn(
        'sudo',
        [
          '/bin/bash',
          '-c',
          `${currentDir}/dns-cgroup-monitor > /tmp/dns-monitor.log 2>&1`
        ],
        {
          stdio: 'ignore', // piping all stdio to /dev/null
          detached: true,
          env: process.env
        }
      )

      const dnsMonitorPid = monitor.pid.toString()
      setDnsMonitorPid(dnsMonitorPid)
      core.debug(`dns monitor pid: ${dnsMonitorPid}`)
      monitor.on('error', (err: any) => core.debug(`dns monitor error: ${err}`))
      monitor.on('close', () => core.debug('dns monitor process exited'))
      monitor.unref()

      // Set outputs for other workflow steps to use
      core.setOutput('time', new Date().toTimeString())
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
