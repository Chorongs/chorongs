"""반영, 되돌리기 (publish.py) 테스트: DB 없이 되는 함수만 (before_data, restore_plan, publish_status, product_values, 건수)"""
import json
from datetime import datetime
from decimal import Decimal

from app.imports import to_json
from app.load import PRODUCT_COLS
from app.publish import before_data, product_values, publish_counts, publish_status, restore_plan, to_dt


def _current(**changes):
    """read_products가 돌려주는 지금 상품 1개 모양"""
    product = {c: None for c in PRODUCT_COLS}
    product.update({"product_id": 1, "product_status": "ON", "view_count": 12,
                    "source": "FSS", "source_code": "0010001_P1_1", "loan_type": "CREDIT",
                    "company_name": "가은행", "product_name": "가대출", "rate_min": Decimal("3.5"),
                    "base_date": datetime(2026, 11, 10, 0, 0), "raw_json": "{}",
                    "tags": [{"tag_type": "TARGET", "tag_value": "직장인"}],
                    "rates": [{"rate_kind": "CREDIT", "rate_key": "1", "rate_min": Decimal("3.5"),
                               "rate_max": Decimal("3.5"), "rate_source": "DISCLOSED"}]})
    product.update(changes)
    return product


# ---------- before_data ----------

def test_before_data_상품_번호와_조회수는_빼고_상태_칩_금리는_넣는다():
    # Given
    current = _current()
    # When
    data = before_data(current)
    # Then
    assert ("product_id" not in data and "view_count" not in data
            and data["product_status"] == "ON" and data["tags"] == current["tags"] and data["rates"] == current["rates"])


def test_before_data는_JSON으로_바뀌고_Decimal과_날짜가_글이_된다():
    # Given
    data = before_data(_current())
    # When
    loaded = json.loads(to_json(data))
    # Then
    assert (loaded["rate_min"], loaded["base_date"], loaded["rates"][0]["rate_min"]) == (3.5, "2026-11-10", 3.5)


# ---------- restore_plan ----------

def test_restore_plan_ADD는_CLOSED로만():
    # Given
    change_type, before = "ADD", None
    # When
    plan = restore_plan(change_type, before)
    # Then
    assert plan == {"product": {"product_status": "CLOSED"}, "tags": None, "rates": None}


def test_restore_plan_상태만_있는_기록은_상태만():
    # Given
    before = json.dumps({"product_status": "ON"})
    # When
    plan = restore_plan("HIDE", before)
    # Then
    assert plan == {"product": {"product_status": "ON"}, "tags": None, "rates": None}


def test_restore_plan_다시_게시_기록은_상태와_종료일():
    # Given
    before = json.dumps({"product_status": "CLOSED", "disclose_end": "2026-10-31"})
    # When
    plan = restore_plan("SHOW", before)
    # Then
    assert plan["product"] == {"product_status": "CLOSED", "disclose_end": datetime(2026, 10, 31)}


def test_restore_plan_반영_기록은_상품_칸_전부와_칩_금리():
    # Given
    before = to_json(before_data(_current()))
    # When
    plan = restore_plan("CHANGE", before)
    # Then
    assert (set(plan["product"]) == set(PRODUCT_COLS) | {"product_status"}
            and plan["tags"] == [{"tag_type": "TARGET", "tag_value": "직장인"}]
            and plan["rates"][0]["rate_min"] == 3.5)


def test_restore_plan_모르는_칸은_되돌리지_않는다():
    # Given
    before = json.dumps({"product_status": "ON", "product_id": 99, "view_count": 0, "tag_id": 1})
    # When
    plan = restore_plan("CHANGE", before)
    # Then
    assert plan["product"] == {"product_status": "ON"}


# ---------- product_values, to_dt ----------

def test_product_values_날짜_글은_datetime으로_나머지는_그대로():
    # Given
    data = {"base_date": "2026-11-19", "disclose_end": None, "rate_min": 3.5, "tags": [], "product_id": 1}
    # When
    values = product_values(data)
    # Then
    assert values == {"base_date": datetime(2026, 11, 19), "disclose_end": None, "rate_min": 3.5}


def test_to_dt_시각이_붙은_글도_읽는다():
    # Given
    value = "2026-11-19 00:00:00"
    # When
    result = to_dt(value)
    # Then
    assert result == datetime(2026, 11, 19)


# ---------- publish_status ----------

def test_publish_status_REMOVE는_CLOSED_REOPEN은_ON_CHANGE는_숨김_유지():
    # Given
    cases = [("REMOVE", "ON"), ("REOPEN", "CLOSED"), ("CHANGE", "HIDDEN"), ("CHANGE", "ON")]
    # When
    result = [publish_status(diff_type, status) for diff_type, status in cases]
    # Then
    assert result == ["CLOSED", "ON", "HIDDEN", "ON"]


# ---------- publish_counts ----------

def test_publish_counts_변경은_CHANGE와_REOPEN을_더하고_칩_건수를_남긴다():
    # Given
    data = {"source": "FSS", "tags": [{"tag_type": "TARGET", "tag_value": "직장인"}]}
    items = [("NEW", data), ("CHANGE", data), ("REOPEN", data), ("REMOVE", None)]
    # When
    added, changed, removed, count_json = publish_counts(items)
    # Then
    assert (added, changed, removed, json.loads(count_json)) == (
        1, 2, 1, {"diff_type": {"NEW": 1, "CHANGE": 1, "REOPEN": 1, "REMOVE": 1},
                  "source": {"FSS": 3}, "chips": {"TARGET:직장인": 3}})
