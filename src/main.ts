import {promises as fs} from 'fs';
import * as core from '@actions/core';
import {exec} from '@actions/exec';

async function isFile(p: string): Promise<boolean> {
  return fs.stat(p).then(
    (s) => s.isFile(),
    () => false
  );
}

const fixUrl = (url: string): string =>
  `//${url.replace(/^\/*/, '').replace(/\/*$/, '')}/`;

async function run(): Promise<void> {
  const isMonorepo = core.getInput('monorepo').toString() === 'true';

  const npmUrl = core.getInput('npmurl');
  if (!npmUrl) {
    core.setFailed("'npmurl' must be set");
    return;
  }

  const npmToken = core.getInput('token');

  if (!npmToken) {
    core.setFailed("'token' input not set");
    return;
  }

  const fixedNpmUrl = fixUrl(npmUrl);

  await fs.writeFile(
    '.npmrc',
    `registry=https://registry.npmjs.org/\n@tv4:registry=https:${fixedNpmUrl}\n${fixedNpmUrl}:_authToken=${npmToken}`
  );

  /* ensure access to GPR */
  await exec(`npm whoami --registry https:${fixedNpmUrl}`);

  if (await isFile('package-lock.json')) {
    await exec('npm ci');
  } else {
    await exec('npm install');
  }

  if (isMonorepo) {
    const lernaConfig = JSON.parse((await fs.readFile('lerna.json')).toString());
    const {npmClient = 'npm'} = lernaConfig;
    if (npmClient !== 'yarn') {
      await exec('./node_modules/.bin/lerna bootstrap');
    }
    await exec('./node_modules/.bin/lerna exec -- eval "[ -f release.config.js ] && ../../node_modules/.bin/semantic-release"');
  } else {
    await exec('[ -f release.config.js ] && ./node_modules/.bin/semantic-release');
  }

  await exec('git push origin --tags');
}

run().catch((error) => {
  console.error('Action failed', error);
  core.setFailed(error.message);
});
