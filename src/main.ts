import * as core from '@actions/core'
import { wait } from './wait'
const { exec } = require('child_process')

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const ms: string = core.getInput('milliseconds')

    // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
    core.debug(`Waiting ${ms} milliseconds ...`)

    // Log the current timestamp, wait, then log the new timestamp
    core.debug(new Date().toTimeString())
    await wait(parseInt(ms, 10))
    core.debug(new Date().toTimeString())

    exec(
      'sudo dns-cgroup-monitor',
      (error: Error | null, stdout: string, stderr: string) => {
        if (error) {
          core.setFailed(`Error executing dns-cgroup-monitor: ${error.message}`)
          return
        }
        if (stderr) {
          core.warning(`dns-cgroup-monitor stderr: ${stderr}`)
        }
        core.debug(`dns-cgroup-monitor stdout: ${stdout}`)
      }
    )

    // Set outputs for other workflow steps to use
    core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
