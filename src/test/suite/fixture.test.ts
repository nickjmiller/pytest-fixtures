const fixtureParser = require("../../fixtureParser");
const child_process = require("child_process");

import * as vscode from "vscode";
import * as assert from "assert";
import * as proxyquire from "proxyquire";
import { after, afterEach, before, beforeEach } from "mocha";
import { createSandbox, SinonStub } from "sinon";
import { getPythonPath } from "../../fixture";
import { PythonShell } from "python-shell";

const { getFixtures } = proxyquire("../../fixture", {
    child_process,
    fixtureParser,
});

suite("Fixture Unit Test Suite", () => {
    const sandbox = createSandbox();
    const parseFixtureStub = sandbox.stub(
        fixtureParser,
        "parsePytestOutputToFixtures"
    );

    before(() => {
        const output = "output";
        sandbox.stub(child_process, "spawnSync").returns({
            status: 0,
            stdout: {
                toString: () => output,
            },
        });
    });

    after(() => {
        sandbox.restore();
    });

    suite("getFixtures", () => {
        // @ts-ignore
        const rootPath = vscode.workspace.workspaceFolders[0].uri;
        const higherPath = vscode.Uri.joinPath(rootPath, "..");
        const docPath = vscode.Uri.joinPath(higherPath, "test_fake.py");

        beforeEach(() => {
            sandbox.stub(vscode.workspace, "workspaceFolders").value([
                { uri: rootPath}, {uri: higherPath}
            ]);
        });

        afterEach(() => {
            (vscode.workspace.getConfiguration as SinonStub).restore();
        });

        test("should get fixtures", async () => {
            parseFixtureStub.returnsArg(0);
            sandbox.stub(vscode.workspace, "getConfiguration").returns({
                get: () => {
                    return false;
                },
            } as any);
            assert.strictEqual(
                await getFixtures({ uri: docPath } as any),
                "output"
            );
        });

        test("should use cwd for working directory", async () => {
            parseFixtureStub.returnsArg(1);
            sandbox.stub(vscode.workspace, "getConfiguration").returns({
                get: () => {
                    return false;
                },
            } as any);
            assert.strictEqual(
                await getFixtures({ uri: docPath } as any),
                rootPath.fsPath
            );
        });

        test("should use file directory for working directory when enabled", async () => {
            parseFixtureStub.returnsArg(1);
            sandbox.stub(vscode.workspace, "getConfiguration").returns({
                get: () => {
                    return true;
                },
            } as any);
            assert.strictEqual(
                await getFixtures({ uri: docPath } as any),
                higherPath.fsPath
            );
        });
    });

    suite("getPythonPath", () => {
        const expectedPath = "expected";
        const mockUri = <vscode.Uri>{};

        afterEach(() => {
            (vscode.extensions.getExtension as SinonStub).restore();
        });

        test("should get the python path from the python extension", async () => {
            sandbox.stub(vscode.extensions, "getExtension").returns({
                isActive: true,
                exports: {
                    settings: {
                        getExecutionDetails: () => ({
                            execCommand: [expectedPath],
                        }),
                    },
                },
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
                        }),
                    },
                },
            } as any);
            await getPythonPath(mockUri);
            assert.strictEqual(activateStub.calledOnce, true);
        });

        test("should use the default python path if the extension is not available", async () => {
            sandbox.stub(vscode.extensions, "getExtension").returns(undefined);
            assert.strictEqual(
                await getPythonPath(mockUri),
                PythonShell.defaultPythonPath
            );
        });
    });
});
