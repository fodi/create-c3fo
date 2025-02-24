#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { capitalCase, kebabCase, pascalCase } from 'change-case';
import fs from 'fs-extra';
import path from 'node:path';
import { fetchGithub } from './github.js';

const program = new Command();

function isGitInstalled() {
    try {
        execSync('git --version');
        return true;
    } catch {
        return false;
    }
}

function isYarnInstalled() {
    try {
        execSync('yarn --version');
        return true;
    } catch {
        return false;
    }
}

program
    .argument('[project-name]', 'Name of the new project')
    .action(async (projectName) => {
        if (!projectName) {
            const nameOpts = await inquirer.prompt([
                { name: 'projectName', message: 'Enter project name:', type: 'input' }
            ]);

            projectName = nameOpts.projectName.trim();
        }

        const opts = await inquirer.prompt([
            { name: 'author', message: 'Enter author name:', type: 'input', default: 'Anonymous' },
            { name: 'description', message: 'Enter addon description:', type: 'input', default: 'Addon for Construct 3' },
            {
                name: 'type',
                message: 'Addon type:',
                type: 'select',
                default: 'behavior',
                choices: [
                    {
                        name: 'Behavior',
                        value: 'behavior',
                    },
                    {
                        name: 'Plugin',
                        value: 'plugin'
                    },
                    {
                        name: 'Theme',
                        value: 'theme',
                    },
                ]
            },
        ]);

        // Trim everything
        for (const key in opts) {
            opts[key] = opts[key].trim();
        }

        const isAnonymous = opts.author === 'Anonymous';
        const isTheme = opts.type === 'theme';

        const kebabName = kebabCase(projectName);
        const titleName = capitalCase(projectName);
        const pascalName = pascalCase(projectName);

        const pascalAuthor = pascalCase(opts.author);
        const titleAuthor = capitalCase(opts.author);

        const projectPath = path.join(process.cwd(), projectName);

        if (fs.existsSync(projectPath) && fs.readdirSync(projectPath).length > 0) {
            console.error(chalk.red(`Error: Directory "${projectName}" is not empty.`));
            process.exit(1);
        }

        fs.mkdirSync(projectPath, { recursive: true });

        try {
            await fetchGithub(projectPath, isTheme);

            process.chdir(projectPath); // cd to project

            // Remove package-lock.json
            const packageLockPath = path.join(projectPath, 'package-lock.json');
            if (fs.existsSync(packageLockPath)) {
                fs.removeSync(packageLockPath);
            }

            // Detect package manager
            let packageManager = 'npm';

            if (isYarnInstalled()) {
                packageManager = 'yarn';
                console.log(chalk.blue('Yarn package manager detected...'));
            }

            console.log(chalk.blue(`Installing dependencies using ${packageManager}...`));
            execSync(`${packageManager} install`, { stdio: 'inherit' });


            // Update package.json
            const packageJsonPath = path.join(projectPath, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = fs.readJsonSync(packageJsonPath);
                packageJson.name = kebabName;
                fs.writeJsonSync(packageJsonPath, packageJson, { spaces: 2 });
            }

            // Update addon.ts
            const addonTsPath = path.join(projectPath, 'src/addon.ts');
            if (fs.existsSync(addonTsPath)) {
                let addonTs = fs.readFileSync(addonTsPath, { encoding: 'utf-8' });
                addonTs = addonTs.replace('id: "ExampleAddon"', `id: "${isAnonymous ? pascalName : pascalAuthor + '_' + pascalName}"`);
                addonTs = addonTs.replace('name: "Example Addon"', `name: "${titleName}"`);
                addonTs = addonTs.replace('description: "Description"', `description: "${opts.description}"`);

                if (!isAnonymous) {
                    addonTs = addonTs.replace('author: "Author"', `author: "${titleAuthor}"`);
                    addonTs = addonTs.replace('githubUrl: "https://github.com/"', `githubUrl: "https://github.com/${opts.author}/${projectName}"`);
                }

                if (!isTheme) {
                    addonTs = addonTs.replace('addonType: "behavior"', `addonType: "${opts.type}"`);

                    if (opts.type === 'plugin') {
                        addonTs = addonTs.replace(': BehaviorConfig', ': PluginConfig');
                        addonTs = addonTs.replace('// type: "object"', 'type: "object"');
                    }
                }

                fs.writeFileSync(addonTsPath, addonTs);
            }

            // Update instance.ts
            if (!isTheme) {
                const instanceTsPath = path.join(projectPath, 'src/instance.ts');
                if (fs.existsSync(instanceTsPath)) {
                    let instanceTs = fs.readFileSync(instanceTsPath, { encoding: 'utf-8' });
                    instanceTs = instanceTs.replace(/\/\/\s*class.*\n/, '');

                    if (opts.type === 'plugin') {
                        instanceTs = instanceTs.replace(
                            'class Instance extends Behavior.Instance<IWorldInstance>(Config) {',
                            'class Instance extends Plugin.Instance(Config, globalThis.ISDKInstanceBase) {'
                        );
                    }

                    fs.writeFileSync(instanceTsPath, instanceTs);
                }
            }

            // Initialize Git 
            if (isGitInstalled()) {
                console.log(chalk.blue('Initializing Git repository...'));
                execSync('git init', { cwd: projectPath, stdio: 'inherit' });
            }

            console.log(chalk.green.bold('\nYou can start using C3FO 🤖!'));
            console.log(chalk.gray.underline('\ncd ' + projectPath));

            console.log(chalk.magentaBright(`\nSponsor us ❤ ${chalk.underline('https://github.com/sponsors/LuanHimmlisch')}\n`));
        } catch (error) {
            spinner.fail('Failed to clone the template.');
            console.error(chalk.red(error.message));
            process.exit(1);
        }
    });

program.parse(process.argv);
