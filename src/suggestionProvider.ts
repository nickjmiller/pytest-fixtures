import { parse } from "path";
import * as vscode from "vscode";
import { Fixture } from "./fixtureParser";
import { getFixtures } from "./fixture";
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
 * Check if a line can use fixture suggestions. Returns true if the line is a test function
 * or if the line is a pytest fixture.
 * 
 * @param document 
 * @param lineText 
 * @param lineNumber 
 * @returns true if the current line is a function definition that can use fixtures
 */
const lineCanUseFixtureSuggestions = (document: vscode.TextDocument, lineText: string, lineNumber: number): boolean => {
    // Exit early if we know it's a test function
    if (lineText.startsWith("def test_")) {
        return true;
    }
    let isFixtureFunction = false;
    if (lineNumber > 0) {
        const previousLine = document.lineAt(lineNumber - 1).text;
        // TODO this should be improved because @pytest.fixture can be way above than the previous line
        // for example in fixtures with parameters        
        isFixtureFunction = previousLine.startsWith("@pytest.fixture") && lineText.startsWith("def ");
    }
    return isFixtureFunction;
};

/**
 * Simple function to get the text between "def " and "(".
 *
 * @param lineText line containing function definition
 * @returns function name
 */
const getFunctionName = (lineText: string): string => {
    const indexOfParens = lineText.indexOf("(");
    return lineText.slice(4, indexOfParens); // 4 for "def "
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
            vscode.workspace.onDidSaveTextDocument(document => {
                const filePath = document.uri.fsPath;
                // Only look at files that have already been seen.
                if (this.cache[filePath]) {
                    log(`SavedDocument ${document.fileName}, reloading fixtures...`);
                    this.cacheFixtures(document);
                }
            }),
            vscode.languages.registerCompletionItemProvider(PYTHON, this),
            vscode.languages.registerDefinitionProvider(PYTHON, this),
        ]);
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
        const cursorPosition = position.character;

        if (lineCanUseFixtureSuggestions(document, lineText, position.line)
            && this.cache[testPath]?.length) {
            const lineTextBeforePosition = lineText.slice(0, cursorPosition);
            if (
                lineTextBeforePosition.includes("(") &&
                !lineTextBeforePosition.includes(")")
            ) {
                const functionName = getFunctionName(lineText);
                // Avoid self-reference for fixtures
                return this.cache[testPath].filter((fixture) => fixture.name !== functionName);
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
        log(`Called provideCompletionItems: ${document.fileName}, position: ${position}`);
        
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
        log(`Called provideDefinition: ${document.fileName}, position: ${position}`);

        const lineText = document.lineAt(position.line).text;

        if(lineCanUseFixtureSuggestions(document, lineText, position.line)){
            const range = document.getWordRangeAtPosition(position);
            const word = document.getText(range);
            const fixtures = this.cache[document.uri.fsPath];
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
