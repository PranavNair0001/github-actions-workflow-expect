# Workflow expectant

This action waits on other workflows for selected git-ref to complete. Used for typical task - made some work ONLY after all tests/checks are completed.

## Inputs

### `wait-interval`

**Required** Seconds to wait (sleep) between checks.

### `wait-max`

**Required** Max seconds to wait. After this time workflow exited with error.

### `repo-token`

**Required** Token for github-api calls.

### `ref`

**Optional** A git ref to be checked: branch/tag/commit sha. Defaults - current commit of started workflow


### `no-work-break`

**Optional** Break execution if no runned workflows


## Example usage
```yaml
uses: ScrumWorks/github-actions-workflow-expect@v1
with:
    wait-interval: 10 # seconds
    wait-max: 1800 # seconds
    repo-token: ${{ secrets.GITHUB_TOKEN }}
```