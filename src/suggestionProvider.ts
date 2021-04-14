import * as vscode from "vscode";
import * as path from "path";
import { Fixture, getFixtures } from "./fixture";

export const PYTHON: vscode.DocumentFilter = {
    language: "python",
    scheme: "file",
};

const isPythonTestFile = (document: vscode.TextDocument) => {
    if (!(document.languageId === PYTHON.language && document.uri.scheme === PYTHON.scheme)) {
        return false;
    }
    const file = path.parse(document.fileName).base;
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
const lineCanUseFixtureSuggestions = (document: vscode.TextDocument, lineText: string,
    lineNumber: number): boolean => {
    // Exit early if we know it's a test function
    if (lineText.startsWith("def test_")) {
        return true;
    }
    let isFixtureFunction = false;
    if (lineNumber > 0) {
        const previousLine = document.lineAt(lineNumber - 1).text;
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


export class PytestFixtureCompletionItemProvider implements vscode.CompletionItemProvider {
    readonly cache: { [Key: string]: Fixture[] } = {};

    /**
     * Passing the context lets the provider set up its listeners.
     * @param context 
     */
    constructor(context: vscode.ExtensionContext) {
        if (vscode.window.activeTextEditor) {
            this.cacheFixtures(vscode.window.activeTextEditor.document);
        }
        context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor) {
                    this.cacheFixtures(editor.document);
                }
            })
        );
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(document => {
                const filePath = document.uri.fsPath;
                // Only look at files that have already been seen.
                if (this.cache[filePath]) {
                    this.cacheFixtures(document);
                }
            })
        );
        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(
                PYTHON,
                this
            )
        );
    }

    private cacheFixtures = (document: vscode.TextDocument) => {
        if (isPythonTestFile(document)) {
            const filePath = document.uri.fsPath;
            this.cache[filePath] = getFixtures(document);
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
        const suggestions = this.getSuggestions(document, position);
        if (suggestions.length) {
            return suggestions.map((fixture) => {
                let item = new vscode.CompletionItem(
                    fixture.name,
                    vscode.CompletionItemKind.Field
                );
                if (fixture.docstring) {
                    item.documentation = new vscode.MarkdownString(
                        fixture.docstring
                    );
                }
                return item;
            });
        }
        return [];
    }
}
