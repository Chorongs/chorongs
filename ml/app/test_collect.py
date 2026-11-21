"""최신 확인 첫 쪽 받기 (collect.py peek_kinfa, peek_fss) 테스트: 외부 API 대신 가짜 session"""
import pytest

from app import collect
from app.collect import FSS_PEEK_GROUP, peek_fss, peek_kinfa

KINFA_XML = ("<response><header><resultCode>00</resultCode></header>"
             "<body><items><item><seq>101</seq><prdNm>햇살</prdNm></item><item><seq>102</seq></item></items>"
             "<totalCount>2</totalCount></body></response>").encode("utf-8")


class _FakeResp:
    def __init__(self, content=b"", data=None):
        self.content = content
        self._data = data

    def raise_for_status(self):
        pass

    def json(self):
        return self._data


class _FakeSession:
    """정해진 응답을 순서대로 돌려주고, 무엇을 요청했는지 남김"""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []

    def get(self, url, params=None, timeout=None):
        self.calls.append((url, params))
        return self.responses.pop(0)


def _fss(*months):
    return _FakeResp(data={"result": {"err_cd": "000", "max_page_no": 3,
                                      "baseList": [{"dcls_month": m} for m in months]}})


@pytest.fixture(autouse=True)
def no_delay(monkeypatch):
    monkeypatch.setattr(collect, "DELAY", 0)


def test_peek_kinfa_첫_쪽의_seq_목록을_돌려준다():
    # Given
    session = _FakeSession(_FakeResp(content=KINFA_XML))
    # When
    seqs = peek_kinfa(session)
    # Then
    assert seqs == ["101", "102"]


def test_peek_kinfa_첫_쪽_한_번만_요청한다():
    # Given
    session = _FakeSession(_FakeResp(content=KINFA_XML))
    # When
    peek_kinfa(session)
    # Then
    assert (len(session.calls), session.calls[0][1]["pageNo"]) == (1, 1)


def test_peek_kinfa_응답_코드가_00이_아니면_RuntimeError():
    # Given
    xml = b"<response><header><resultCode>99</resultCode></header><body/></response>"
    session = _FakeSession(_FakeResp(content=xml))
    # When, Then
    with pytest.raises(RuntimeError):
        peek_kinfa(session)


def test_peek_fss_4종_첫_쪽의_공시월_최댓값():
    # Given
    session = _FakeSession(_fss("202611"), _fss("202611", "202612"), _fss("202610"), _fss())
    # When
    month = peek_fss(session)
    # Then
    assert month == "202612"


def test_peek_fss_권역_020000_첫_쪽만_4번_요청한다():
    # Given
    session = _FakeSession(_fss("202611"), _fss("202611"), _fss("202611"), _fss("202611"))
    # When
    peek_fss(session)
    # Then
    assert [(p["topFinGrpNo"], p["pageNo"]) for _, p in session.calls] == [(FSS_PEEK_GROUP, 1)] * 4


def test_peek_fss_상품이_하나도_없으면_None():
    # Given
    session = _FakeSession(_fss(), _fss(), _fss(), _fss())
    # When
    month = peek_fss(session)
    # Then
    assert month is None


def test_peek_fss_오류_코드면_RuntimeError():
    # Given
    session = _FakeSession(_FakeResp(data={"result": {"err_cd": "010", "baseList": []}}))
    # When, Then
    with pytest.raises(RuntimeError):
        peek_fss(session)
