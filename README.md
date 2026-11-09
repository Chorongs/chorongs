# 캐링 (CashLink)

> 간결, 간편, 쉬운 정보! 대출, 더 이상 어렵지 않다!

대출이 처음인 사람도 쉽게 대출 정보를 찾고 비교할 수 있는 **입문용 대출 정보 포털**.
대출 상품을 판매하거나 신청, 심사를 받지 않는 순수 정보 사이트.

- 수행 기간: 2026.10.12 ~ 2026.12.07
- 상품 데이터: 서민금융진흥원 대출상품한눈에, 금융감독원 금융상품통합비교공시 오픈 API

<br>

## 주요 기능

| 기능 | 설명 |
| --- | --- |
| 맞춤 추천 | 용도, 금액, 신용 구간 등을 단계별로 입력하면 맞는 대출 상품과 추천 근거를 보여 줌 |
| 상품 찾기 | 키워드 간편 검색, 조건 상세 검색 |
| 상품 비교 | 두 상품을 골라 카드와 비교표로 나란히 비교 |
| 랭킹 | 조회순, 금리순 대출 상품 순위 |
| 계산기 | 대출 이자 계산 |
| 신용 셀프 진단 | 문항 선택으로 신용 점수 구간 진단 (학습 모델) |
| 소비 습관 | 상황별 소비 습관 추천 |
| 도움말 | 대출 용어, FAQ, 금융 팁 |
| 회원 (MY) | 카카오, 네이버 소셜 로그인 / 찜, 최근 본 상품, 검색, 비교, 추천, 계산 기록 |
| 상품 신고 | 잘못된 상품 정보 신고 (회원) |
| 관리자 | 상품 수집, 정제 반영, 신고 처리 |

<br>

## 기술 스택

| 구분 | 사용 |
| --- | --- |
| Frontend | React (Vite), JavaScript, react-router-dom, zustand, axios, styled-components |
| Backend | Java 17, Spring Boot 4, Spring Data JPA, Spring Security, Maven |
| Data / Model | Python 3.11, FastAPI, pandas, scikit-learn |
| DB | Oracle 21c XE |
| 협업 | Git, GitHub, Jira, Discord |

<br>

## 폴더 구조

```
chorongs/
├─ .github/                 PR 템플릿, Code Owners
├─ db/                      표 만들기 SQL
├─ ml/
│   ├─ app/                 FastAPI (상품 정제, 신용 진단 점수 API)
│   └─ data/
│       ├─ csv/             원본, 학습용 CSV (GitHub에 안 올림)
│       ├─ ipynb/           정제 검증, 모델 학습 노트북
│       └─ model/           학습 모델 파일 (GitHub에 안 올림)
├─ backend/                 Spring Boot
│   └─ src/main/java/chorong/
│       ├─ common/          config, dto, exception, interceptor, util, client
│       ├─ member/          회원, 소셜 로그인
│       ├─ wish/            찜
│       ├─ history/         최근 본, 최근 검색, 비교 내역
│       ├─ product/         상품 상세, 비교용 조회
│       ├─ search/          상품 찾기
│       ├─ recommend/       맞춤 추천
│       ├─ ranking/         랭킹
│       ├─ calculator/      계산 기록
│       ├─ credit/          신용 셀프 진단
│       ├─ help/            도움말
│       ├─ report/          상품 신고
│       └─ admin/           관리자 (batch/ 포함)
└─ frontend/                React (Vite)
    ├─ public/
    └─ src/
        ├─ api/             서버 요청 함수 (axios)
        ├─ store/           공용 상태 (zustand)
        ├─ styles/          GlobalStyle, 공통 스타일
        ├─ constants/       상수
        ├─ utils/           공통 함수
        ├─ assets/          icons/, images/
        ├─ components/      layout, ui, common, 기능별 폴더
        └─ pages/           주소 하나당 페이지 하나 (admin/ 관리자)
```

backend 기능 폴더 안 모양

```
{기능}/
├─ controller/
├─ dto/
├─ entity/       (search, ranking은 없음)
├─ repository/   (search, ranking은 없음)
└─ service/
```
