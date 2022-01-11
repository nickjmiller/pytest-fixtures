import * as assert from "assert";
import { after, before, beforeEach } from "mocha";
import * as path from "path";
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from "vscode";
import { PytestFixtureProvider } from "../../suggestionProvider";
import { closeAllEditors } from "./helpers";

interface IExport {
    provider: PytestFixtureProvider
}


suite("Extension Unit Test Suite", () => {
    let extension: vscode.Extension<IExport>;
    let provider: PytestFixtureProvider;

    before(async () => {
        await closeAllEditors();
        // @ts-ignore
        const rootPath = vscode.workspace.workspaceFolders[0].uri.path;
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(
            path.join(rootPath, "test_package", "test_example.py")
        ));
        // Let extension start
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    after(async () => {
        await closeAllEditors();
    });

    beforeEach(() => {
        extension = vscode.extensions.getExtension<IExport>("nickmillerdev.pytest-fixtures")!;
        provider = extension?.exports.provider;
    });

    test("Should start extension when python file is opened", () => {
        assert.notStrictEqual(extension, undefined);
        assert.strictEqual(extension?.isActive, true);
    });

    test("Should register the provider", () => {
        assert(provider.activated);
    });

    test("Should cache the python file as it's opened", () => {
        const cache = provider.cache;
        const keys = Object.keys(cache);
        assert(keys.includes(vscode.window.activeTextEditor!.document.uri.fsPath));
    });

    test("Should cache conftest fixtures for the current file", () => {
        const cache = provider.cache;
        const keys = Object.keys(cache);
        const conftextFixture = cache[keys[0]].find((fixture) => fixture.name === "example_fixture");
        assert.notStrictEqual(conftextFixture, undefined);
    });

    test("Should cache built-in fixtures for the current file", () => {
        const cache = provider.cache;
        const keys = Object.keys(cache);
        const conftextFixture = cache[keys[0]].find((fixture) => fixture.name === "monkeypatch");
        assert.notStrictEqual(conftextFixture, undefined);
    });

    test("Should not cache fixtures for non-python file", async () => {
        const cache = provider.cache;
        const keys = Object.keys(cache);
        // @ts-ignore
        const rootPath = vscode.workspace.workspaceFolders[0].uri.path;
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(
            path.join(rootPath, "README.md")
        ));
        assert(!keys.includes(vscode.window.activeTextEditor!.document.uri.fsPath));
    });
});
