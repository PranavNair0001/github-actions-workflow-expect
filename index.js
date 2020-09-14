const core = require('@actions/core');
const {context} = require('@actions/github');
const {Octokit} = require("@octokit/rest");

const STATUS_IN_PROGRESS = 'in_progress';
const STATUS_NO_WORK = 'no_work';
const STATUS_SUCCESS = 'success';
const STATUS_ERROR = 'error';

try {
    const waitInterval = core.getInput('wait-interval');
    const waitMax = core.getInput('wait-max');
    const ref = core.getInput('ref', {required: false}) || context.sha;
    const token = core.getInput('repo-token');
    let breakIfNoWork = false;
    switch (core.getInput('no-work-break').toLowerCase().trim()) {
        case "true": case "yes": case "1": breakIfNoWork = true;
    }

    const octokit = new Octokit({auth: token});
    const {owner, repo} = context.repo;

    const queryCheckWorkflows = async function () {
        const {data: response} = await octokit.checks.listForRef({owner, repo, ref});
        if (response.total_count === 1) {
            return [STATUS_NO_WORK, null];
        }
        let status = STATUS_SUCCESS;
        let objectWating = null;
        response.check_runs.forEach(checkRun => {
            if (checkRun.name !== context.job) {
                objectWating = checkRun.name;
                if (checkRun.status === 'in_progress' || checkRun.status === 'queued') {
                    status = STATUS_IN_PROGRESS;
                }
                if (['failure', 'cancelled', 'timed_out'].includes(checkRun.conclusion)) {
                    status = STATUS_ERROR;
                    objectWating = checkRun.name;
                }
            }
        })
        return [status, objectWating];
    };

    const sleep = async function (seconds) {
        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
    };

    (async () => {
        try {
            console.log(`Starting checks for: ${owner} / ${repo} / ${ref}`);
            let executedTime = 0;
            let result = '';
            let object = null;
            while (result !== STATUS_SUCCESS) {
                [result, object] = await queryCheckWorkflows();
                if (result === STATUS_NO_WORK) {
                    if (breakIfNoWork === true) {
                        core.setFailed(`There aren't checks for this ref, exiting...`);
                    } else {
                        console.log(`There aren't checks for this ref, pass...`)
                    }
                    break;
                }
                if (executedTime > waitMax) {
                    core.setFailed('Time exceed max limit (' + waitMax + '), stopping...');
                    break;
                }
                console.log(`Workflow ${object} still in progress, will check for ${waitInterval} seconds...`);
                await sleep(waitInterval);
                executedTime += waitInterval;
            }
            if (result === STATUS_SUCCESS) {
                console.log('All checks were passed.');
            }
        } catch (error) {
            core.setFailed(error.message);
        }
    })();
} catch (error) {
    core.setFailed(error.message);
}
