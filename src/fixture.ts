import { spawnSync } from "child_process";
import { dirname } from "path";
import { PythonShell } from "python-shell";
import * as vscode from "vscode";
import { parsePytestOutputToFixtures } from "./fixtureParser";
import { log } from "./logging";


export const getPythonPath = async (resource: vscode.Uri) => {
    const extension = vscode.extensions.getExtension("ms-python.python");
    if (!extension) {
        return PythonShell.defaultPythonPath;
    }
    if (!extension.isActive) {
        await extension.activate();
    }
    const pythonPath = extension.exports.settings.getExecutionDetails(resource).execCommand;
    if (!pythonPath) {
        return PythonShell.defaultPythonPath;
    }
    return pythonPath[0];
};

/**
 * Pytest provides different fixtures for different files, based on
 * hierarchy and context. We use the current python interpreter to
 * call pytest --fixtures for each file and record the responses.
 * 
 * @param document
 * @returns list of fixtures prepared for the file
 */
export const getFixtures = async (document: vscode.TextDocument) => {
    let response;
    let args = ["--color", "no", "--fixtures", "-v", document.uri.fsPath];
    const extraArgs: [string] | undefined  = vscode.workspace
        .getConfiguration("pytest-fixtures", document.uri)
        .get("extraArguments");

    if (extraArgs && extraArgs.length) {
        args = args.concat(args, extraArgs);
    }
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || dirname(document.uri.fsPath);
    const pytestPath: string = vscode.workspace
        .getConfiguration("python.testing", document.uri)
        .get("pytestPath") || "pytest";
    if (pytestPath === "pytest") {
        const pythonPath: string = await getPythonPath(document.uri);

        log(`Running command ${pythonPath} -m pytest ${args.join(" ")} in directory ${cwd}`);
        response = spawnSync(pythonPath, ["-m", "pytest", ...args], { cwd });
    } else {
        log(`Running command ${pytestPath} -m pytest ${args.join(" ")} in directory ${cwd}`);
        response = spawnSync(pytestPath, args, { shell: true, cwd });
    }
    
    if(response.status !== 0) {
        log(`Error running pytest: ${response.stderr}`);
        return [];
    }
    return parsePytestOutputToFixtures(response.stdout.toString(), cwd);
};
