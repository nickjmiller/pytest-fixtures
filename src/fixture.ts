import { spawnSync } from "child_process";

export interface Fixture {
    name: string;
    docstring: string;
}

/**
 * Removes the pytest information from the list of fixtures.
 * Assumes that all fixtures lie between two lines of `===...`.
 * 
 * @param lines input lines from pytest --fixtures
 * @returns lines without preceeding or following pytest info
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
const parsePytestOutputToFixtures = (output: string) => {
    const fixtures: Fixture[] = [];
    let lines = removeTrailingPytestInfo(output.split("\n"));
    let fixture: Fixture = {
        name: "",
        docstring: "",
    };
    lines.forEach(line => {
        // Two spaces means docstring or error, pytest includes no docstring errors if there are no docstrings
        if (line.startsWith("  ") && !line.includes("no docstring")) {
            fixture.docstring += `\n${line}`;
        } else if (line.match(/^[A-Z0-9]/i)) { // If the line starts with a letter or a number, we assume fixture
            if (fixture.name) {
                fixtures.push(fixture);
            }
            fixture = {
                name: line,
                docstring: "",
            };
        }
    });
    if (fixture.name) {
        fixtures.push(fixture);
    }
    return fixtures;
};

/**
 * Pytest provides different fixtures for different files, based on
 * hierarchy and context. We use the current python interpreter to
 * call pytest --fixtures for each file and record the responses.
 * 
 * @param filepath
 * @returns list of fixtures prepared for the file
 */
export const getFixtures = (filepath: string) => {
    const response = spawnSync("python", ["-m", "pytest", "--fixtures", filepath]);
    return parsePytestOutputToFixtures(response.stdout.toString());
};
