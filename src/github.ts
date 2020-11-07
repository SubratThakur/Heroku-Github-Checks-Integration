import { request } from '@octokit/request'
// eslint-disable-next-line no-unused-vars
import { Context } from 'probot'

/**
 * Fetch list of Pull request related to commit
 * @param owner
 * @param repo
 * @param commitSha
 */
async function getPullRequestRelatedToCommit (
  owner: string,
  repo: string,
  // eslint-disable-next-line camelcase
  commitSha: string
) {
  const pullRelatedToRef = await request(
    'Get /repos/:owner/:repo/commits/:commit_sha/pulls',
    {
      headers: {
        Accept: 'application/vnd.github.groot-preview+json',
        authorization: 'token ' + process.env.TOKEN
      },
      owner: owner,
      repo: repo,
      commit_sha: commitSha
    }
  )
  return pullRelatedToRef
}

function determineCheckConclusion (buildFailureDetails: any) {
  if (buildFailureDetails[0].error_count > 0 || buildFailureDetails[0].state === 'error' || buildFailureDetails[0].state === 'failure') {
    return 'failure'
  } else if (buildFailureDetails[0].state === '') {
    return 'cancelled'
  }
  return 'success'
}

function determineCheckSummary (msg: string) {
  return {
    title: 'Salesforcedocs Validation Report!',
    summary: msg,
    annotations: []
  }
}

async function updateCheck (params: any, context: Context) {
  console.log('Updating Checks')
  try {
    await context.github.checks.update(params)
  } catch (e) {
    console.log('Github Update fail!')
    console.log(e)
  }
}

async function createCheck (params: any, context: Context) {
  console.log('Creating Checks')
  try {
    await context.github.checks.create(params)
  } catch (e) {
    console.log('Github Checks fail!')
    console.log(e)
  }
}

async function getCheckListForCommit (ref: string, context: Context) {
  console.log('Get List of Checks')
  return await context.github.checks.listForRef({
    owner: context.repo().owner,
    repo: context.repo().repo,
    ref: ref
  })
}

async function updateChecksOnCommit (
  commitSha: string,
  buildFailureDetails: any,
  context: any,
  msg: string
) {
  let checkUpdated = false
  const createCheckParams = {
    name: commitSha,
    owner: context.repo().owner,
    repo: context.repo().repo,
    head_sha: commitSha,
    check_run_id: 0,
    conclusion: determineCheckConclusion(buildFailureDetails[0]),
    status: 'completed',
    completed_at: new Date().toISOString(),
    details_url: buildFailureDetails[0].url,
    output: determineCheckSummary(msg),
    actions: []
  }
  const checkRunList = await getCheckListForCommit(commitSha, context)
  if (checkRunList.data.total_count > 0) {
    checkRunList.data.check_runs.forEach(async (check: any) => {
      if (check.status === 'in_progress') {
        createCheckParams.check_run_id = check.id
        checkUpdated = true
        await updateCheck(createCheckParams, context)
      }
    })
  } else if (!checkUpdated) {
    await createCheck(createCheckParams, context)
  }
}

/**
 * Fetch pull request detail using PR number
 * @param prNumber
 * @param context
 */
async function fetchPullRequestDetails (prNumber: number, context: any) {
  if (prNumber > 0) {
    const pullRequest = await context.github.pulls.get({
      owner: context.repo().owner,
      repo: context.repo().repo,
      pull_number: prNumber
    })

    return pullRequest
  } else {
    throw new Error('Pull request number cannot be blank')
  }
}

/**
 * This is a helper method which fetch details and post comment on github PR
 * 1) Fetch Pull requests for commit
 * 2) Iterate over PR and post build message to it
 * @param context
 * @param users
 * @param commitSha
 * @param buildFailureDetails
 */
async function postBuildValidationLogsDetailsOnPR (
  context: any,
  commitowner: string,
  commitSha: string,
  buildFailureDetails: any
) {
  console.log(commitSha)
  const owner = context.repo().owner
  const repo = context.repo().repo
  let msg = ''
  let prOwner
  const pullRelatedToRef = await getPullRequestRelatedToCommit(
    owner,
    repo,
    commitSha
  ) // pr.user.login //Collecting Details of the person who created the PR

  pullRelatedToRef.data.forEach(async (pr: any) => {
    const prNumber = pr.number
    if (prNumber > 0) {
      // fetch pr based on pull request number
      const pullRequest = await fetchPullRequestDetails(prNumber, context)
      prOwner = pullRequest.data.user.login // Collecting Details of the person who created the PR
      // Combine the commit author and PR Owner
      if (commitowner.length > 0 && prOwner !== commitowner) {
        prOwner = [prOwner, commitowner]
      } else {
        prOwner = [prOwner]
      }
    }
  })
  msg = buildFailureDetails[0].logs
  console.log('Message to post ' + msg)
  // Post comment on pull request.
  await updateChecksOnCommit(commitSha, buildFailureDetails, context, msg)
  console.log('Build logs post success!')
}

export {
  postBuildValidationLogsDetailsOnPR
}
