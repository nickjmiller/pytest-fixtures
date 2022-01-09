import * as vscode from "vscode";
import {join} from "path";
import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import { EOL } from "os";

export interface Fixture {
    name: string;
    docstring: string;
    fileLocation?: vscode.Uri;
    range?: vscode.Range;
}

/**
 * Removes the pytest information from the list of fixtures.
 * Assumes that all fixtures lie between two lines of `===...`.
 * 
 * @param lines input lines from pytest --fixtures
 * @returns lines without preceding or following pytest info
 */
const removeTrailingPytestInfo = (lines: string[]) => {
    const firstFixture = lines.findIndex(line => line === "" || line.startsWith("    ")) - 1;
    lines = lines.slice(firstFixture);
    const lastFixture = lines.findIndex(line => line.startsWith("==="));
    return lines.slice(0, lastFixture);
};

/**
 * Parses the pytest output. Makes a few assumptions:
 * 1. the fixtures are surrounded by blocks of `=====...`
 * 1. Each fixture is separated by an empty line
 * 1. Fixtures start with a letter or number
 * 1. Docstrings have at least 2 spaces
 * 
 * @param output pytest --fixtures output
 * @returns list of fixtures parsed from output
 */
const parsePytestOutputToFixtures = (output: string, rootDir: string) => {
    const fixtures: Fixture[] = [];
    let lines = removeTrailingPytestInfo(output.split("\n"));
    let currentLocation: vscode.Uri | null = null;
    let content: string[] | null = null;
    let alreadyEncountered: Record<string, number> = {};

    let fixture: Fixture = {
        name: "",
        docstring: "",
    };

    function append(fixture: Fixture) {
        let index = alreadyEncountered[fixture.name] ?? -1;
        if(index >= 0)
        {fixtures[index] = fixture;}
        else{
            fixtures.push(fixture);
            alreadyEncountered[fixture.name] = fixtures.length - 1;
        }
    }

    lines.forEach(line => {
        // Two spaces means docstring or error, pytest includes no docstring errors if there are no docstrings
        if (line.startsWith("  ") && !line.includes("no docstring")) {
            fixture.docstring += `\n${line}`;
        } else if (line.match(/^[\w]/i)) { // If the line starts with a letter or a number, we assume fixture
            if (fixture.name) {
                append(fixture);
            }
            fixture = {
                name: line.split(" ")[0].trim(),
                docstring: "",
            } as Fixture;

            if(currentLocation && content) {
                fixture.fileLocation = currentLocation;
                const line = content.findIndex(line => line.includes("def " + fixture.name + "("));
                const start = content[line].indexOf("def " + fixture.name + "(") + 4;
                const end = start + fixture.name.length;
                fixture.range = new vscode.Range(
                    new vscode.Position(line, start),
                    new vscode.Position(line, end)
                );
            }

        } else if(line.startsWith("--")) {
            const match = /^-+ fixtures defined from (.+) -+$/.exec(line);
            const path = match?.[1].split(".").join("/") + ".py";
            currentLocation = vscode.Uri.file(join(rootDir, path));
            content = readFileSync(currentLocation.fsPath).toString().split(EOL);
        }
    });
    if (fixture.name) {
        append(fixture);
    }
    return fixtures;
};

/**
 * Pytest provides different fixtures for different files, based on
 * hierarchy and context. We use the current python interpreter to
 * call pytest --fixtures for each file and record the responses.
 * 
 * @param document
 * @returns list of fixtures prepared for the file
 */
export const getFixtures = (document: vscode.TextDocument) => {
    let response;
    const args = ["--fixtures", document.uri.fsPath];
    const pytestPath: string = vscode.workspace
        .getConfiguration("python.testing", document.uri)
        .get("pytestPath") || "pytest";
    if (pytestPath === "pytest") {
        const pythonPath: string = vscode.workspace
            .getConfiguration("python", document.uri)
            .get("pythonPath") || "python";
        response = spawnSync(pythonPath, ["-m", "pytest", ...args]);
    } else {
        response = spawnSync(pytestPath, args, { shell: true });
    }
    const rootDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if(!rootDir)
    {
        throw new Error("No workspace folder found");
    }
    return parsePytestOutputToFixtures(response.stdout.toString(), rootDir);
};
