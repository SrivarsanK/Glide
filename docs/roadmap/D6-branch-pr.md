# D6: Push and open a pull request from branch mode

Status: **todo** · Size: S–M · Depends on: — · Branch: `feat/d6-branch-pr`

## Goal

Finish branch mode for people who don't use git: after committing the editor's changes, one button
pushes the branch and opens a pull request, or opens GitHub's compare page when the `gh` CLI isn't
available. Onlook 2.0 has the same flow (commit, push, PR, then follow the checks).

## Current state (verified 2026-11-28)

- **Branch mode can create a branch and commit.** In `packages/server/src/ws-server.ts`:
  - `git-branch-create` checks the name against `^[a-zA-Z0-9_/-]+$` and runs `git checkout -b`.
  - `git-branch-finalize` calls `finalizeEditorChanges()` (`editor-git.ts`). That commits, with
    `--only`, just the editor-owned changes to files that were tracked and clean, and returns the commit.
- **Nothing pushes.** The name check also lets a name start with `-`. Git refuses such names, so this
  is untidy rather than unsafe.

## Design

- **A new socket message, `git-branch-publish`.** It carries no branch name. The server reads the
  current branch with `git rev-parse --abbrev-ref HEAD` and refuses in four cases: a detached HEAD, the
  default branch (`origin/HEAD`, or `main`/`master` when that's unknown), no `origin` remote, or no
  commits ahead of the default branch.
- **Push.** `git push -u origin <branch>` from the git root, with no terminal prompts
  (`GIT_TERMINAL_PROMPT=0`), so a missing credential fails fast with git's own message.
- **Open the pull request.** When `gh` is on `PATH` and `gh auth status` succeeds, run
  `gh pr create --fill --head <branch>` and return the PR's URL. Otherwise, for a GitHub remote, return
  `https://github.com/<owner>/<repo>/compare/<branch>?expand=1`. For other hosts, return just "Pushed".
  An existing PR for the branch returns its URL instead of failing.
- **UI.** After a successful finalize, the branching dialog offers "Push and open pull request" and then
  shows the link.
- **Editor only.** This is not an MCP tool. Pushing stays a user action, and an agent can still run git
  itself if the user wants that.
- **Tidy the create check.** Refuse names that start with `-` or `/`, end with `/` or `.lock`, or
  contain `//`, so the message comes from Glide rather than from git.

## Steps

- [ ] D6a: remote parsing (`git@github.com:o/r.git`, `https://github.com/o/r(.git)`) to a compare URL
- [ ] D6b: `git-branch-publish` with its refusals, the push, then `gh` or the compare URL
- [ ] D6c: the dialog button and the result link
- [ ] D6d: the stricter branch-name check

## Tests

- Remote URL parsing for SSH, HTTPS and non-GitHub hosts.
- In a temporary repository with a bare `origin`: publish pushes the branch, refuses on the default
  branch, and refuses with no commits ahead.
- With `gh` absent, the compare URL comes back. The test gives the publisher a `gh` command that
  doesn't exist; trimming `PATH` won't do, because `git` and `gh` can share a directory.

## Done when

In branch mode, the user commits two edits and presses "Push and open pull request", and GitHub shows
a pull request with that commit.

## Out of scope

Watching CI checks and merging from the editor (Onlook does both), and hosts other than GitHub beyond
a plain push.
