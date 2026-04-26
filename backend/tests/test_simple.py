"""
Simple test to verify pytest is working
"""


def test_simple_addition():
    """Test basic addition"""
    assert 1 + 1 == 2


def test_simple_string():
    """Test basic string operation"""
    assert "hello" == "hello"


def test_simple_list():
    """Test basic list operation"""
    assert len([1, 2, 3]) == 3
