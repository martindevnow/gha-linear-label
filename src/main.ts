import * as core from '@actions/core'
import { LinearClient } from '@linear/sdk'
/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // This is the main function that will be executed when the action is run.
    const apiKey = core.getInput('linear-api-key')
    const linearClient = new LinearClient({ apiKey })

    // Get all issues with the existing label
    const existingLabelName = core.getInput('existing-label')
    console.log(
      `Getting issues with the existing label: ${existingLabelName}...`
    )
    const issues = await linearClient.issues({
      filter: {
        labels: { name: { eq: existingLabelName } }
      }
    })
    console.log(
      `Found ${issues.nodes.length} issues with the label ${core.getInput('existing-label')}`
    )

    if (issues.nodes.length === 0) {
      console.log(
        `No issues found with the label ${core.getInput('existing-label')}`
      )
      core.setFailed(
        `No issues found with the label ${core.getInput('existing-label')}`
      )
      throw new Error(
        `No issues found with the label ${core.getInput('existing-label')}`
      )
    }

    // Check if the new label already exists
    const newLabelName = core.getInput('linear-label')
    console.log(`Checking if the new label exists: ${newLabelName}...`)
    let newLabelId = null

    const newLabel = await linearClient.issueLabels({
      filter: {
        name: { eq: newLabelName }
      }
    })

    if (newLabel.nodes.length === 0) {
      // Create the new label if it doesn't exist
      console.log(`Creating the new label: ${newLabelName}...`)
      const createLabel = await linearClient.createIssueLabel({
        name: newLabelName,
        color: '#FF0000' // TODO: Specify a default color
      })
      console.log(`New label ${newLabelName} created successfully.`)
      newLabelId = (await createLabel.issueLabel)?.id || 'FAILED'
      console.log(`New label ID: ${newLabelId}`)
    } else {
      console.log(`The new label ${newLabelName} already exists.`)
      newLabelId = newLabel.nodes[0].id
      console.log(`Existing label ID: ${newLabelId}`)
    }

    // Add the new label to the issues
    console.log(`Adding the new label to the issues...`)
    for (const issue of issues.nodes) {
      await issue.update({
        addedLabelIds: [newLabelId]
      })
    }

    // Remove the old label (if requested)
    const shouldRemoveOldLabel = core.getInput('remove-old-label') === 'true'
    console.log(`Should remove the old label: ${shouldRemoveOldLabel}`)

    if (shouldRemoveOldLabel) {
      console.log(`Removing the old label from the issues...`)
      // get ID of existing label
      const existingLabel = await linearClient.issueLabels({
        filter: {
          name: { eq: existingLabelName }
        }
      })
      if (existingLabel.nodes.length === 0) {
        console.log(`Existing label ${existingLabelName} not found.`)
        core.setFailed(`Existing label ${existingLabelName} not found.`)
      }
      const existingLabelId = existingLabel.nodes[0].id
      console.log(`Existing label ID: ${existingLabelId}`)

      // remove the existing label from the issues
      for (const issue of issues.nodes) {
        await issue.update({
          removedLabelIds: [existingLabelId]
        })
      }
    }
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
