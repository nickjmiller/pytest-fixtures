# pytest-fixtures README

VSCode extension to provide intellisense for Pytest Fixtures. Inspired by [pytest-vscode](https://github.com/cameronmaske/pytest-vscode). Uses `pytest --fixtures` to get fixture information.

## Demo

![demo](demo.gif)

## Features

Autocomplete suggestions for parameters of test functions where fixtures may be used. Includes docstrings. Context aware of different fixtures available for each file.

Will first check `"python.testing.pytestPath"` for pytest, then will fallback on `python -m pytest` with the selected interpreter.

## Requirements

* Python
* pytest


## Known Issues

* Only supports autocomplete, so once the parameter is written it has no type/intellisense

## Release Notes

[Change Log](CHANGELOG.md)
