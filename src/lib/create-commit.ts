import readFile from './read-file.js'
import { context } from '@actions/github'
import type { Octokit } from '../buildAndTagAction.js'
import { info, setFailed } from '@actions/core'

export default async function createCommit(octokit: Octokit) {
  const workspace = process.env.GITHUB_WORKSPACE

  if (!workspace) {
    throw new Error('GITHUB_WORKSPACE environment variable is not set.')
  }

  // Helper to add file to tree if it exists
  const addFileToTree = async (treeEntries: any[], filePath: string) => {
    try {
      const content = await readFile(workspace, filePath)
      treeEntries.push({
        path: filePath,
        mode: '100644',
        type: 'blob',
        content
      })
      return content
    } catch (err) {
      return null
    }
  }

  info('Creating tree')
  const treeEntries: any[] = []

  // Add action file (required - try action.yml, fall back to action.yaml)
  let actionFileContent = await addFileToTree(treeEntries, 'action.yml')
  if (!actionFileContent) {
    actionFileContent = await addFileToTree(treeEntries, 'action.yaml')
    if (!actionFileContent) {
      throw new Error(
        'Neither action.yml nor action.yaml found in the repository.'
      )
    }
  }

  // Read package.json to extract main (required)
  let packageJsonContent = ''
  let main = ''
  try {
    packageJsonContent = await readFile(workspace, 'package.json')
    main = JSON.parse(packageJsonContent).main as string
    if (!main) {
      throw new Error('Property "main" does not exist in package.json.')
    }
  } catch (err) {
    throw new Error(
      `Failed to read package.json or extract main property: ${err}`
    )
  }

  // Add dist/package.json if it exists (optional)
  await addFileToTree(treeEntries, 'dist/package.json')

  // Add main file (required)
  treeEntries.push({
    path: main,
    mode: '100644',
    type: 'blob',
    content: await readFile(workspace, main)
  })

  const tree = await octokit.rest.git.createTree({
    ...context.repo,
    tree: treeEntries
  })

  info('Tree created')

  info('Creating commit')
  const commit = await octokit.rest.git.createCommit({
    ...context.repo,
    message: 'Automatic compilation',
    tree: tree.data.sha,
    parents: [context.sha]
  })
  info('Commit created')

  return commit.data
}
