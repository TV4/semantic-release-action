"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const core = __importStar(require("@actions/core"));
const exec_1 = require("@actions/exec");
function isFile(p) {
    return __awaiter(this, void 0, void 0, function* () {
        return fs_1.promises.stat(p).then((s) => s.isFile(), () => false);
    });
}
const fixUrl = (url) => `//${url.replace(/^\/*/, '').replace(/\/*$/, '')}/`;
function run() {
    return __awaiter(this, void 0, void 0, function* () {
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
        const lernaConfig = JSON.parse((yield fs_1.promises.readFile('lerna.json')).toString());
        const { npmClient = 'npm' } = lernaConfig;
        const fixedNpmUrl = fixUrl(npmUrl);
        yield fs_1.promises.writeFile('.npmrc', `registry=https://registry.npmjs.org/\n@tv4:registry=https:${fixedNpmUrl}\n${fixedNpmUrl}:_authToken=${npmToken}`);
        /* ensure access to GPR */
        yield exec_1.exec(`npm whoami --registry https:${fixedNpmUrl}`);
        if (yield isFile('package-lock.json')) {
            yield exec_1.exec('npm ci');
        }
        else {
            yield exec_1.exec('npm install');
        }
        if (isMonorepo) {
            if (npmClient !== 'yarn') {
                yield exec_1.exec('lerna bootstrap');
            }
            yield exec_1.exec('lerna exec -- [ -f release.config.js ] && ../../node_modules/.bin/semantic-release');
        }
        else {
            yield exec_1.exec('[ -f release.config.js ] && semantic-release');
        }
        yield exec_1.exec('git push origin --tags');
    });
}
run().catch((error) => {
    console.error('Action failed', error);
    core.setFailed(error.message);
});
