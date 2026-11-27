---
applyTo: ".github/workflows/**/*.{yml,yaml}"
---

# GitHub Actions workflow review checklist

From the `github_workflows` rules of [alibaba/open-code-review](https://github.com/alibaba/open-code-review) v1.14.4 (Apache-2.0), lightly edited.

## Security
- **`pull_request_target` misuse:** checking out the PR head under `pull_request_target` runs untrusted code with write permissions.
- **Secrets in logs:** secrets must never be printed (for example `echo ${{ secrets.X }}`); pass them through `env:` only to the steps that need them.
- **Permissions:** each workflow or job declares least-privilege `permissions`. Flag `write-all` or a missing `permissions` key.
- **Unpinned actions:** third-party actions are pinned to a full commit SHA, not a tag. First-party `actions/*` on a major tag such as `v4` is acceptable.
- **Script injection:** expressions such as `${{ github.event.issue.title }}` must not be used directly in `run:`; pass them through an environment variable.
- **Hard-coded credentials:** tokens, passwords or keys written into the workflow instead of using secrets.

## Correctness
- **History:** jobs that need git history (tags, merge-base, changelogs) check out with `fetch-depth: 0`.
- **Conditions:** `if:` expressions test the right event and values, with strings quoted.
- **Matrix:** the matrix covers the platforms that matter, and `fail-fast` matches whether every leg must pass.
- **Dependencies:** every `needs:` names an existing job, with no cycles.
- **Input typos:** misspelled action inputs (`fetch-detph`) are silently ignored.

## Reliability
- Jobs have `timeout-minutes`.
- Push- and PR-triggered workflows use a `concurrency` group with `cancel-in-progress` where duplicate runs are wasteful.
- Dependency installs use caching.

## Best practices
- No deprecated syntax (`set-output`, `save-state`, `actions/checkout@v2` or `v3`).
- `continue-on-error: true` only where a failing step really should not fail the job, and no `|| true` hiding real errors.
- Container images use a specific tag, not `latest`.
