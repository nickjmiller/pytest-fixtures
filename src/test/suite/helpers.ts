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

// determine if the array has all the items from the other array
export function isAllElementFound(arrayToCompare: string[], arrayToBeFound : string[]) {
    let allFounded = arrayToBeFound.every( element => {
        const found = arrayToCompare.includes(element);
        if (!found) {
            console.log(`${element} not found`);
        }
        return found;
    });
    return allFounded;
}

export async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}