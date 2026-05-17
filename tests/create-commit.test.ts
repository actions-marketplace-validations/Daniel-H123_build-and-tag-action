import { describe, it, beforeEach, expect, vi } from 'vitest'
import createCommit from '../src/lib/create-commit.js'
import type { Octokit } from '../src/buildAndTagAction.js'
import * as github from '@actions/github'

vi.mock('@actions/github', async () => {
  const actual = await vi.importActual('@actions/github')
  return {
    ...actual,
    context: {
      repo: { owner: 'JasonEtco', repo: 'test' },
      sha: '123abc'
    },
    getOctokit: vi.fn()
  }
})

describe('create-commit', () => {
  let octokit: Octokit
  let treeParams: any
  let commitParams: any

  beforeEach(() => {
    vi.clearAllMocks()

    octokit = {
      rest: {
        git: {
          createTree: vi.fn(async (params) => {
            treeParams = params
            return { data: { sha: 'tree123' } }
          }),
          createCommit: vi.fn(async (params) => {
            commitParams = params
            return { data: { sha: 'commit123' } }
          })
        }
      }
    } as unknown as Octokit

    const mockGetOctokit = vi.mocked(github.getOctokit)
    mockGetOctokit.mockReturnValue(octokit)

    process.env.GITHUB_WORKSPACE = 'tests/fixtures/workspace'
  })

  it('creates the tree and commit', async () => {
    await createCommit(octokit)

    expect(octokit.rest.git.createTree).toHaveBeenCalled()
    expect(octokit.rest.git.createCommit).toHaveBeenCalled()

    // Test that our tree was created correctly
    expect(treeParams.tree).toHaveLength(2)
    expect(treeParams.tree.some((obj: any) => obj.path === 'index.js')).toBe(
      true
    )

    // Test that our commit was created correctly
    expect(commitParams.message).toBe('Automatic compilation')
    expect(commitParams.parents).toEqual(['123abc'])
  })

  it('throws when action.yml and action.yaml are not defined', async () => {
    process.env.GITHUB_WORKSPACE = 'tests/fixtures'

    await expect(createCommit(octokit)).rejects.toThrow(
      'Neither action.yml nor action.yaml found in the repository.'
    )
  })

  it('throws when GITHUB_WORKSPACE is not set', async () => {
    delete process.env.GITHUB_WORKSPACE

    await expect(createCommit(octokit)).rejects.toThrow(
      'GITHUB_WORKSPACE environment variable is not set.'
    )
  })
})
