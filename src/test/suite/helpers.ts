import * as path from "path";
import * as vscode from "vscode";

export async function getCompletionItems(documentUri: vscode.Uri, position: vscode.Position): Promise<vscode.CompletionList> {
    return await vscode.commands.executeCommand(
        "vscode.executeCompletionItemProvider",
        documentUri,
        position,
    ) as vscode.CompletionList;
}

export async function getDefinitions(documentUri: vscode.Uri, position: vscode.Position) {
    return await vscode.commands.executeCommand(
        "vscode.executeDefinitionProvider",
        documentUri,
        position
    ) as vscode.Location[];
}

export async function openFile(localPath: string): Promise<void> {
    const rootPath = vscode.workspace.workspaceFolders![0].uri.path;
    await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(
        path.join(rootPath, localPath)
    ));
}

export async function closeAllEditors(){
    return await vscode.commands.executeCommand("workbench.action.closeAllEditors");
}

export async function undo() {
    return await vscode.commands.executeCommand("undo");
}