from app.english.domain.enums import IntegrityLevel
from app.english.proctor.gates import gates_passed, missing_gates
from app.english.proctor.integrity import score_event_list


def test_gates_passed_requires_all_true():
    gates = {
        "browser_ok": True,
        "camera_mic_ok": True,
        "screen_share_monitor": True,
        "not_extended": True,
        "fullscreen": True,
        "single_face_confirmed": True,
    }
    assert gates_passed(gates) is True
    gates["fullscreen"] = False
    assert gates_passed(gates) is False
    assert missing_gates(gates) == ["fullscreen"]


def test_score_events_green_with_no_events():
    total, level = score_event_list([])
    assert total == 0
    assert level == IntegrityLevel.GREEN


def test_score_events_amber_threshold():
    events = [{"type": "fullscreen_exit", "data": {}}] * 3  # 3 * 3 = 9 >= amber(8)
    total, level = score_event_list(events)
    assert total == 9
    assert level == IntegrityLevel.AMBER


def test_score_events_red_threshold():
    events = [{"type": "screen_token_missing", "data": {}}] * 3  # 3 * 8 = 24 >= red(20)
    total, level = score_event_list(events)
    assert level == IntegrityLevel.RED


def test_tab_hidden_scales_with_duration():
    events = [{"type": "tab_hidden", "data": {"duration_s": 25}}]  # 2 + 1*2 = 4
    total, level = score_event_list(events)
    assert total == 4
    assert level == IntegrityLevel.GREEN
