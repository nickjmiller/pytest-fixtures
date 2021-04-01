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


export class PytestFixtureCompletionItemProvider
implements vscode.CompletionItemProvider {
    private cache: { [Key: string]: Fixture[] } = {};

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
        if (lineText.startsWith("def test_") && this.cache[testPath]?.length) {
            const lineTextBeforePosition = lineText.slice(0, cursorPosition);
            if (
                lineTextBeforePosition.includes("(") &&
                !lineTextBeforePosition.includes(")")
            ) {
                return this.cache[testPath];
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
