import * as vscode from "vscode";
import * as path from "path";
import { Fixture, getFixtures } from "./fixture";

export const PYTHON: vscode.DocumentFilter = {
    language: "python",
    scheme: "file",
};

const isPythonTestFile = (document: vscode.TextDocument) => {
    if (!(document.languageId === PYTHON.language)) {
        return false;
    }
    const file = path.parse(document.fileName).base;
    return file.startsWith("test_") || file.startsWith("conftest");
};


export class PytestFixtureCompletionItemProvider
implements vscode.CompletionItemProvider {
    private CACHE: { [Key: string]: Fixture[] } = {};
    constructor(context: vscode.ExtensionContext) {
        vscode.workspace.textDocuments.forEach((document) => this.cacheFixtures(document));
        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(event => {
                this.cacheFixtures(event.document);
            })
        );
        context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(
                PYTHON,
                this
            )
        );
    }

    cacheFixtures = (document: vscode.TextDocument) => {
        if (isPythonTestFile(document)) {
            const filePath = document.uri.fsPath;
            this.CACHE[filePath] = getFixtures(filePath);
        }
    };

    shouldOfferSuggestions = (
        testPath: string,
        lineText: string,
        cursorPosition: number
    ): boolean => {
        if (lineText.startsWith("def test_") && this.CACHE[testPath]?.length) {
            const lineTextBeforePosition = lineText.slice(0, cursorPosition);
            return (
                lineTextBeforePosition.includes("(") &&
                !lineTextBeforePosition.includes(")")
            );
        }
        return false;
    };

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): vscode.CompletionItem[] {
        let lineText = document.lineAt(position.line).text;
        const testPath = document.uri.fsPath;
        if (this.shouldOfferSuggestions(testPath, lineText, position.character)) {
            return this.CACHE[testPath].map((fixture) => {
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
