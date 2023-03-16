# pytest-fixtures README

VSCode extension to provide intellisense for Pytest Fixtures. Inspired by [pytest-vscode](https://github.com/cameronmaske/pytest-vscode). Uses `pytest --fixtures` to get fixture information.

## Demo

![demo](demo.gif)

## Features

* Autocomplete suggestions for parameters of test functions where fixtures may be used. Includes docstrings. Context aware of different fixtures available for each file.
* Go To Definition support. Uses pytest output to determine location of fixture.
* When type ':' character after a parameter and press autocomplete keyboard shortcut, the return type of the fixture is showed if the fixture is annotated with return type.

Will first check `"python.testing.pytestPath"` for pytest, then will fallback on `python -m pytest` with the selected interpreter.

## Optional extra command line arguments for pytest to discover fixtures

In the .vscode/settings.json you can add the extra arguments and the plugin uses this args if exist.


`"pytest-fixtures.extraArguments"` is an array of string.

```json
{
    "pytest-fixtures.extraArguments": [
        "-p",
        "abc.pytest.common.bootstrap",
    ]
}
```

You can also add additional decorators used to identify fixtures


`"pytest-fixtures.additionalDecorators"` is an array of string.

```json
{
    "pytest-fixtures.additionalDecorators": [
        "pytest_asyncio.fixture",
    ]
}
```

### Experimental Features

* `"pytest-fixtures.useFileWorkspaceFolder"` toggles an improved fixture detection for multi-root workspaces.

## Snippet suggestion setting
The autocomplete items generated by this plugin are marked as snippet and they will show first if you set the 'Snippet Suggestions' setting to 'top'. See the picture below.

![snippet_suggestion_setting](snippet_suggestion_setting.png)

## Requirements

* Python
* pytest
* (Optionally) pytest-asyncio


## Known Issues

* Python extension provides a self-referential definition of function parameters so there will be two definitions, see [here](https://github.com/microsoft/vscode-python/issues/18536)
* Fixtures are provided on a per-file basis, so in-file scope is not respected for suggestions.

## Release Notes

[Change Log](CHANGELOG.md)
