import { throws } from "assert";
import { parse } from "path";
import * as vscode from "vscode";
import { getFixtures } from "./fixture";
import { Fixture } from "./fixtureParser";
import { log } from "./logging";

export const PYTHON: vscode.DocumentFilter = {
    language: "python",
    scheme: "file",
};

const isPythonTestFile = (document: vscode.TextDocument) => {
    if (!(document.languageId === PYTHON.language && document.uri.scheme === PYTHON.scheme)) {
        return false;
    }
    const file = parse(document.fileName).base;
    return file.startsWith("test_") || file.endsWith("_test.py") || file.startsWith("conftest");
};

/**
 * Iterates backwards through the document from the given position, checking each character
 * to see if it is an open parens. Returns false if it cannot find one or discovers a closed
 * parens first.
 *
 * @param document active text document
 * @param position position of the cursor
 * @returns location of the open parens if found, otherwise undefined
 */
const positionOfOpenParens = (document: vscode.TextDocument, position: vscode.Position): vscode.Position | undefined => {
    let pos = position.translate(0, -1); // Check to the left of the cursor
    while (pos.line >= 0) {
        const line = document.lineAt(pos.line).text;
        for (let character = pos.character; character >= 0; character--) {
            const char = line.substring(character, character + 1);
            if (char === "(") {
                return new vscode.Position(pos.line, character);
            } else if (char === ")") {
                return;
            }
        }
        pos = new vscode.Position(pos.line - 1, document.lineAt(pos.line - 1).text.length);
    }
    return;
};

/**
 * Checks if the line is a pytest fixture. Will check previous lines
 * that begin with @ until it finds the `pytest.fixture` or returns False.
 *
 * Does not support many cases, including decorators that span multiple lines.
 *
 * @param document active text document
 * @param position position of the function definition
 * @returns if a pytest fixture was found
 */
const isPytestFixture = (document: vscode.TextDocument, position: vscode.Position): boolean => {
    const line = document.lineAt(position).text;
    if (!isLineFunction(line)) {
        return false;
    }

    const additionalDecorators: [string] | undefined = vscode.workspace
        .getConfiguration("pytest-fixtures")
        .get("additionalDecorators");

    let pos = position.translate(-1);
    while (pos.line >= 0 && !document.lineAt(pos).isEmptyOrWhitespace) {
        const line = document.lineAt(pos).text;
        const index = document.lineAt(pos).firstNonWhitespaceCharacterIndex;
        if (!(line.substring(index, index + 1) === "@")) {
            return false;
        }
        if (line.includes("pytest.fixture")) {
            return true;
        }
        if (additionalDecorators
            && additionalDecorators.length
            && additionalDecorators.filter(decorator => line.includes(decorator))) {
            return true;
        }
        pos = pos.translate(-1);
    }
    return false;
};

function isLineFunction(line: string): boolean {
    const trimmedLine = line.trim();
    return trimmedLine.startsWith("def ") || trimmedLine.startsWith("async def ");
}

/**
 * Brittle function that checks if there is a dangling open parens before
 * the cursor and if that parens is on the same line as a function definition.
 * It also checks if that function definition is preceeded by a pytest.fixture decorator.
 *
 * @param document active text document
 * @param position position of the cursor
 * @returns
 */
const isWithinTestFunctionArgs = (document: vscode.TextDocument, position: vscode.Position): boolean => {
    let pos = positionOfOpenParens(document, position);
    if (pos === undefined) {
        return false;
    }
    const line = document.lineAt(pos).text;
    if (line.includes(";")) {
        // Bail, we aren't supporting that for now
        return false;
    }
    if (isLineTestFunction(line)) {
        return true;
    }
    return isPytestFixture(document, pos);
};

function isLineTestFunction(line: string): boolean {
    const trimmedLine = line.trim();
    return trimmedLine.startsWith("def test_") || trimmedLine.startsWith("async def test_");
}

/**
 * Get the function name from the current line.
 *
 * TODO: Get the relevant function name if on another line
 *
 * @param lineText line containing function definition
 * @returns function name
 */
const getFunctionName = (lineText: string): string | undefined => {
    const indexOfParens = lineText.indexOf("(");
    return lineText.slice(0, indexOfParens).split(" ").pop();
};


const shouldScanForFixtures = () => {
    return vscode.workspace.getConfiguration("pytest-fixtures").get("scanForFixturesOnFileChange");
};

export class PytestFixtureProvider implements vscode.CompletionItemProvider, vscode.DefinitionProvider {
    cache: { [Key: string]: Fixture[] } = {};
    private _activated = false;
    private readonly cacheKey = "pytest_fixtures_data";
    private context: vscode.ExtensionContext | undefined;
    get activated() {
        return this._activated;
    }

