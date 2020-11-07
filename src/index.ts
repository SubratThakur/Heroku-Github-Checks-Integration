import { Application } from 'probot' // eslint-disable-line no-unused-vars
import { getHerokuTestResult } from './herokuUtils'
import { postBuildValidationLogsDetailsOnPR } from './github'

const HEROKU_CI_NAME = 'continuous-integration/heroku'

export = (app: Application) => {
  app.on('status', async (context) => {
    console.log(
      context.payload.description + ' : ' + context.payload.state + '!'
    )
    console.log(context.payload.name)

    const buildFailureDetails: any = { msg: '', state: ''}
    if (
      context.payload.state === 'failure' ||
        context.payload.state === 'error' ||
        context.payload.state === 'success'
    ) {
      if (context.payload.target_url) {
        if (context.payload.context === HEROKU_CI_NAME) {
          buildFailureDetails.msg = await getHerokuTestResult(
            context.payload.target_url
          )
          buildFailureDetails.state = context.payload.state

          const users = context.payload.commit.author.login
          console.log(users[0])
          await postBuildValidationLogsDetailsOnPR(
            context,
            users,
            context.payload.commit.sha,
            buildFailureDetails
          )
        }
      }
    } else if (context.payload.state === 'pending') {
      const createCheckParams = {
        name: context.payload.commit.sha,
        owner: context.repo().owner,
        repo: context.repo().repo,
        head_sha: context.payload.commit.sha,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        output: {
          title: 'Heroku CI Report!',
          summary: `Please wait ! Heroku CI is validating the content. This space will be updated soon with report! \n > You can check live status here : [Heroku CI](${context.payload.target_url})`
        }
      }
      // @ts-ignore
      await context.github.checks.create(createCheckParams)
    }
  })
}
