import pytest


def make_star(id, x, y, z, mag=2.0, color="#fff4ea", con="XXX", name=None):
    return {
        "id": id,
        "name": name or f"Star{id}",
        "coords": {"x": float(x), "y": float(y), "z": float(z)},
        "mag": float(mag),
        "color": color,
        "con": con,
    }


@pytest.fixture
def make_star_factory():
    return make_star


@pytest.fixture
def line_skeleton():
    # 4 estrelas em linha (silhueta alongada tipo serpente)
    return [
        make_star(1, 0, 0, 50, mag=1.5, con="Aaa"),
        make_star(2, 10, 0, 48, mag=2.0, con="Bbb"),
        make_star(3, 20, 0, 45, mag=2.5, con="Ccc"),
        make_star(4, 30, 0, 40, mag=3.0, con="Ddd"),
    ]
