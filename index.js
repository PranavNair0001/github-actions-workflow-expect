const core = require('@actions/core');
const {context} = require('@actions/github');
const {Octokit} = require("@octokit/rest");

const STATUS_IN_PROGRESS = 'in_progress';
const STATUS_NO_WORK = 'no_work';
const STATUS_SUCCESS = 'success';
const STATUS_ERROR = 'error';

try {
    const waitInterval = parseInt(core.getInput('wait-interval'));
    const waitMax = parseInt(core.getInput('wait-max'));
    const ref = core.getInput('ref', {required: false}) || context.sha;
    const workflow = core.getInput('workflow');
    const token = core.getInput('repo-token');
    let breakIfNoWork = false;
    const BreakException = {};
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
        let jobName = null;
        try {
            response.check_runs.forEach(checkRun => {
                if (checkRun.name === workflow) {
                    if (checkRun.name !== context.job) {
                        if (checkRun.status === 'in_progress' || checkRun.status
                            === 'queued') {
                            jobName = checkRun.name;
                            status = STATUS_IN_PROGRESS;
                            throw BreakException;
                        }
                        if (['failure', 'cancelled', 'timed_out'].includes(
                            checkRun.conclusion)) {
                            jobName = checkRun.name;
                            status = STATUS_ERROR;
                            throw BreakException;
                        }
                    }
                }
            })
        } catch (e) {
            if (e !== BreakException) throw e;
        }

        return [status, jobName];
    };

    const sleep = async function (seconds) {
        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
    };

    (async () => {
        try {
            console.log(`Starting checks for: ${owner} / ${repo} / ${ref}. Every ${waitInterval}s. out of ${waitMax}s.`);
            let executedTime = 0;
            let result = '';
            let jobName = null;
            while (result !== STATUS_SUCCESS) {
                [result, jobName] = await queryCheckWorkflows();
                if (result === STATUS_NO_WORK) {
                    if (breakIfNoWork === true) {
                        core.setFailed(`There aren't checks for this ref, exiting...`);
                    } else {
                        console.log(`There aren't checks for this ref, pass...`)
                    }
                    break;
                } else if (result === STATUS_ERROR) {
                    core.setFailed(`Workflow ${jobName} ended with error, exiting...`);
                    break;
                } else if (result === STATUS_SUCCESS) {
                    break;
                }
                if (executedTime > waitMax) {
                    core.setFailed('Time exceed max limit (' + waitMax + '), stopping...');
                    break;
                }
                console.log(`Workflow ${jobName} still in progress (${executedTime}s.), will check for ${waitInterval} seconds...`);
                await sleep(waitInterval);
                executedTime += waitInterval;
            }
            console.log('All checks were passed.');
        } catch (error) {
            core.setFailed(error.message);
        }
    })();
} catch (error) {
    core.setFailed(error.message);
}
