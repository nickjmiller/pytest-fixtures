import functools
import pytest

@pytest.fixture
@functools.lru_cache
def fixture_with_multiple_decorators():
    pass


class TestClass:
    def test_within_class():
        pass


def test_spanning_multiple_lines(
    
):
    pass
