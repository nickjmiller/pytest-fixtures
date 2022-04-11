import pytest

@pytest.fixture
def local_fixture():
    """Local fixture"""

def test_example():
    pass


@pytest.mark.asyncio
async def test_async_example(async_fixture):
    pass
