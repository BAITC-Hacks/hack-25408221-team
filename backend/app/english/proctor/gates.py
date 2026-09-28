"""Module 4: check-in gates."""

REQUIRED_GATES = [
    "browser_ok",
    "camera_mic_ok",
    "screen_share_monitor",
    "not_extended",
    "fullscreen",
    "single_face_confirmed",
]


def gates_passed(gates: dict) -> bool:
    return all(gates.get(g) is True for g in REQUIRED_GATES)


def missing_gates(gates: dict) -> list[str]:
    return [g for g in REQUIRED_GATES if gates.get(g) is not True]
