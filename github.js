import ora from "ora";
import path from 'node:path';
import fs from 'fs-extra';
import https from 'https';
import { x as tarExtract } from 'tar';

const REPO_USER = 'C3Framework';
const NORMAL_REPO_NAME = 'framework';
const THEME_REPO_NAME = 'template-theme';
const BRANCH = 'master';

export async function fetchGithub(destination, isTheme = false) {
    return new Promise((resolve, reject) => {
        const url = `https://codeload.github.com/${REPO_USER}/${isTheme ? THEME_REPO_NAME : NORMAL_REPO_NAME}/tar.gz/${BRANCH}`;
        const tempFile = path.join(destination, 'repo.tar.gz');

        const spinner = ora('Downloading template...').start();
        const file = fs.createWriteStream(tempFile);

        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', async () => {
                file.close();
                spinner.succeed('Download complete. Extracting files...');

                try {
                    await tarExtract({
                        file: tempFile,
                        cwd: destination,
                        strip: 1, // Remove top-level folder
                    });

                    fs.removeSync(tempFile);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', (err) => {
            fs.unlinkSync(tempFile);
            reject(err);
        });
    });
}