    /**
     * Passing the context lets the provider set up its listeners.
     * @param context
     */
    activate(context: vscode.ExtensionContext) {
        this._activated = true;
        this.context = context;
        this.cache = context.workspaceState.get<{ [Key: string]: Fixture[] }>(this.cacheKey, {});
        if (shouldScanForFixtures() && vscode.window.activeTextEditor) {
            log(`Loading fixtures for ${vscode.window.activeTextEditor.document.fileName}`);
            this.cacheFixtures(vscode.window.activeTextEditor.document);
        }

        context.subscriptions.push(... [
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (shouldScanForFixtures()  && editor) {
                    log(`Active file changed; Loading fixtures for ${editor.document.fileName}`);
                    this.cacheFixtures(editor.document);
                }
            }),
            vscode.languages.registerCompletionItemProvider(PYTHON, this),
            vscode.languages.registerDefinitionProvider(PYTHON, this),
        ]);

        const command = "pytest-fixtures.scanForFixtures";
        const commandHandler = (textEditor: vscode.TextEditor) => {
            log(`Loading fixtures for ${textEditor.document.fileName}`);
            this.cacheFixtures(textEditor.document);
        };
        context.subscriptions.push(vscode.commands.registerTextEditorCommand(command, commandHandler));
    }


    private cacheFixtures = async (document: vscode.TextDocument) => {
        if (isPythonTestFile(document)) {
            const filePath = document.uri.fsPath;
            const fixtures =  await getFixtures(document);
            this.cache[filePath] = fixtures;
            await this.context?.workspaceState.update(this.cacheKey, this.cache);
        }
    };

    /**
     * Get suggestions for the given cursor position in a document.
     * If the cursor is within the parameter section of a test function, in
     * a file with cached fixtures, provide results.
     * If ':' character after the fixtureName, provide the type for type annotation
     *
     * @param document current document
     * @param position current cursor position
     * @returns list of fixtures or an empty list
     */
    private getSuggestions = (
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.CompletionItem[] => {
        log(`GetSuggestions: ${document.fileName}`);

        const lineText = document.lineAt(position.line).text;
        const testPath = document.uri.fsPath;

        if (this.cache[testPath]?.length &&
            isWithinTestFunctionArgs(document, position)) {
            // is ':' character before after removing the spaces ? suggestion of type anontation
            let pos = position.translate(0, -1).character;
            const trimlineText = lineText.substring(0, pos+1).trim();
            pos = trimlineText.length-1;
            const char = lineText.charAt(pos);
            if (char === ":") {
                // find the parameter name / fixture name
                const lineToSearch = lineText.substring(0, pos+1);
                const parameters = lineToSearch.match(/(\w+)\s*:/g)?.slice(-1);
                if (parameters?.length === 1) {
                    const fixtureName = parameters[0].replace(":","").trim();
                    let fixture = this.cache[testPath].find((fixture) => fixture.name === fixtureName);
                    if (fixture?.returnType) {
                        let item = new vscode.CompletionItem(
                            fixture.returnType,
                            vscode.CompletionItemKind.Snippet
                        );
                        return [item];
                    }
                    return [];
                }
                return [];
            } else {
                // Give suggestion of fixtures.
                const functionName = getFunctionName(lineText);
                // Avoid self-reference for fixtures
                const fixtures = this.cache[testPath].filter((fixture) => fixture.name !== functionName);

                if (fixtures.length) {
                    return fixtures.map((fixture) => {
                        let fixtureName = fixture.name;
                        let item = new vscode.CompletionItem(
                            fixtureName,
                            vscode.CompletionItemKind.Snippet
                        );
                        item.detail = fixture.module;
                        item.documentation = fixture.docstring;
                        return item;
                    });
                }
                return [];
            }
        }
        return [];
    };

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): vscode.CompletionItem[] {
        log(`Called provideCompletionItems: ${document.fileName}, position: ${JSON.stringify(position)}`);

        return this.getSuggestions(document, position);
    }

    provideDefinition(document: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
        if(isWithinTestFunctionArgs(document, position)) {
            return new Promise((resolve) => {
                log(`Called provideDefinition: ${document.fileName}, position: ${JSON.stringify(position)}`);
                const testPath = document.uri.fsPath;

                if (this.cache[testPath]?.length) {
                    resolve(this.getFixtures(document, position));

                }
                else {
                    this.cacheFixtures(document).then(() => {
                        resolve(this.getFixtures(document, position));
                    });
                }
            });
        }
        return [];
    }

    private getFixtures(document: vscode.TextDocument, position: vscode.Position): vscode.Definition | vscode.LocationLink[] {
        const testPath = document.uri.fsPath;
        const range = document.getWordRangeAtPosition(position);
        const word = document.getText(range);
        const fixtures = this.cache[testPath];
        const fixture = fixtures.find(f => f.name === word);
        if (fixture?.fileLocation && fixture?.range) {
            return new vscode.Location(
                fixture.fileLocation,
                fixture.range
            );
        }
        return [];
    }

}
