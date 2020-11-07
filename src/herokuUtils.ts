const fetch = require('node-fetch')
const Heroku = require('heroku-client')

const heroku = new Heroku({ token: process.env.HERKO_AUTH_TOKEN })
const BUILD_ERROR_DURING_SETUP = 'Error compiling buildpack'

const BUILD_ERROR_DURING_TEST =
  "Error while executing buildpack 'bin/test' script"

async function getBuildDetails (url: string) {
  try {
    const response = await fetch(url)
    const resp = await response.text()
    return resp
  } catch (error) {
    console.log(error)
  }
}

/**
 * Fetch heroku CI logs based on failure stage
 * @param context
 * @returns testFailureLogs
 */
async function getHerokuTestResult (herokuUrl: any) {
  console.log('Heroku URL : ' + herokuUrl)
  let buildLog : string
  const url = getHerokuAPIUrl(herokuUrl, 'tests', 'test-runs')
  console.log('Heroku API URL : ' + herokuUrl)
  const testDetailForPipeline = await getTestRunDetailBasedonPipeline(url)
  const testResult = await getTestRunDataBasedOnId(testDetailForPipeline.id)
  // When build failed during pre test stage
  console.log(testResult[0].message)
  if (BUILD_ERROR_DURING_SETUP === testResult[0].message) {
    console.log('Build failed during test setup')
    buildLog = await getBuildDetails(testResult[0].setup_stream_url)
  } else if (BUILD_ERROR_DURING_TEST === testResult[0].message) {
    // When test failed during test stage
    console.log('Build failed during test run')
    buildLog = await getBuildDetails(testResult[0].output_stream_url)
  } else {
    console.log('Build success!')
    buildLog = await getBuildDetails(testResult[0].output_stream_url)
  }
  return buildLog
}

function getHerokuAPIUrl (targetUrl: string, key: string, replaceKey: string) {
  return targetUrl
    .replace('https://dashboard.heroku.com', '')
    .replace(key, replaceKey)
}

/**
 * Fetch test details based on pipeline id and test number
 * @param url
 */
async function getTestRunDetailBasedonPipeline (url: string) {
  const result = await getHerokuURL(url)
  return result
}

/**
 * Fetch test nodes output based on test id
 * @param testId
 */
async function getTestRunDataBasedOnId (testId: string) {
  const url = `/test-runs/${testId}/test-nodes`
  const result = await getHerokuURL(url)
  return result
}

/**
 *Call get method on URL
 * @param url
 */
async function getHerokuURL (url: string) {
  const result = await heroku.get(url)
  return result
}

export { getHerokuTestResult }
