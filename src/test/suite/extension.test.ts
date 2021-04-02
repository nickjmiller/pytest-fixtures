import * as assert from 'assert';
import * as path from "path";

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    test("Should start extension when python file is opened", async () => {
        // @ts-ignore
        const rootPath = vscode.workspace.workspaceFolders[0].uri.path;
        await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(
            path.join(rootPath, "test_example.py")
        ));
        await new Promise(resolve => setTimeout(resolve, 100));
        const started = vscode.extensions.getExtension(
            "nickmillerdev.pytest-fixtures",
        );
        assert.notStrictEqual(started, undefined);
        assert.strictEqual(started?.isActive, true);
    });

});
