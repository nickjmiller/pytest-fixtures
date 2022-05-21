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
    return file.startsWith("test_") || file.startsWith("conftest");
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
        pos = new vscode.Position(pos.line - 1, document.lineAt(position.line - 1).text.length);
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
    return lineText.slice(indexOfParens).split(" ").pop();
};


export class PytestFixtureProvider implements vscode.CompletionItemProvider, vscode.DefinitionProvider {
    readonly cache: { [Key: string]: Fixture[] } = {};
    private _activated = false;

    get activated() {
        return this._activated;
    }

    /**
     * Passing the context lets the provider set up its listeners.
     * @param context 
     */
    activate(context: vscode.ExtensionContext) {
        this._activated = true;
        if (vscode.window.activeTextEditor) {
            log(`Active file is ${vscode.window.activeTextEditor.document.fileName}, loading fixtures...`);
            this.cacheFixtures(vscode.window.activeTextEditor.document);
        }

        context.subscriptions.push(... [
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor) {
                    log(`Changed active file to ${editor.document.fileName}, loading fixtures...`);
                    this.cacheFixtures(editor.document);
                }
            }),
            vscode.languages.registerCompletionItemProvider(PYTHON, this),
            vscode.languages.registerDefinitionProvider(PYTHON, this),
        ]);

        const command = "pytest-fixtures.scanForFixtures";
        const commandHandler = (textEditor: vscode.TextEditor) => {
            log(`Active file is ${textEditor.document.fileName}, loading fixtures...`);
            this.cacheFixtures(textEditor.document);
        };
        context.subscriptions.push(vscode.commands.registerTextEditorCommand(command, commandHandler));
    }

    private cacheFixtures = async (document: vscode.TextDocument) => {
        if (isPythonTestFile(document)) {
            log("File is a python test file, loading fixtures...");
            const filePath = document.uri.fsPath;
            const fixtures =  await getFixtures(document);
            this.cache[filePath] = fixtures;
        }
    };

    /**
     * Get suggestions for the given cursor position in a document.
     * If the cursor is within the parameter section of a test function, in
     * a file with cached fixtures, provide results.
     * 
     * @param document current document
     * @param position current cursor position
     * @returns list of fixtures or an empty list
     */
    private getSuggestions = (
        document: vscode.TextDocument,
        position: vscode.Position,
    ): Fixture[] => {
        log(`GetSuggestions: ${document.fileName}`);

        const lineText = document.lineAt(position.line).text;
        const testPath = document.uri.fsPath;

        if (this.cache[testPath]?.length &&
            isWithinTestFunctionArgs(document, position)) {
            const functionName = getFunctionName(lineText);
            // Avoid self-reference for fixtures
            return this.cache[testPath].filter((fixture) => fixture.name !== functionName);
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
        
        const suggestions = this.getSuggestions(document, position);
        if (suggestions.length) {
            return suggestions.map((fixture) => {
                let item = new vscode.CompletionItem(
                    fixture.name,
                    vscode.CompletionItemKind.Field
                );
                item.documentation = fixture.docstring;
                return item;
            });
        }
        return [];
    }

    provideDefinition(document: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
        log(`Called provideDefinition: ${document.fileName}, position: ${JSON.stringify(position)}`);
        const testPath = document.uri.fsPath;

        if(this.cache[testPath]?.length && isWithinTestFunctionArgs(document, position)){
            const range = document.getWordRangeAtPosition(position);
            const word = document.getText(range);
            const fixtures = this.cache[testPath];
            const fixture = fixtures.find(f=> f.name === word);
            if(fixture?.fileLocation && fixture?.range)
            {
                return new vscode.Location(
                    fixture.fileLocation,
                    fixture.range
                );
            }
        }
        return [];
    }
}
