import pytest

@pytest.fixture(scope="session")
def local_outer_fixture():
    """Local outer fixture"""

def test_example():
    pass
