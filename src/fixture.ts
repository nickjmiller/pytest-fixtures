import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import { dirname, join, isAbsolute } from "path";
import * as vscode from "vscode";
import { log } from "./logging";

export interface Fixture {
    name: string;
    docstring: string;
    fileLocation?: vscode.Uri;
    range?: vscode.Range;
}

const FIXTURE_REGEX = /^(\w+)[ \[\]\w]* -- ([^:]+):(\d+)/i;

/**
 * Removes the pytest information from the list of fixtures.
 * Assumes that all fixtures come before a line of `===...`.
 * 
 * @param lines input lines from pytest --fixtures
 * @returns lines without preceding or following pytest info
 */
const removeTrailingPytestInfo = (lines: string[]) => {
    const firstFixture = lines.findIndex(line => line.match(FIXTURE_REGEX));
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
    let alreadyEncountered: Record<string, number> = {};
    let currentFilePath: string | null = null;

    let lines = output.split("\n");
    const pytestRootDir = lines.find(line => line.startsWith("rootdir"))?.slice(9).split(",")[0].trim();
    lines = removeTrailingPytestInfo(lines);
    // Use the rootdir defined by pytest if it's available
    const rootDirForPath = pytestRootDir ? pytestRootDir : rootDir;

    let tmpContent: string[] | null = null;

    let fixture: Fixture = {
        name: "",
        docstring: "",
    };

    function append(fixture: Fixture) {
        let index = alreadyEncountered[fixture.name] ?? -1;
        if(index >= 0) {
            fixtures[index] = fixture;
        }
        else {
            fixtures.push(fixture);
            alreadyEncountered[fixture.name] = fixtures.length - 1;
        }
    }

    lines.forEach(line => {
        let matches;

        // A space means docstring or a no-docstring error
        if (line.startsWith(" ")) {
            fixture.docstring += `${line}\n`;
        } else if (matches = line.match(FIXTURE_REGEX)) { // If the line starts with a letter or a number, we assume fixture
            if (fixture.name) {
                append(fixture);
            }
            const [name, linePath, line] = matches.slice(1);
            fixture = { name, docstring: "" };

            const path = isAbsolute(linePath) ? linePath : join(rootDirForPath, linePath);
            try {
                if (linePath !== currentFilePath) {
                    tmpContent = readFileSync(path, "utf8").split(/\r?\n/);
                    currentFilePath = linePath;
                }
                fixture.fileLocation = vscode.Uri.file(path);
                const lineInt = parseInt(line, 10) - 1;
                if (tmpContent && lineInt < tmpContent.length) {
                    const start = tmpContent[lineInt].indexOf(`def ${fixture.name}(`) + 4;
                    const end = start + fixture.name.length;
                    fixture.range = new vscode.Range(
                        new vscode.Position(lineInt, start),
                        new vscode.Position(lineInt, end)
                    );
                }
            } catch (error) {
                log(`Unable to read file at path ${path}, ${error}`);
            }
        }
    });
    if (fixture.name) {
        append(fixture);
    }
    log(`Found ${fixtures.length} fixtures`);
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
    const args = ["--color", "no", "--fixtures", "-v", document.uri.fsPath];
    const cwd = dirname(document.uri.fsPath);
    const pytestPath: string = vscode.workspace
        .getConfiguration("python.testing", document.uri)
        .get("pytestPath") || "pytest";
    if (pytestPath === "pytest") {
        const pythonPath: string = vscode.workspace
            .getConfiguration("python", document.uri)
            .get("pythonPath") || "python";

        log(`Running command ${pythonPath} -m pytest ${args.join(" ")} in directory ${cwd}`);
        response = spawnSync(pythonPath, ["-m", "pytest", ...args], { cwd });
    } else {
        log(`Running command ${pytestPath} -m pytest ${args.join(" ")} in directory ${cwd}`);
        response = spawnSync(pytestPath, args, { shell: true, cwd });
    }
    
    if(response.error) {
        log(`Error running pytest: ${response.error}`);
        return [];
    }
    return parsePytestOutputToFixtures(response.stdout.toString(), cwd);
};
