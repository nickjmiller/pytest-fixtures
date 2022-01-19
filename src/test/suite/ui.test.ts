import * as assert from "assert";
import { beforeEach } from "mocha";
import * as path from "path";
import * as vscode from "vscode";
import { closeAllEditors, getCompletionItems, getDefinitions, openFile, undo } from "./helpers";
import { INNER_FIXTURES } from "./ui-test-data/inner-fixtures";
import { OUTER_FIXTURES } from "./ui-test-data/outer-fixtures";

suite("Extension UI Test Suite", () => {
    let folder = vscode.workspace.workspaceFolders![0].uri.fsPath;

    beforeEach(async () => {
        await closeAllEditors();
    });

    test("Should provide correct items to inner test", async () => {
        await openFile(path.join("test_package","test_example.py"));

        const uri = vscode.window.activeTextEditor!.document.uri;
        const position = new vscode.Position(6, 17);
        const list = await getCompletionItems(uri, position);
        
        assert(JSON.stringify(list.items) === JSON.stringify(INNER_FIXTURES));
    });

    test("Should provide correct items to outer test", async () => {
        await openFile("test_outer.py");

        const uri = vscode.window.activeTextEditor!.document.uri;
        const position = new vscode.Position(6, 17);
        const list = await getCompletionItems(uri, position);
        
        assert(JSON.stringify(list.items) === JSON.stringify(OUTER_FIXTURES));
    });

    test("Should navigate to correct fixture in inner test from inner conftest", async () => {
        await openFile(path.join("test_package","test_example.py"));

        const uri = vscode.window.activeTextEditor!.document.uri;
        const position = new vscode.Position(6, 17);
        
        await vscode.window.activeTextEditor!.edit((editBuilder) => {
            editBuilder.insert(position, "example_fixture");
        });

        const definitions = await getDefinitions(uri, position);
        assert(definitions.length === 1);
        assert(definitions[0].uri.fsPath === path.join(folder, "test_package", "conftest.py"));
        assert(definitions[0].range.start.line === 3);
        assert(definitions[0].range.start.character === 4);
        assert(definitions[0].range.end.line === 3);
        assert(definitions[0].range.end.character === 19);

        await undo();
    });

    test("Should navigate to correct fixture in inner test from outer conftest", async () => {
        await openFile(path.join("test_package","test_example.py"));

        const uri = vscode.window.activeTextEditor!.document.uri;
        const position = new vscode.Position(6, 17);
        
        await vscode.window.activeTextEditor!.edit((editBuilder) => {
            editBuilder.insert(position, "another_example");
        });

        const definitions = await getDefinitions(uri, position);
        assert(definitions.length === 1);
        assert(definitions[0].uri.fsPath === path.join(folder, "conftest.py"));
        assert(definitions[0].range.start.line === 9);
        assert(definitions[0].range.start.character === 4);
        assert(definitions[0].range.end.line === 9);
        assert(definitions[0].range.end.character === 19);

        await undo();
    });

    test("Should navigate to correct fixture in inner test from inner test", async () => {
        await openFile(path.join("test_package","test_example.py"));

        const uri = vscode.window.activeTextEditor!.document.uri;
        const position = new vscode.Position(6, 17);
        
        await vscode.window.activeTextEditor!.edit((editBuilder) => {
            editBuilder.insert(position, "local_fixture");
        });

        const definitions = await getDefinitions(uri, position);
        assert(definitions.length === 1);
        assert(definitions[0].uri.fsPath === uri.fsPath);
        assert(definitions[0].range.start.line === 3);
        assert(definitions[0].range.start.character === 4);
        assert(definitions[0].range.end.line === 3);
        assert(definitions[0].range.end.character === 17);

        await undo();
    });

    test("Should navigate to correct private fixture in inner test", async () => {
        await openFile(path.join("test_package","test_example.py"));

        const uri = vscode.window.activeTextEditor!.document.uri;
        const position = new vscode.Position(6, 17);
        
        await vscode.window.activeTextEditor!.edit((editBuilder) => {
            editBuilder.insert(position, "_private_fixture");
        });

        const definitions = await getDefinitions(uri, position);
        assert(definitions.length === 1);
        assert(definitions[0].uri.fsPath === path.join(folder, "test_package", "conftest.py"));
        assert(definitions[0].range.start.line === 7);
        assert(definitions[0].range.start.character === 4);
        assert(definitions[0].range.end.line === 7);
        assert(definitions[0].range.end.character === 20);

        await undo();
    });


    test("Should navigate to correct fixture in outer test", async () => {
        await openFile("test_outer.py");

        const uri = vscode.window.activeTextEditor!.document.uri;
        const position = new vscode.Position(6, 17);
        
        await vscode.window.activeTextEditor!.edit((editBuilder) => {
            editBuilder.insert(position, "example_fixture");
        });

        const definitions = await getDefinitions(uri, position);
        assert(definitions.length === 1);
        assert(definitions[0].uri.fsPath === path.join(folder, "conftest.py"));
        assert(definitions[0].range.start.line === 4);
        assert(definitions[0].range.start.character === 4);
        assert(definitions[0].range.end.line === 4);
        assert(definitions[0].range.end.character === 19);

        await undo();
    });
});
