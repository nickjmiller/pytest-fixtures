import { spawnSync } from "child_process";

export interface Fixture {
    name: string;
    docstring: string;
}

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
    let lines = output.split("\n");
    const firstFixture = lines.findIndex(line => line === "" || line.startsWith("    ")) - 1;
    lines = lines.slice(firstFixture);
    const lastFixture = lines.findIndex(line => line.startsWith("==="));
    lines = lines.slice(0, lastFixture);
    let fixture: Fixture = {
        name: "",
        docstring: "",
    };
    lines.forEach(line => {
        if (line.startsWith("  ") && !line.includes("no docstring")) {
            fixture.docstring += `\n${line}`;
        } else if (line.match(/^[A-Z0-9]/i)) {
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

export const getFixtures = (filepath: string) => {
    const response = spawnSync("python", ["-m", "pytest", "--fixtures", filepath]);
    return parsePytestOutputToFixtures(response.stdout.toString());
};
