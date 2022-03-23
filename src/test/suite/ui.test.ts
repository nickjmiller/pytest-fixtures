import * as assert from "assert";
import { beforeEach } from "mocha";
import * as path from "path";
import * as vscode from "vscode";
import {
    closeAllEditors,
    getCompletionItems,
    getDefinitions,
    openFile,
    undo,
} from "./helpers";
import { INNER_FIXTURES } from "./ui-test-data/inner-fixtures";
import { OUTER_FIXTURES } from "./ui-test-data/outer-fixtures";
import { VARIANT_FIXTURES } from "./ui-test-data/variant-fixture";

suite("Extension UI Test Suite", () => {
    let folder = vscode.workspace.workspaceFolders![0].uri.fsPath;

    beforeEach(async () => {
        await closeAllEditors();
    });

    test("Should provide correct items to inner test", async () => {
        await openFile(path.join("test_package", "test_example.py"));

        const uri = vscode.window.activeTextEditor!.document.uri;
        const position = new vscode.Position(6, 17);
        const list = await getCompletionItems(uri, position);

        const fixtures = list.items.map((item) => item.label).sort();
        assert.deepStrictEqual(fixtures, INNER_FIXTURES);
    });

    test("Should provide correct items to outer test", async () => {
        await openFile("test_outer.py");

        const uri = vscode.window.activeTextEditor!.document.uri;
        const position = new vscode.Position(6, 17);
        const list = await getCompletionItems(uri, position);

        const fixtures = list.items.map((item) => item.label).sort();
        assert.deepStrictEqual(fixtures, OUTER_FIXTURES);
    });

    test("Should provide correct items to fixture with multiple decorators", async () => {
        await openFile("test_variants.py");

        const uri = vscode.window.activeTextEditor!.document.uri;
        const position = new vscode.Position(5, 37);
        const list = await getCompletionItems(uri, position);

        const fixtures = list.items.map((item) => item.label).sort();
        assert.deepStrictEqual(fixtures, VARIANT_FIXTURES.filter(f => f !== "fixture_with_multiple_decorators"));
    });

    test("Should provide correct items to test within class", async () => {
        await openFile("test_variants.py");

        const uri = vscode.window.activeTextEditor!.document.uri;
        const position = new vscode.Position(10, 26);
        const list = await getCompletionItems(uri, position);

        const fixtures = list.items.map((item) => item.label).sort();
        assert.deepStrictEqual(fixtures, VARIANT_FIXTURES);
    });

    test("Should provide correct items to test spanning multiple lines", async () => {
        await openFile("test_variants.py");

        const uri = vscode.window.activeTextEditor!.document.uri;
        const position = new vscode.Position(15, 4);
        const list = await getCompletionItems(uri, position);

        const fixtures = list.items.map((item) => item.label).sort();
        assert.deepStrictEqual(fixtures, VARIANT_FIXTURES);
    });

    test("Should navigate to correct fixture in inner test from inner conftest", async () => {
        await openFile(path.join("test_package", "test_example.py"));
        const fixture = "example_fixture";

        const uri = vscode.window.activeTextEditor!.document.uri;
        const position = new vscode.Position(6, 17);

        await vscode.window.activeTextEditor!.edit((editBuilder) => {
            editBuilder.insert(position, "example_fixture");
        });

        const definitions = await getDefinitions(uri, position);
        await undo();

        // Self-referential definition is provided outside this extension.
        const providedDefinition = definitions.find(
            (definition) =>
                definition.uri.fsPath ===
                path.join(folder, "test_package", "conftest.py")
        );

        assert.strict(providedDefinition);
        assert.deepStrictEqual(
            providedDefinition.range,
            new vscode.Range(
                new vscode.Position(3, 4),
                new vscode.Position(3, 19)
            )
        );
    });

    test("Should navigate to correct fixture in inner test from outer conftest", async () => {
        await openFile(path.join("test_package", "test_example.py"));

        const uri = vscode.window.activeTextEditor!.document.uri;
        const position = new vscode.Position(6, 17);

        await vscode.window.activeTextEditor!.edit((editBuilder) => {
            editBuilder.insert(position, "another_example");
        });

        const definitions = await getDefinitions(uri, position);
        await undo();

        const providedDefinition = definitions.find(
            (definition) =>
                definition.uri.fsPath === path.join(folder, "conftest.py")
        );

        assert.strict(providedDefinition);
        assert.deepStrictEqual(
            providedDefinition.range,
            new vscode.Range(
                new vscode.Position(9, 4),
                new vscode.Position(9, 19)
            )
        );
    });

    test("Should navigate to correct fixture in inner test from inner test", async () => {
        await openFile(path.join("test_package", "test_example.py"));

        const uri = vscode.window.activeTextEditor!.document.uri;
        const position = new vscode.Position(6, 17);

        await vscode.window.activeTextEditor!.edit((editBuilder) => {
            editBuilder.insert(position, "local_fixture");
        });

        const definitions = await getDefinitions(uri, position);
        await undo();

        const providedDefinition = definitions.find(
            (definition) => definition.uri.fsPath === uri.fsPath
        );

        assert.strict(providedDefinition);
        assert.deepStrictEqual(
            providedDefinition.range,
            new vscode.Range(
                new vscode.Position(3, 4),
                new vscode.Position(3, 17)
            )
        );
    });

    test("Should navigate to correct private fixture in inner test", async () => {
        await openFile(path.join("test_package", "test_example.py"));

        const uri = vscode.window.activeTextEditor!.document.uri;
        const position = new vscode.Position(6, 17);

        await vscode.window.activeTextEditor!.edit((editBuilder) => {
            editBuilder.insert(position, "_private_fixture");
        });

        const definitions = await getDefinitions(uri, position);
        await undo();

        const providedDefinition = definitions.find(
            (definition) =>
                definition.uri.fsPath ===
                path.join(folder, "test_package", "conftest.py")
        );

        assert.strict(providedDefinition);
        assert.deepStrictEqual(
            providedDefinition.range,
            new vscode.Range(
                new vscode.Position(7, 4),
                new vscode.Position(7, 20)
            )
        );
    });

    test("Should navigate to correct fixture in outer test", async () => {
        await openFile("test_outer.py");

        const uri = vscode.window.activeTextEditor!.document.uri;
        const position = new vscode.Position(6, 17);

        await vscode.window.activeTextEditor!.edit((editBuilder) => {
            editBuilder.insert(position, "example_fixture");
        });

        const definitions = await getDefinitions(uri, position);
        await undo();

        const providedDefinition = definitions.find(
            (definition) =>
                definition.uri.fsPath === path.join(folder, "conftest.py")
        );

        assert.strict(providedDefinition);
        assert.deepStrictEqual(
            providedDefinition.range,
            new vscode.Range(
                new vscode.Position(4, 4),
                new vscode.Position(4, 19)
            )
        );
    });
});
