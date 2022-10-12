import { spawnSync } from "child_process";
import { PythonShell } from "python-shell";
import { readFileSync } from "fs";
import { join, isAbsolute } from "path";
import * as vscode from "vscode";
import { log } from "./logging";

export interface Fixture {
    name: string;
    docstring: string;
    fileLocation?: vscode.Uri;
    range?: vscode.Range;
    returnType?: string;
    module?: string;
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
 * Find where pytest is installed and return the pip package location
 */

const findPipPackageLocation = async () => {
    let pyTestLocation = "";
    const response = spawnSync(PythonShell.defaultPythonPath, ["-m", "pip", "show", "pytest"]);
    if (response.status === 0) {
        let lines = response.stdout.toString().split(/\r?\n/);
        lines.forEach(line => {
            // Location: /home/ctule/.local/lib/python3.8/site-packages
            if (line.indexOf("Location: ") > -1) {
                pyTestLocation = line.substring(10);
            }
        });
    }
    return pyTestLocation;
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
export const parsePytestOutputToFixtures = async (output: string, rootDir: string) => {
    const fixtures: Fixture[] = [];
    let alreadyEncountered: Record<string, number> = {};
    let currentFilePath: string | null = null;

    let lines = output.split("\n");
    const pytestRootDir = lines.find(line => line.startsWith("rootdir"))?.slice(9).split(",")[0].trim();
    lines = removeTrailingPytestInfo(lines);
    // Use the rootdir defined by pytest if it's available
    const rootDirForPath = pytestRootDir ? pytestRootDir : rootDir;
    const pipPackageLocation = await findPipPackageLocation();
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
            let path;
            // check if pytest fixture
            if (linePath.indexOf(".../_pytest") > -1) {
                path = linePath.replace("...", pipPackageLocation);
            } else {
                path = isAbsolute(linePath) ? linePath : join(rootDirForPath, linePath);
            }
            try {
                if (linePath !== currentFilePath) {
                    tmpContent = readFileSync(path, "utf8").split(/\r?\n/);
                    currentFilePath = linePath;
                }
                fixture.fileLocation = vscode.Uri.file(path);
                const site_pos = path.indexOf("site-packages/");
                if ( site_pos > -1) {
                    fixture.module = path.substring(site_pos+14);
                } else {
                    fixture.module = path;
                };
                const lineInt = parseInt(line, 10) - 1;
                if (tmpContent && lineInt < tmpContent.length) {
                    let line = tmpContent[lineInt];
                    const start = line.indexOf(`def ${fixture.name}(`) + 4;
                    const end = start + fixture.name.length;
                    fixture.range = new vscode.Range(
                        new vscode.Position(lineInt, start),
                        new vscode.Position(lineInt, end)
                    );
                    // def fixture_with_type_hinting() -> str:
                    if (line.indexOf("->") > 0) {
                        let returnType = line.split("->")[1];
                        returnType = returnType.replace(":","").trim();
                        fixture.returnType = returnType;
                    }
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
