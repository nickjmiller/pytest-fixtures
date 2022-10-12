import pytest


@pytest.fixture
def example_fixture():
    """Example fixture"""


@pytest.fixture
def another_example():
    """Another example fixture"""

@pytest.fixture
async def async_fixture():
    """Example async fixture"""

@pytest.fixture
def fixture_with_typing() -> str:
    """ Example fixture with typing """
    yield "Hello world"
