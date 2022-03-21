const fixtureParser = require("../../fixtureParser");
const child_process = require("child_process");

import * as vscode from "vscode";
import * as assert from "assert";
import { createSandbox, SinonStub} from "sinon";
import { getPythonPath } from "../../fixture";
import { PythonShell } from "python-shell";



suite("Fixture Unit Test Suite", () => {
    const sandbox = createSandbox();

    suiteSetup(() => {
        const output = "output";
        sandbox.stub(fixtureParser, "parsePytestOutputToFixtures");
        sandbox.stub(child_process, "spawnSync").returns(output);
    });

    suiteTeardown(() => {
        sandbox.restore();
    });

    suite("getPythonPath", () => {
        const expectedPath = "expected";
        const mockUri = <vscode.Uri>{};

        teardown(() => {
            (vscode.extensions.getExtension as SinonStub).restore();
        });
        
        test("should get the python path from the python extension", async () => {
            sandbox.stub(vscode.extensions, "getExtension").returns({
                isActive: true,
                exports: {
                    settings: {
                        getExecutionDetails: () => ({
                            execCommand: [expectedPath],
                        })
                    }
                }
            } as any);
            assert.strictEqual(await getPythonPath(mockUri), expectedPath);
        });

        test("should activate the python extension if not activated", async () => {
            const activateStub = sandbox.stub();
            sandbox.stub(vscode.extensions, "getExtension").returns({
                activate: activateStub,
                isActive: false,
                exports: {
                    settings: {
                        getExecutionDetails: () => ({
                            execCommand: [expectedPath],
                        })
                    }
                }
            } as any);
            await getPythonPath(mockUri);
            assert.strictEqual(activateStub.calledOnce, true);
        });

        test("should use the default python path if the extension is not available", async () => {
            sandbox.stub(vscode.extensions, "getExtension").returns(undefined);
            assert.strictEqual(await getPythonPath(mockUri), PythonShell.defaultPythonPath);
        });

    });
});
