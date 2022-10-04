import * as path from "path";
import { spawnSync } from "child_process";
import { PythonShell } from "python-shell";
import { runTests } from "vscode-test";

async function checkPyTestIsInstalled() {
    const response = spawnSync(PythonShell.defaultPythonPath, ["-m", "pytest"]);
    if (response.status !== 0) {
        console.log("########################################################################################");
        console.log(`Error checking pytest : ${response.stderr}`);
        console.error("The tests will not be run. Please install pytest in your system first.");
        process.exit(1);
    }
}

async function main() {
    await checkPyTestIsInstalled();
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, "../../");

        // The path to test runner
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, "./suite/index");
        const testWorkspace = path.resolve(__dirname, "../../test-fixture");

        // Download VS Code, unzip it and run the integration test
        await runTests({ extensionDevelopmentPath, extensionTestsPath, launchArgs: [testWorkspace, "--disable-extensions"] });
    } catch (err) {
        console.error("Failed to run tests");
        process.exit(1);
    }
}

main();
