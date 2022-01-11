import * as vscode from "vscode";

const OUT_CHANNEL = vscode.window.createOutputChannel("pytest-fixtures");

export function log(msg: string) {
    const date = new Date();
    OUT_CHANNEL.appendLine(`[${date.toLocaleDateString()} - ${date.toLocaleTimeString()}] ${msg}`);
}