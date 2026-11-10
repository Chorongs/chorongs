------------------------------------------------------------------------------------
--DROP TABLE term_request           CASCADE CONSTRAINTS PURGE;
--DROP TABLE help_question          CASCADE CONSTRAINTS PURGE;
--DROP TABLE help_stat              CASCADE CONSTRAINTS PURGE;
--DROP TABLE help_content           CASCADE CONSTRAINTS PURGE;
--DROP TABLE product_snapshot       CASCADE CONSTRAINTS PURGE;
--DROP TABLE product_update_history CASCADE CONSTRAINTS PURGE;
--DROP TABLE loan_report            CASCADE CONSTRAINTS PURGE;
--DROP TABLE recommend_result  CASCADE CONSTRAINTS PURGE;
--DROP TABLE diagnosis_report       CASCADE CONSTRAINTS PURGE;
--DROP TABLE calc_history           CASCADE CONSTRAINTS PURGE;
--DROP TABLE compare_history        CASCADE CONSTRAINTS PURGE;
--DROP TABLE search_history         CASCADE CONSTRAINTS PURGE;
--DROP TABLE recent_view            CASCADE CONSTRAINTS PURGE;
--DROP TABLE wish                   CASCADE CONSTRAINTS PURGE;
--DROP TABLE product_rate_month     CASCADE CONSTRAINTS PURGE;
--DROP TABLE product_rate           CASCADE CONSTRAINTS PURGE;
--DROP TABLE product_tag            CASCADE CONSTRAINTS PURGE;
--DROP TABLE tag                    CASCADE CONSTRAINTS PURGE;
--DROP TABLE loan_product           CASCADE CONSTRAINTS PURGE;
--DROP TABLE admin_token                  CASCADE CONSTRAINTS PURGE;
--DROP TABLE admin                  CASCADE CONSTRAINTS PURGE;
--DROP TABLE member                 CASCADE CONSTRAINTS PURGE;
--DROP SEQUENCE seq_recommend_save;
------------------------------------------------------------------------------------


-- ============================================================
-- 1. 회원 (소셜 계정 1개 = 회원 1명. 계정 통합 기능 없음)
-- ============================================================
CREATE TABLE member (
    member_id        NUMBER GENERATED ALWAYS AS IDENTITY,
    login_type       VARCHAR2(10),
    social_id        VARCHAR2(100),
    member_nickname  VARCHAR2(50 CHAR)  NOT NULL,
    birth_year       VARCHAR2(4),
    birth_day        VARCHAR2(5),
    member_status    NUMBER(1)          DEFAULT 1       NOT NULL,
    terms_agreed_at  DATE,                                                 
    created_at       DATE               DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_member            PRIMARY KEY (member_id),
    CONSTRAINT uq_member_social     UNIQUE (login_type, social_id),
    CONSTRAINT ck_member_login_type CHECK (login_type IN ('KAKAO','NAVER')),
    CONSTRAINT ck_member_status     CHECK (member_status IN (0,1)),
    -- 정상 회원은 소셜 식별값 필수, 탈퇴 회원은 둘 다 비움
    CONSTRAINT ck_member_social     CHECK (
           (member_status = 1 AND login_type IS NOT NULL AND social_id IS NOT NULL)
        OR (member_status = 0 AND login_type IS NULL     AND social_id IS NULL)
    )
);

COMMENT ON TABLE  member IS '회원 (서비스 안의 회원 정보 + 소셜 로그인 식별값). 소셜 계정 1개 = 회원 1명이며, 같은 사람이 다른 소셜로 로그인하면 별개 회원으로 취급(계정 통합 없음). 탈퇴해도 행은 남기고 member_status=0 으로 표시';
COMMENT ON COLUMN member.member_id       IS '자동 증가(IDENTITY). 회원마다 자동으로 붙는 번호표';
COMMENT ON COLUMN member.login_type      IS 'KAKAO / NAVER. 소셜 로그인 제공자. 정상 회원은 필수, 탈퇴하면 social_id와 함께 NULL. 제공자가 늘면 CHECK만 확장';
COMMENT ON COLUMN member.social_id       IS '카카오 id / 네이버 response.id. 원본 그대로 저장. unique(login_type, social_id): 같은 소셜 계정이 두 회원에 생기는 것을 막음. 탈퇴하면 NULL로 비우므로 같은 소셜 계정으로 재가입하면 새 회원 행이 만들어짐 (UNIQUE라도 NULL은 여러 개 가능)';
COMMENT ON COLUMN member.member_nickname IS '닉네임. 소셜 가입 시 카카오/네이버 닉네임, 2~12자. 탈퇴하면 "탈퇴한 회원"으로 바뀜 (화면에 그대로 보이는 값)';
COMMENT ON COLUMN member.birth_year      IS '출생연도 YYYY. 카카오: 가입 화면(약관 동의)에서 직접 입력(필수). 네이버: 네이버 제공 값(birthyear) 저장, 비어 오면 가입 화면에서 직접 입력(필수). MY에서 수정 가능. 탈퇴하면 비움. 카카오는 생년월일 동의 항목을 받을 수 없어 직접 입력 (null 허용은 그대로)';
COMMENT ON COLUMN member.birth_day       IS '생일 MM-DD 5자리. 카카오: 가입 화면에서 직접 입력(필수). 네이버: 네이버 제공 값(birthday) 저장, 비어 오면 가입 화면에서 직접 입력(필수). MY에서 수정 가능. 탈퇴하면 비움';
COMMENT ON COLUMN member.member_status   IS '탈퇴 0, 정상 1. 기본 1. 탈퇴 처리 시 status=0, 닉네임·생년·생일·login_type·social_id 비움 (식별자에 DEL_ 같은 표시를 붙이지 않음)';
COMMENT ON COLUMN member.terms_agreed_at IS '필수 약관 동의 시각. 가입 시 기록';
COMMENT ON COLUMN member.created_at      IS '가입일시 (SYSDATE)';

-- ============================================================

-- ============================================================
-- 2. 관리자 / 관리자 인증 토큰
-- ============================================================
CREATE TABLE admin (
    admin_id       NUMBER GENERATED ALWAYS AS IDENTITY,
    admin_email    VARCHAR2(320),                                           
    admin_name     VARCHAR2(40 CHAR),                                       
    admin_role     VARCHAR2(10)   DEFAULT 'MANAGER' NOT NULL,               
    admin_status   VARCHAR2(10)   DEFAULT 'PENDING' NOT NULL,               
    fail_count     NUMBER(1)      DEFAULT 0         NOT NULL,              
    locked_until   DATE,
    approved_by    NUMBER,                                                  
    requested_at   DATE           DEFAULT SYSDATE   NOT NULL,               
    approved_at    DATE,                                                   
    last_login_at  DATE,                                                   
    removed_at     DATE,                                                    
    CONSTRAINT pk_admin          PRIMARY KEY (admin_id),
    CONSTRAINT uq_admin_email    UNIQUE (admin_email),
    CONSTRAINT ck_admin_role     CHECK (admin_role IN ('APPROVER','MANAGER')),
    CONSTRAINT ck_admin_status   CHECK (admin_status IN ('PENDING','ACTIVE','REMOVED')),
    CONSTRAINT ck_admin_fail     CHECK (fail_count BETWEEN 0 AND 5),
    CONSTRAINT fk_admin_approver FOREIGN KEY (approved_by) REFERENCES admin (admin_id)
);

COMMENT ON TABLE  admin IS '관리자 계정. 가입 신청 → 승인권자 승인. 관리자가 0명이면 첫 가입자가 자동으로 승인권자가 됨';
COMMENT ON COLUMN admin.admin_id      IS '자동 증가(IDENTITY)';
COMMENT ON COLUMN admin.admin_email   IS '토큰을 받을 이메일. unique. 탈퇴하면 비움(NULL) - unique라도 NULL은 여러 개 가능';
COMMENT ON COLUMN admin.admin_name    IS '화면에 표시하는 이름';
COMMENT ON COLUMN admin.admin_role    IS 'APPROVER 승인권자 / MANAGER 관리자. 기본 MANAGER';
COMMENT ON COLUMN admin.admin_status  IS 'PENDING 승인 대기 / ACTIVE 정상 / REMOVED 탈퇴. 기본 PENDING. 잠김은 상태가 아니라 locked_until 로 판단';
COMMENT ON COLUMN admin.fail_count    IS '로그인 토큰 연속 실패 횟수. 기본 0. 관리자 단위로 5회 실패 → 30분 잠금. 토큰을 새로 받아도 이어져야 하므로 token이 아니라 여기에 둠';
COMMENT ON COLUMN admin.locked_until  IS '5회 실패 시 잠금 해제 시각(실패 시점 + 30분). 이 시각 전이면 로그인 거부 (응답 423)';
COMMENT ON COLUMN admin.approved_by   IS '승인한 승인권자 (admin.admin_id). 첫 가입자(자동 승인)는 NULL';
COMMENT ON COLUMN admin.requested_at  IS '가입 신청 일시. 승인 대기 14일 자동 삭제 계산용';
COMMENT ON COLUMN admin.approved_at   IS '승인 일시';
COMMENT ON COLUMN admin.last_login_at IS '마지막 로그인 일시';
COMMENT ON COLUMN admin.removed_at    IS '탈퇴 일시';

CREATE TABLE admin_token (
    token_id       NUMBER GENERATED ALWAYS AS IDENTITY,
    admin_id       NUMBER        NOT NULL,
    token_hash     VARCHAR2(64)  NOT NULL,
    used_yn        CHAR(1)       DEFAULT 'N'     NOT NULL,
    token_history  DATE          DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_token        PRIMARY KEY (token_id),
    CONSTRAINT ck_token_used   CHECK (used_yn IN ('Y','N')),
    CONSTRAINT fk_token_admin  FOREIGN KEY (admin_id) REFERENCES admin (admin_id)
);

COMMENT ON TABLE  admin_token IS '관리자 로그인 토큰';
COMMENT ON COLUMN admin_token.token_id      IS '자동 증가(IDENTITY)';
COMMENT ON COLUMN admin_token.admin_id      IS '어느 관리자의 토큰인지 (admin.admin_id)';
COMMENT ON COLUMN admin_token.token_hash    IS '이메일로 보낸 6자리 숫자를 저장하지 않고 SHA-256(16진수 64자)으로 바꿔 저장';
COMMENT ON COLUMN admin_token.used_yn       IS 'Y/N. 기본 N. 로그인에 한 번 쓰면 Y (다시 못 씀)';
COMMENT ON COLUMN admin_token.token_history IS '발급일시 (SYSDATE). 2시간 후 만료';
-- ============================================================

-- ============================================================
-- 3. 대출 상품 / 태그 / 상품 태그 / 상품 금리
-- ============================================================
CREATE TABLE loan_product (
    product_id         NUMBER GENERATED ALWAYS AS IDENTITY,
    source             VARCHAR2(10)        NOT NULL,
    source_code        VARCHAR2(60)        NOT NULL,
    company_name       VARCHAR2(100 CHAR)  NOT NULL,
    product_name       VARCHAR2(200 CHAR)  NOT NULL,
    loan_type          VARCHAR2(10)        NOT NULL,                        
    rate_min           NUMBER(5,2),
    rate_max           NUMBER(5,2),
    limit_amount       NUMBER(10),
    term_max           NUMBER(4),
    credit_min         NUMBER(4),                                           
    credit_max         NUMBER(4),                                           
    age_min            NUMBER(3),                                           
    age_max            NUMBER(3),                                          
    income_min         NUMBER(6),                                          
    income_max         NUMBER(6),                                       
    income_basis       VARCHAR2(10),                                        
    income_note        VARCHAR2(500 CHAR),                                  
    prepay_fee_max     NUMBER(5,2),                                         
    no_prepay_fee_yn   CHAR(1),                                             
    online_yn          CHAR(1),                                          
    policy_yn          CHAR(1),                                       
    rate_type          VARCHAR2(10),                                       
    extra_cond         VARCHAR2(1000 CHAR),                                 
    target_detail      VARCHAR2(100 CHAR),                                 
    note               VARCHAR2(1000 CHAR),
    raw_json           CLOB,                                              
    view_count         NUMBER              DEFAULT 0    NOT NULL,
    base_date          DATE                NOT NULL,
    disclose_start     DATE,                                              
    disclose_end       DATE,                                                
    product_status     VARCHAR2(10)        DEFAULT 'ON' NOT NULL,           
    CONSTRAINT pk_loan_product     PRIMARY KEY (product_id),
    CONSTRAINT uq_loan_source_code UNIQUE (source, loan_type, source_code), 
    CONSTRAINT ck_loan_source      CHECK (source IN ('KINFA','FSS')),
    CONSTRAINT ck_loan_type        CHECK (loan_type IN ('CREDIT','RENT','MORTGAGE','BIZ','KINFA')),
    CONSTRAINT ck_loan_status      CHECK (product_status IN ('ON','CLOSED','HIDDEN')),
    CONSTRAINT ck_loan_rate        CHECK (rate_min IS NULL OR rate_max IS NULL OR rate_min <= rate_max),
    CONSTRAINT ck_loan_credit      CHECK (    (credit_min IS NULL OR credit_min BETWEEN 0 AND 1000)
                                          AND (credit_max IS NULL OR credit_max BETWEEN 0 AND 1000)
                                          AND (credit_min IS NULL OR credit_max IS NULL OR credit_min <= credit_max)),
    CONSTRAINT ck_loan_age         CHECK (age_min IS NULL OR age_max IS NULL OR age_min <= age_max),
    CONSTRAINT ck_loan_income      CHECK (income_min IS NULL OR income_max IS NULL OR income_min <= income_max),
    CONSTRAINT ck_loan_inc_basis   CHECK (income_basis IN ('SELF','COUPLE','OTHER')),
    CONSTRAINT ck_loan_prepay      CHECK (prepay_fee_max IS NULL OR prepay_fee_max >= 0),
    CONSTRAINT ck_loan_noprepay    CHECK (no_prepay_fee_yn IN ('Y','N')),
    CONSTRAINT ck_loan_online      CHECK (online_yn IN ('Y','N')),
    CONSTRAINT ck_loan_policy      CHECK (policy_yn IN ('Y','N')),
    CONSTRAINT ck_loan_rate_type   CHECK (rate_type IN ('FIXED','VARIABLE','BOTH')),
    CONSTRAINT ck_loan_view_cnt    CHECK (view_count >= 0)
);

COMMENT ON TABLE  loan_product IS '대출 상품 (서민금융진흥원 + 금융감독원 통합)';
COMMENT ON COLUMN loan_product.product_id       IS '자동 증가(IDENTITY). 다른 표에서 이 번호로 상품을 가리켜요';
COMMENT ON COLUMN loan_product.source           IS 'KINFA 서민금융진흥원 / FSS 금융감독원';
COMMENT ON COLUMN loan_product.source_code      IS 'KINFA는 seq, FSS는 fin_co_no || ''_'' || fin_prdt_cd (사이 _ 필수). FSS 개인신용은 뒤에 ''_'' || crdt_prdt_type 추가(같은 상품코드가 마이너스한도/카드론으로 나뉘는 경우 1개). 신협 묶음은 032000 + 상품명. 최대 약 40자. unique(source, loan_type, source_code). 다시 불러올 때 같은 상품인지 가르는 열쇠';
COMMENT ON COLUMN loan_product.company_name     IS 'KINFA ofrinstnm / FSS kor_co_nm';
COMMENT ON COLUMN loan_product.product_name     IS 'KINFA finprdnm / FSS fin_prdt_nm';
COMMENT ON COLUMN loan_product.loan_type        IS '대출 종류 코드. CREDIT 신용 / RENT 전세 / MORTGAGE 주택담보 / BIZ 개인사업자 / KINFA 서민금융 (랭킹 대출 종류 필터, 추천 상품 종류별 규칙에 사용)';
COMMENT ON COLUMN loan_product.rate_min         IS '연 %. 숫자로 안 바뀌는 값은 note에 원문 보관';
COMMENT ON COLUMN loan_product.rate_max         IS '연 %. 최저금리보다 작을 수 없음';
COMMENT ON COLUMN loan_product.limit_amount     IS '한도. 만원';
COMMENT ON COLUMN loan_product.term_max         IS '최대 기간. 개월 (원본이 년이면 x12)';
COMMENT ON COLUMN loan_product.credit_min       IS '이 상품을 쓸 수 있는 신용점수 하한. NICE 0~1000. 추천에서 신용 걸러내기에 사용 (KINFA crdtsc 등). 없으면 NULL';
COMMENT ON COLUMN loan_product.credit_max       IS '이 상품을 쓸 수 있는 신용점수 상한. NICE 0~1000. 없으면 NULL';
COMMENT ON COLUMN loan_product.age_min          IS '가입 가능 최소 나이. 추천에서 나이 걸러내기에 사용. 없으면 NULL';
COMMENT ON COLUMN loan_product.age_max          IS '가입 가능 최대 나이. 없으면 NULL';
COMMENT ON COLUMN loan_product.income_min       IS '소득 하한. 연 만원. 없으면 NULL';
COMMENT ON COLUMN loan_product.income_max       IS '소득 상한(구 income_limit). 연 만원. 추천에서 소득 걸러내기에 사용. 없으면 NULL';
COMMENT ON COLUMN loan_product.income_basis     IS 'NULL 조건 없음 / SELF 본인 / COUPLE 부부합산 / OTHER 숫자 없는 조건(중위소득, 수급자 등). OTHER면 추천 화면에 ''소득 조건 있음'' 주의 표시';
COMMENT ON COLUMN loan_product.income_note      IS '소득 조건 원문. 추천 근거 문구, 상품 상세 화면에 사용';
COMMENT ON COLUMN loan_product.prepay_fee_max   IS '가장 높은 중도상환수수료율 %. 0 = 수수료 없음 / NULL = 정보 없음. 비교, 랭킹 1~3위 카드(''최대 N%'')에 사용. 주의: 다른 칸의 "금융감독원 0 = 값 없음 → NULL" 정제 규칙과 섞지 말 것 (섞으면 불러올 때마다 ''변경''으로 잘못 잡힘)';
COMMENT ON COLUMN loan_product.no_prepay_fee_yn IS 'Y 중도상환수수료 없음 / N 있음 / NULL 정보 없음. prepay_fee_max와 같이 채움. 우선순위 점수, 상품 특징 태그에 사용';
COMMENT ON COLUMN loan_product.online_yn        IS 'Y/N/NULL. 비대면 신청 가능 여부. 추천 우선순위 점수, 특징 태그에 사용';
COMMENT ON COLUMN loan_product.policy_yn        IS 'Y/N/NULL. 정부·서민 지원 상품 여부. 추천 우선순위 점수, 특징 태그에 사용';
COMMENT ON COLUMN loan_product.rate_type        IS 'FIXED 고정 / VARIABLE 변동 / BOTH 둘 다 / NULL 정보 없음. 상품이 어떤 금리 방식을 주는지 요약 (방식별 금리 숫자는 product_rate의 RATE_TYPE). 특징 필터에 사용';
COMMENT ON COLUMN loan_product.extra_cond IS '세대 조건만 저장. 세부 지원 조건 원문은 raw_json에서 확인. 추천 화면 ''추가 조건'' 주의는 세대 조건만으로 판단 (원문까지 넣으면 거의 모든 상품이 주의로 잡힘)';
COMMENT ON COLUMN loan_product.target_detail    IS '특별 지원 대상 세부 값. 추천에서 지원 대상 판단에 사용';
COMMENT ON COLUMN loan_product.note             IS '''은행별 상이''처럼 숫자로 못 바꾼 원문을 그대로 두는 칸';
COMMENT ON COLUMN loan_product.raw_json         IS '원본 행 그대로(JSON). 관리자 확인, 상품 상세 화면, 다시 정제할 때 사용';
COMMENT ON COLUMN loan_product.view_count       IS '기본 0. 상세를 열 때마다 +1 (인기순 랭킹). 회원 탈퇴 뒤에도 남음';
COMMENT ON COLUMN loan_product.base_date        IS '공시 기준 시점. 화면에 표시';
COMMENT ON COLUMN loan_product.disclose_start   IS '공시 시작일. 없으면 NULL';
COMMENT ON COLUMN loan_product.disclose_end     IS '공시 종료일. 지나면 매일 자동 내림(CLOSED) 대상. 없으면 NULL';
COMMENT ON COLUMN loan_product.product_status   IS 'ON 게시 / CLOSED 판매 종료 / HIDDEN 숨김. 기본 ON. 관리자(숨김·내림), 신고(자동 숨김), MY(''판매 종료'' 표시)에 사용. ON이 아니면 목록·검색에서 제외';

CREATE TABLE tag (
    tag_id      NUMBER GENERATED ALWAYS AS IDENTITY,
    tag_type    VARCHAR2(10)        NOT NULL,
    tag_value   VARCHAR2(100 CHAR)  NOT NULL,
    CONSTRAINT pk_tag        PRIMARY KEY (tag_id),
    CONSTRAINT uq_tag        UNIQUE (tag_type, tag_value),
    CONSTRAINT ck_tag_type   CHECK (tag_type IN ('TARGET','PURPOSE','AMOUNT','REPAY','SECTOR','COMPANY','REGION','CREDIT')),
    CONSTRAINT ck_tag_target CHECK (tag_type <> 'TARGET' OR tag_value IN ('제한 없음','저신용/서민','직장인','사업자','청년/학생','특별 지원 대상','기타'))
);

COMMENT ON TABLE  tag IS '필터 칩 마스터. (tag_type, tag_value) 조합을 1번만 저장하고 상품과의 연결은 product_tag가 담당. 필터 8개 전용이며 상품 특징은 loan_product 칸에서 서버가 변환해 내려줌. 칩 목록은 이 표에서 가져오되, 건수 0인 칩이 나오지 않도록 product_tag와 조인해 1건 이상인 것만 노출';
COMMENT ON COLUMN tag.tag_id    IS '자동 증가(IDENTITY). product_tag가 이 번호로 태그를 가리켜요';
COMMENT ON COLUMN tag.tag_type  IS '필터 코드. TARGET 지원 대상 / PURPOSE 자금 용도 / AMOUNT 필요 금액 / REPAY 상환 방법 / SECTOR 금융권(세분류만 저장, 상세 규칙은 tag_value 참고) / COMPANY 신청처 묶음 / REGION 지원 지역 / CREDIT 신용점수 구간. FEATURE는 삭제(같은 정보를 칸과 태그 두 곳에 쓰면 불러오기·되돌리기 때 어긋나서)';
COMMENT ON COLUMN tag.tag_value IS '필터 값 (칸 크기 100자는 그대로).
unique(tag_type, tag_value): 같은 값은 한 번만 만들고 여러 상품이 product_tag로 공유.
값이 없으면 그 필터 태그는 만들지 않음. ''제한 없음'', ''전국'', ''신용 무관''도 1개.
값 표기는 칩 목록·검색 조건 비교·저장 모두 아래와 글자 그대로 같아야 함 (공백·특수문자 포함).
값 하나 안에서 나눌 때는 쉼표 대신 슬래시 사용 (검색 주소는 여러 값을 쉼표로 묶어 보내므로 값 안에 쉼표가 있으면 깨짐).
아래 값 목록은 실데이터 정제 결과 기준.
[TARGET 확정, CHECK로 강제] 제한 없음 / 저신용/서민 / 직장인 / 사업자 / 청년/학생 / 특별 지원 대상 / 기타 (구분은 슬래시 /, 가운뎃점 사용 안 함).
간편 검색 매핑: 사회초년생=직장인+청년/학생, 자영업자=사업자.
[PURPOSE] 생활비 / 전월세 / 학자금 / 주택 구입 / 대환 / 창업 / 사업 운영 / 기타. 의료비는 상품 0개라 뺌. 전월세와 주택 구입, 창업과 사업 운영은 비교 화면에서 나눠 보여야 해서 분리.
[AMOUNT] 1천만원 미만 / 1천만원 이상 / 3천만원 이상 / 5천만원 이상 / 1억원 이상 / 담보/보증 비율 / 한도 제한 없음 / 매출/실비 기준 / 심사 후 결정. 한도가 그 금액 이상인 누적 칩(1천만원 이상 안에 3천만원 이상 상품도 포함). 숫자 기준은 loan_product.limit_amount(만원). 한도 숫자가 없는 상품(584개)도 필터에서 빠지지 않도록 뒤의 4개 칩(담보/보증 비율·한도 제한 없음·매출/실비 기준·심사 후 결정)에 연결.
[REPAY] 원리금균등 / 원금균등 / 만기일시 / 분할상환(방식 미표기) / 기타. 마이너스한도는 상환 방법이 아니라 상품 유형이라 뺌. 금융감독원 전세, 주택담보대출의 분할상환 코드는 ''분할상환(방식 미표기)''로 연결.
[SECTOR] 시중은행 / 지방은행 / 특수은행 / 인터넷은행 / 저축은행 / 캐피탈 / 생명보험 / 신협 / 카드사 / 손해보험 / 신용보증재단 / 서민금융기관 / 공공기관 / 지자체 / 협약 금융회사 / 복지기관 / 기타. 세분류만 저장하고 한 상품에 여러 개 연결 가능.
화면에서는 은행권 / 비은행권 / 정책금융 3묶음 아래에 세부 칩으로 보여줌. 대분류는 저장하지 않고 서버 상수로 보유.
loan_product.company_type을 삭제했으므로 금융권 필터(랭킹 포함)는 이 SECTOR 태그로 판별. 취급기관으로 정해지며 불러올 때마다 다시 계산해 덮어씀.
[COMPANY] 신청처 묶음: 은행 / 공공기관 / 서민금융센터/미소금융 / 저축은행 / 신협/새마을금고 / 카드사 / 캐피탈 / 보험사 / 신용보증재단 / 지자체 / 기타. 원문 그대로 칩으로 만들면 수백 개라 묶음으로 저장. 제공기관 원문은 loan_product.company_name에 따로 있음.
[REGION] 전국 또는 시·도 약칭(서울, 부산, 대구, 인천, 광주, 대전, 울산, 세종, 경기, 강원, 충북, 충남, 전북, 전남, 경북, 경남, 제주).
[CREDIT] 신용 무관 / 900 초과 / 801~900 / 701~800 / 601~700 / 600 이하 / 심사 후 결정. 구간 값 5개는 diagnosis_report.credit_band BAND1~5와 같은 구간. 신용 구간 공시가 없는 담보·보증 상품(936개)은 ''심사 후 결정''에 연결.';

CREATE TABLE product_tag (
    pt_id       NUMBER GENERATED ALWAYS AS IDENTITY,
    tag_id      NUMBER  NOT NULL,
    product_id  NUMBER  NOT NULL,
    CONSTRAINT pk_product_tag  PRIMARY KEY (pt_id),
    CONSTRAINT uq_product_tag  UNIQUE (product_id, tag_id),
    CONSTRAINT fk_pt_tag       FOREIGN KEY (tag_id)     REFERENCES tag (tag_id),
    CONSTRAINT fk_pt_product   FOREIGN KEY (product_id) REFERENCES loan_product (product_id)
);

CREATE INDEX idx_product_tag_lookup ON product_tag (tag_id, product_id);

COMMENT ON TABLE  product_tag IS '상품-태그 매핑 (상품 1개에 태그 여러 개, 태그 1개에 상품 여러 개). 값 자체는 tag에 있고 여기엔 연결만 저장. 칩으로 상품 찾기·칩별 건수 집계는 idx_product_tag_lookup(tag_id, product_id) 사용 (uq_product_tag는 product_id가 먼저라 이 용도로 못 씀)';
COMMENT ON COLUMN product_tag.pt_id      IS '자동 증가(IDENTITY)';
COMMENT ON COLUMN product_tag.tag_id     IS '어떤 태그인지 (tag.tag_id). 지원 대상·지역 같은 값은 tag에서 조인해서 가져옴';
COMMENT ON COLUMN product_tag.product_id IS '어느 상품에 붙은 태그인지 (loan_product.product_id). unique(product_id, tag_id): 같은 상품에 같은 태그 두 번 불가';

CREATE TABLE product_rate (
    rate_id      NUMBER GENERATED ALWAYS AS IDENTITY,
    product_id   NUMBER        NOT NULL,
    rate_kind    VARCHAR2(10)  NOT NULL,
    rate_key     VARCHAR2(30)  NOT NULL,
    rate_min     NUMBER(5,2),
    rate_max     NUMBER(5,2),
    rate_source  VARCHAR2(10)  NOT NULL,
    CONSTRAINT pk_product_rate    PRIMARY KEY (rate_id),
    CONSTRAINT uq_product_rate    UNIQUE (product_id, rate_kind, rate_key),
    CONSTRAINT ck_prate_kind      CHECK (rate_kind IN ('CREDIT','REPAY','RATE_TYPE')),
    CONSTRAINT ck_prate_source    CHECK (rate_source IN ('DISCLOSED','ESTIMATED')),
    CONSTRAINT ck_prate_range     CHECK (rate_min IS NULL OR rate_max IS NULL OR rate_min <= rate_max),
    CONSTRAINT fk_prate_product   FOREIGN KEY (product_id) REFERENCES loan_product (product_id)
);

COMMENT ON TABLE  product_rate IS '상품별 구간 금리 (최신 월만 보관). 추천(예상 금리), 상품 상세(신용 구간별 금리)에 사용. 금융감독원 API는 상품 1개에 금리 줄이 여러 개라 loan_product의 rate_min/max만으로 부족';
COMMENT ON COLUMN product_rate.rate_id     IS '자동 증가(IDENTITY)';
COMMENT ON COLUMN product_rate.product_id  IS '어느 상품의 금리인지';
COMMENT ON COLUMN product_rate.rate_kind   IS 'CREDIT 신용 구간 / REPAY 상환 방식 / RATE_TYPE 금리 방식';
COMMENT ON COLUMN product_rate.rate_key IS '구간·방식 값. rate_kind=CREDIT이면 금융감독원 신용 등급 코드 그대로(1, 4, 5, 6, 10, 11, 12, 13). 화면의 신용점수 구간(900 초과 ~ 600 이하)으로 바꾸는 것은 서버가 처리';
COMMENT ON COLUMN product_rate.rate_min    IS '최저 금리 연 %';
COMMENT ON COLUMN product_rate.rate_max    IS '최고 금리 연 %';
COMMENT ON COLUMN product_rate.rate_source IS 'DISCLOSED 공시 / ESTIMATED 추정 (빈 구간을 이웃 구간 값으로 채운 경우)';

CREATE TABLE product_rate_month (
    rate_month_id  NUMBER GENERATED ALWAYS AS IDENTITY,
    dcls_month     VARCHAR2(6)   NOT NULL,
    product_id     NUMBER        NOT NULL,
    rate_kind      VARCHAR2(10)  NOT NULL,
    rate_key       VARCHAR2(30)  NOT NULL,
    rate_min       NUMBER(5,2),
    rate_max       NUMBER(5,2),
    rate_source    VARCHAR2(10)  NOT NULL,
    CONSTRAINT pk_product_rate_month  PRIMARY KEY (rate_month_id),
    CONSTRAINT uq_prate_month         UNIQUE (dcls_month, product_id, rate_kind, rate_key),
    CONSTRAINT ck_prm_month           CHECK (REGEXP_LIKE(dcls_month, '^[0-9]{6}$')),
    CONSTRAINT ck_prm_kind            CHECK (rate_kind IN ('CREDIT','REPAY','RATE_TYPE')),
    CONSTRAINT ck_prm_source          CHECK (rate_source IN ('DISCLOSED','ESTIMATED')),
    CONSTRAINT ck_prm_range           CHECK (rate_min IS NULL OR rate_max IS NULL OR rate_min <= rate_max),
    CONSTRAINT fk_prm_product         FOREIGN KEY (product_id) REFERENCES loan_product (product_id)
);

COMMENT ON TABLE  product_rate_month IS '월별 금리 누적. 상품 불러오기(관리자) 때 쌓음. 화면 사용은 2차. 한 달 약 2,000행. 금융감독원 API가 지난 달 값을 주지 않아 첫 적재부터 쌓아야 함';
COMMENT ON COLUMN product_rate_month.rate_month_id IS '자동 증가(IDENTITY)';
COMMENT ON COLUMN product_rate_month.dcls_month    IS '공시 월 YYYYMM';
COMMENT ON COLUMN product_rate_month.product_id    IS '어느 상품의 금리인지';
COMMENT ON COLUMN product_rate_month.rate_kind     IS 'product_rate와 같음. CREDIT / REPAY / RATE_TYPE';
COMMENT ON COLUMN product_rate_month.rate_key      IS 'product_rate와 같음';
COMMENT ON COLUMN product_rate_month.rate_min      IS '최저 금리 연 %';
COMMENT ON COLUMN product_rate_month.rate_max      IS '최고 금리 연 %';
COMMENT ON COLUMN product_rate_month.rate_source   IS 'DISCLOSED 공시 / ESTIMATED 추정';
-- ============================================================

-- ============================================================
-- 4. 회원 기록 (찜 / 최근 본 / 최근 검색 / 비교 / 계산 / 진단 / 추천 결과)
--    회원 탈퇴 시 이 표들의 기록은 모두 삭제해요 (member 행은 남김)
--    보관 개수 제한(찜 30, 나머지 10)은 앱 로직
-- ============================================================
CREATE TABLE wish (
    wish_id     NUMBER GENERATED ALWAYS AS IDENTITY,
    member_id   NUMBER  NOT NULL,
    product_id  NUMBER  NOT NULL,
    created_at  DATE    DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_wish          PRIMARY KEY (wish_id),
    CONSTRAINT uq_wish          UNIQUE (member_id, product_id),
    CONSTRAINT fk_wish_member   FOREIGN KEY (member_id)  REFERENCES member (member_id),
    CONSTRAINT fk_wish_product  FOREIGN KEY (product_id) REFERENCES loan_product (product_id)
);

COMMENT ON TABLE  wish IS '찜한 상품. 회원당 최대 30개 (가득 차면 새로 찜 불가)';
COMMENT ON COLUMN wish.wish_id    IS '자동 증가(IDENTITY)';
COMMENT ON COLUMN wish.member_id  IS '누가 찜했는지';
COMMENT ON COLUMN wish.product_id IS '어떤 상품을 찜했는지. unique(member_id, product_id) 같은 상품 두 번 찜 불가 (409)';
COMMENT ON COLUMN wish.created_at IS '찜한 일시 (SYSDATE)';

CREATE TABLE recent_view (
    view_id     NUMBER GENERATED ALWAYS AS IDENTITY,
    member_id   NUMBER  NOT NULL,
    product_id  NUMBER  NOT NULL,
    viewed_at   DATE    DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_recent_view     PRIMARY KEY (view_id),
    CONSTRAINT uq_recent_view     UNIQUE (member_id, product_id),
    CONSTRAINT fk_recent_member   FOREIGN KEY (member_id)  REFERENCES member (member_id),
    CONSTRAINT fk_recent_product  FOREIGN KEY (product_id) REFERENCES loan_product (product_id)
);

COMMENT ON TABLE  recent_view IS '최근 본 상품 (회원당 최근 10개)';
COMMENT ON COLUMN recent_view.view_id    IS '자동 증가(IDENTITY)';
COMMENT ON COLUMN recent_view.member_id  IS '누가 봤는지';
COMMENT ON COLUMN recent_view.product_id IS '어떤 상품을 봤는지. unique(member_id, product_id)';
COMMENT ON COLUMN recent_view.viewed_at  IS 'SYSDATE. 다시 보면 갱신 (MERGE 사용). 10개 넘으면 오래된 것 삭제';

CREATE TABLE search_history (
    search_id         NUMBER GENERATED ALWAYS AS IDENTITY,
    member_id         NUMBER              NOT NULL,
    search_type       VARCHAR2(10)        NOT NULL,
    search_label      VARCHAR2(200 CHAR)  NOT NULL,
    search_condition  CLOB                NOT NULL,
    searched_at       DATE                DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_search_history  PRIMARY KEY (search_id),
    CONSTRAINT uq_search_label    UNIQUE (member_id, search_label),
    CONSTRAINT ck_search_type     CHECK (search_type IN ('FILTER','SIMPLE')),
    CONSTRAINT fk_search_member   FOREIGN KEY (member_id) REFERENCES member (member_id)
);

COMMENT ON TABLE  search_history IS '최근 검색 (회원당 최근 10개)';
COMMENT ON COLUMN search_history.search_id        IS '자동 증가(IDENTITY)';
COMMENT ON COLUMN search_history.member_id        IS '누가 검색했는지';
COMMENT ON COLUMN search_history.search_type      IS 'FILTER 필터 검색 / 간편 검색. 추천 입력은 저장하지 않아요';
COMMENT ON COLUMN search_history.search_label     IS '화면에 보이는 문구. 예: 근로자 · 생활비 · 신용. 같은 문구면 시각만 갱신 (member_id와 함께 unique)';
COMMENT ON COLUMN search_history.search_condition IS '다시 검색할 때 쓰는 조건을 JSON으로 통째로 저장';
COMMENT ON COLUMN search_history.searched_at      IS '검색일시 (SYSDATE). 회원당 최근 10개 유지, 넘으면 오래된 것 삭제';

CREATE TABLE compare_history (
    compare_id    NUMBER GENERATED ALWAYS AS IDENTITY,
    member_id     NUMBER  NOT NULL,
    product_a_id  NUMBER  NOT NULL,
    product_b_id  NUMBER  NOT NULL,
    compared_at   DATE    DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_compare_history PRIMARY KEY (compare_id),
    CONSTRAINT uq_compare_pair    UNIQUE (member_id, product_a_id, product_b_id),
    CONSTRAINT ck_cmp_order       CHECK (product_a_id < product_b_id),
    CONSTRAINT fk_cmp_member      FOREIGN KEY (member_id)    REFERENCES member (member_id),
    CONSTRAINT fk_cmp_product_a   FOREIGN KEY (product_a_id) REFERENCES loan_product (product_id),
    CONSTRAINT fk_cmp_product_b   FOREIGN KEY (product_b_id) REFERENCES loan_product (product_id)
);

COMMENT ON TABLE  compare_history IS '상품 비교 이력 (회원당 최근 10개)';
COMMENT ON COLUMN compare_history.compare_id   IS '자동 증가(IDENTITY)';
COMMENT ON COLUMN compare_history.member_id    IS '누가 비교했는지';
COMMENT ON COLUMN compare_history.product_a_id IS '두 상품 중 번호가 작은 쪽. 서비스에서 작은 번호를 A에 넣어서 저장';
COMMENT ON COLUMN compare_history.product_b_id IS '두 상품 중 번호가 큰 쪽. A와 같은 상품 불가. 순서를 바꿔 비교해도 한 건으로 취급 (시각만 갱신)';
COMMENT ON COLUMN compare_history.compared_at  IS '비교일시 (SYSDATE)';

CREATE TABLE calc_history (
    calc_id         NUMBER GENERATED ALWAYS AS IDENTITY,
    member_id       NUMBER         NOT NULL,
    loan_amount     NUMBER(10)     NOT NULL,
    loan_months     NUMBER(4)      NOT NULL,
    interest_rate   NUMBER(5,2)    NOT NULL,
    repay_method    VARCHAR2(20)   NOT NULL,
    grace_months    NUMBER(4)      DEFAULT 0 NOT NULL,
    total_interest  NUMBER(15)     NOT NULL,
    first_payment   NUMBER(15)     NOT NULL,
    calc_at         DATE           DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_calc_history  PRIMARY KEY (calc_id),
    CONSTRAINT ck_calc_repay    CHECK (repay_method IN ('EQUAL_PI','EQUAL_P','BULLET','GRADUATED')),
    CONSTRAINT ck_calc_positive CHECK (loan_amount > 0 AND loan_months > 0 AND interest_rate >= 0 AND grace_months >= 0),
    CONSTRAINT fk_calc_member   FOREIGN KEY (member_id) REFERENCES member (member_id)
);

COMMENT ON TABLE  calc_history IS '이자 계산 이력 (회원당 최근 10개)';
COMMENT ON COLUMN calc_history.calc_id        IS '자동 증가(IDENTITY)';
COMMENT ON COLUMN calc_history.member_id      IS '누가 계산했는지';
COMMENT ON COLUMN calc_history.loan_amount    IS '대출금액. 원';
COMMENT ON COLUMN calc_history.loan_months    IS '대출기간. 개월';
COMMENT ON COLUMN calc_history.interest_rate  IS '연 %';
COMMENT ON COLUMN calc_history.repay_method   IS 'EQUAL_PI 원리금균등 / EQUAL_P 원금균등 / BULLET 만기일시 / GRADUATED 체증식 (화면 글자는 서비스에서 바꿈)';
COMMENT ON COLUMN calc_history.grace_months   IS '기본 0. 거치기간 (이자만 내는 기간). 개월';
COMMENT ON COLUMN calc_history.total_interest IS '총 이자. 원';
COMMENT ON COLUMN calc_history.first_payment  IS '첫 달 납부액. 원';
COMMENT ON COLUMN calc_history.calc_at        IS '계산일시 (SYSDATE)';

CREATE TABLE diagnosis_report (
    report_id    NUMBER GENERATED ALWAYS AS IDENTITY,
    member_id    NUMBER        NOT NULL,
    report_type  VARCHAR2(10)  DEFAULT 'CREDIT' NOT NULL,
    credit_band  VARCHAR2(10)  NOT NULL,
    created_at   DATE          DEFAULT SYSDATE  NOT NULL,
    CONSTRAINT pk_diagnosis_report PRIMARY KEY (report_id),
    CONSTRAINT uq_diag_member      UNIQUE (member_id),                      
    CONSTRAINT ck_diag_type        CHECK (report_type IN ('CREDIT')),
    CONSTRAINT ck_diag_band        CHECK (credit_band IN ('BAND1','BAND2','BAND3','BAND4','BAND5')),
    CONSTRAINT fk_diag_member      FOREIGN KEY (member_id) REFERENCES member (member_id)
);

COMMENT ON TABLE  diagnosis_report IS '신용 진단 최신 결과 (회원당 1개만 보관. 설문 답변은 저장하지 않고 구간 + 시각만). 다시 진단하면 덮어씀';
COMMENT ON COLUMN diagnosis_report.report_id   IS '자동 증가(IDENTITY)';
COMMENT ON COLUMN diagnosis_report.member_id   IS '누구의 진단 결과인지. unique(member_id)';
COMMENT ON COLUMN diagnosis_report.report_type IS 'CREDIT 신용 진단만 (소비 습관은 저장 안 함). 기본 CREDIT';
COMMENT ON COLUMN diagnosis_report.credit_band IS 'BAND1 900 초과 / BAND2 801~900 / BAND3 701~800 / BAND4 601~700 / BAND5 600 이하 (반개념 구간)';
COMMENT ON COLUMN diagnosis_report.created_at  IS '진단일시 (SYSDATE)';

CREATE SEQUENCE seq_recommend_save START WITH 1 INCREMENT BY 1 NOCYCLE;

CREATE TABLE recommend_result (
    result_id        NUMBER GENERATED ALWAYS AS IDENTITY,
    member_id        NUMBER              NOT NULL,
    save_id          NUMBER              NOT NULL,                          
    product_id       NUMBER              NOT NULL,
    rank_no          NUMBER(2)           NOT NULL,
    condition_label  VARCHAR2(200 CHAR)  NOT NULL,
    created_at       DATE                DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_recommend_result PRIMARY KEY (result_id),
    CONSTRAINT uq_recres_save_rank      UNIQUE (save_id, rank_no),        
    CONSTRAINT ck_recres_rank           CHECK (rank_no BETWEEN 1 AND 30),   
    CONSTRAINT fk_recres_member         FOREIGN KEY (member_id)  REFERENCES member (member_id),
    CONSTRAINT fk_recres_product        FOREIGN KEY (product_id) REFERENCES loan_product (product_id)
);

COMMENT ON TABLE  recommend_result IS '저장한 대출 추천 결과 (상품명·금리가 아닌 상품 번호와 라벨만 저장. 소득·신용 같은 입력값은 저장하지 않음). 회원당 저장 10개 제한, 오래된 저장 삭제는 앱 로직';
COMMENT ON COLUMN recommend_result.result_id       IS '자동 증가(IDENTITY)';
COMMENT ON COLUMN recommend_result.member_id       IS '누가 저장했는지';
COMMENT ON COLUMN recommend_result.save_id         IS '저장 1번을 묶는 번호. seq_recommend_save로 저장할 때마다 1개 발급, 그 저장의 상품 행 전부(최대 30)에 같은 값. 회원당 저장 10개 제한·오래된 저장 삭제·MY 목록 묶음 표시에 사용';
COMMENT ON COLUMN recommend_result.product_id      IS '추천된 상품. 다시 볼 때 최신 상품 정보를 보여주고, product_status가 CLOSED면 ''판매 종료'', HIDDEN이면 ''지금은 볼 수 없는 상품'' 표시';
COMMENT ON COLUMN recommend_result.rank_no         IS '추천 순위 (1~30). 같은 저장(save_id) 안에서 중복 불가';
COMMENT ON COLUMN recommend_result.condition_label IS '화면에 보이는 조건 문구. 용도 / 금액 / 기간 / 직업 순서. 예: 생활비 1,000만원 / 3년 / 직장인 (가운뎃점 사용 안 함)';
COMMENT ON COLUMN recommend_result.created_at      IS '저장일시 (SYSDATE)';
-- ============================================================

-- ============================================================
-- 5. 상품 신고 (관리자는 신고자 확인 가능, 일반 이용자 화면에는 신고자 비공개)
-- ============================================================
CREATE TABLE loan_report (
    report_id      NUMBER GENERATED ALWAYS AS IDENTITY,
    product_id     NUMBER              NOT NULL,
    member_id      NUMBER              NOT NULL,
    report_key     VARCHAR2(64)        NOT NULL,
    report_type    VARCHAR2(20)        NOT NULL,
    content        VARCHAR2(1000 CHAR),                                    
    report_status  VARCHAR2(10)        DEFAULT 'RECEIVED' NOT NULL,
    report_result  VARCHAR2(10),                                            
    handled_by     NUMBER,
    admin_memo     VARCHAR2(500 CHAR),
    created_at     DATE                DEFAULT SYSDATE NOT NULL,
    handled_at     DATE,
    CONSTRAINT pk_loan_report      PRIMARY KEY (report_id),
    CONSTRAINT uq_report_once      UNIQUE (report_key, product_id),
    CONSTRAINT ck_report_key_len   CHECK (LENGTH(report_key) = 64),
    CONSTRAINT ck_report_type      CHECK (report_type IN ('RATE_ERROR','LIMIT_ERROR','DISCONTINUED','CONDITION','ILLEGAL_AD','ETC')),
    CONSTRAINT ck_report_content   CHECK (report_type <> 'ETC' OR content IS NOT NULL),
    CONSTRAINT ck_report_status    CHECK (report_status IN ('RECEIVED','DONE')),
    CONSTRAINT ck_report_result    CHECK (report_result IN ('OK','FIX','CLOSE')),
    -- 완료는 처리자·처리일시·결과 필수, 접수 상태면 비어 있어도 됨
    CONSTRAINT ck_report_handled   CHECK (
           report_status = 'RECEIVED'
        OR (handled_by IS NOT NULL AND handled_at IS NOT NULL AND report_result IS NOT NULL)
    ),
    CONSTRAINT fk_report_product   FOREIGN KEY (product_id) REFERENCES loan_product (product_id),
    CONSTRAINT fk_report_member    FOREIGN KEY (member_id)  REFERENCES member (member_id),
    CONSTRAINT fk_report_handler   FOREIGN KEY (handled_by) REFERENCES admin (admin_id)
);

COMMENT ON TABLE loan_report IS '대출 상품 정보 오류 신고. 관리자는 신고자(member_id)를 확인할 수 있고, 일반 이용자 API/화면에는 신고자 정보를 내려주지 않음. 1인 1회 제한은 report_key + product_id unique로 처리';
COMMENT ON COLUMN loan_report.report_id     IS '자동 증가(IDENTITY)';
COMMENT ON COLUMN loan_report.product_id    IS '어떤 상품을 신고했는지';
COMMENT ON COLUMN loan_report.member_id IS '신고한 회원 (관리자 확인용, 악용 제재·문의 대응). 탈퇴해도 member 행이 남아 "탈퇴한 회원"으로 표시됨. 일반 이용자에게는 노출 금지';
COMMENT ON COLUMN loan_report.report_key    IS '소셜 계정 키(login_type:social_id)의 HMAC-SHA256 16진수 64자. 탈퇴 시 member의 login_type·social_id가 비워지고 member_id가 바뀌어도 재가입 후 같은 상품 재신고를 막기 위함. unique(report_key, product_id)';
COMMENT ON COLUMN loan_report.report_type   IS 'RATE_ERROR 금리 오류 / LIMIT_ERROR 한도 오류 / DISCONTINUED 판매 중단 / CONDITION 조건 불일치 / ILLEGAL_AD 불법·과장 광고 / ETC 기타';
COMMENT ON COLUMN loan_report.content       IS '신고 내용. 기타(ETC)만 필수, 나머지는 NULL 가능. 앱에서 100자 제한, 칸 크기는 1000자 그대로';
COMMENT ON COLUMN loan_report.report_status IS 'RECEIVED 접수 / DONE 완료. 기본 RECEIVED';
COMMENT ON COLUMN loan_report.report_result IS '처리 결과. OK 문제 없음 / FIX 정보 수정 / CLOSE 판매 종료. 완료(DONE)일 때 필수';
COMMENT ON COLUMN loan_report.handled_by    IS '처리한 관리자 (admin.admin_id). 완료 시 필수';
COMMENT ON COLUMN loan_report.admin_memo    IS '관리자끼리 보는 메모. 신고자에게 안 보임. 앱에서 100자 제한';
COMMENT ON COLUMN loan_report.created_at    IS '신고일시 (SYSDATE)';
COMMENT ON COLUMN loan_report.handled_at    IS '처리일시. 완료 시 필수';

-- ============================================================

-- ============================================================
-- 6. 상품 데이터 반영 이력 / 되돌리기용 변경 전 내용
--    버전 = history_id. 되돌리기도 새 이력(ROLLBACK)으로 남고 대상 이력을 가리켜요
-- ============================================================
CREATE TABLE product_update_history (
    history_id         NUMBER GENERATED ALWAYS AS IDENTITY,
    admin_id           NUMBER,                                             
    action_type        VARCHAR2(10)        DEFAULT 'PUBLISH' NOT NULL,
    target_history_id  NUMBER,
    source             VARCHAR2(20),                                        
    added_count        NUMBER(6)           DEFAULT 0 NOT NULL,
    changed_count      NUMBER(6)           DEFAULT 0 NOT NULL,
    removed_count      NUMBER(6)           DEFAULT 0 NOT NULL,
    memo               VARCHAR2(500 CHAR),
    count_json         CLOB,                                               
    updated_at         DATE                DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_product_update_history PRIMARY KEY (history_id),
    CONSTRAINT ck_puh_source             CHECK (source IN ('KINFA','FSS','KINFA,FSS')),
    CONSTRAINT ck_puh_action             CHECK (action_type IN ('INIT','PUBLISH','AUTO_CLOSE','HIDE','SHOW','ROLLBACK')),
    -- ROLLBACK만 대상 이력 필수, 나머지는 모두 NULL
    CONSTRAINT ck_puh_target             CHECK (
           (action_type  = 'ROLLBACK' AND target_history_id IS NOT NULL)
        OR (action_type <> 'ROLLBACK' AND target_history_id IS NULL)
    ),
    CONSTRAINT fk_puh_admin              FOREIGN KEY (admin_id)          REFERENCES admin (admin_id),
    CONSTRAINT fk_puh_target             FOREIGN KEY (target_history_id) REFERENCES product_update_history (history_id)
);

COMMENT ON TABLE  product_update_history IS '상품 데이터 반영 이력 (첫 적재 / 불러오기 반영 / 자동 내림 / 숨김 / 다시 보이기 / 되돌리기)';
COMMENT ON COLUMN product_update_history.history_id        IS '자동 증가(IDENTITY). 이 번호가 곧 상품 데이터 버전';
COMMENT ON COLUMN product_update_history.admin_id          IS '누가 반영했는지 (admin.admin_id). 매일 자동 내림처럼 사람이 안 한 작업은 NULL';
COMMENT ON COLUMN product_update_history.action_type       IS 'INIT 첫 적재 / PUBLISH 불러오기 반영 / AUTO_CLOSE 자동 내림 / HIDE 숨김 / SHOW 다시 보이기 / ROLLBACK 되돌리기. 기본 PUBLISH';
COMMENT ON COLUMN product_update_history.target_history_id IS 'ROLLBACK일 때 어느 이력 시점으로 되돌렸는지. 그 외 동작은 반드시 NULL';
COMMENT ON COLUMN product_update_history.source            IS 'KINFA, FSS 또는 KINFA,FSS. HIDE·SHOW·ROLLBACK·AUTO_CLOSE는 출처가 없어 NULL';
COMMENT ON COLUMN product_update_history.added_count       IS '추가 건수. 기본 0';
COMMENT ON COLUMN product_update_history.changed_count     IS '변경 건수. 기본 0';
COMMENT ON COLUMN product_update_history.removed_count     IS '삭제(판매 종료) 건수. 기본 0';
COMMENT ON COLUMN product_update_history.memo              IS '반영 사유 등 한 줄 메모';
COMMENT ON COLUMN product_update_history.count_json        IS '출처별·칩별·빈 값 건수 요약(JSON). 지난 반영과 비교용';
COMMENT ON COLUMN product_update_history.updated_at        IS '반영일시 (SYSDATE)';

CREATE TABLE product_snapshot (
    snapshot_id   NUMBER GENERATED ALWAYS AS IDENTITY,
    history_id    NUMBER        NOT NULL,
    product_id    NUMBER        NOT NULL,
    change_type   VARCHAR2(10)  NOT NULL,
    before_data   CLOB,
    check_result  VARCHAR2(10),                                           
    checked_by    NUMBER,                                                   
    checked_at    DATE,                                                   
    CONSTRAINT pk_product_snapshot PRIMARY KEY (snapshot_id),
    CONSTRAINT uq_snapshot_item    UNIQUE (history_id, product_id),
    CONSTRAINT ck_snapshot_type    CHECK (change_type IN ('ADD','CHANGE','REMOVE','HIDE','SHOW')),
    CONSTRAINT ck_snapshot_before  CHECK (change_type = 'ADD' OR before_data IS NOT NULL),
    CONSTRAINT ck_snapshot_check   CHECK (check_result IN ('KEEP','REOPEN')),
    -- 확인 결과·확인자·확인일시는 함께 채우거나 함께 비움 (비면 확인 전)
    CONSTRAINT ck_snapshot_checked CHECK (
           (check_result IS NULL     AND checked_by IS NULL     AND checked_at IS NULL)
        OR (check_result IS NOT NULL AND checked_by IS NOT NULL AND checked_at IS NOT NULL)
    ),
    CONSTRAINT fk_snapshot_history FOREIGN KEY (history_id) REFERENCES product_update_history (history_id),
    CONSTRAINT fk_snapshot_product FOREIGN KEY (product_id) REFERENCES loan_product (product_id),
    CONSTRAINT fk_snapshot_checker FOREIGN KEY (checked_by) REFERENCES admin (admin_id)
);

COMMENT ON TABLE  product_snapshot IS '되돌리기용 변경 전 내용 (반영 때 바뀐 상품의 반영 전 모습). 자동 내림 상품 확인 목록에도 사용';
COMMENT ON COLUMN product_snapshot.snapshot_id  IS '자동 증가(IDENTITY)';
COMMENT ON COLUMN product_snapshot.history_id   IS '어느 반영 이력에서 바뀌었는지';
COMMENT ON COLUMN product_snapshot.product_id   IS '바뀐 상품. unique(history_id, product_id)';
COMMENT ON COLUMN product_snapshot.change_type  IS 'ADD 새로 추가 / CHANGE 값 변경 / REMOVE 판매 종료 처리 / HIDE 숨김 / SHOW 다시 보이기 (숨김·다시 보이기도 되돌릴 수 있어야 함)';
COMMENT ON COLUMN product_snapshot.before_data IS '반영 전 상품 행(loan_product) + 그 상품의 태그(tag_type, tag_value 값으로 저장, tag_id 아님) + product_rate 를 JSON으로 통째로 저장. ADD는 비어 있어도 됨 (되돌릴 땐 product_status를 CLOSED로). 되돌릴 때 태그는 값으로 tag를 찾고 없으면 새로 만든 뒤 product_tag를 다시 연결. 주의: tag의 칩 이름(tag_value)을 바꿀 때는 옛 before_data 안의 같은 값도 같이 바꿀 것 (안 바꾸면 되돌릴 때 옛 이름 tag가 다시 생겨 칩으로 보임)';
COMMENT ON COLUMN product_snapshot.check_result IS 'KEEP 확인함(내림 유지) / REOPEN 다시 게시. NULL이면 확인 전 (자동 내림 상품 확인 목록)';
COMMENT ON COLUMN product_snapshot.checked_by   IS '확인한 관리자 (admin.admin_id)';
COMMENT ON COLUMN product_snapshot.checked_at   IS '확인일시';
-- ============================================================

-- ============================================================
-- 7. 도움말 (FAQ · 용어 · TIP 모두 엑셀 → CSV → DB 적재)
-- ============================================================
CREATE TABLE help_content (
    help_id     NUMBER GENERATED ALWAYS AS IDENTITY,
    help_type   VARCHAR2(10)        NOT NULL,
    help_no     NUMBER(6)           NOT NULL,
    category    VARCHAR2(30 CHAR),
    keyword     VARCHAR2(100 CHAR),
    title       VARCHAR2(200 CHAR)  NOT NULL,
    content     CLOB                NOT NULL,
    sort_order  NUMBER(4)           DEFAULT 0 NOT NULL,
    CONSTRAINT pk_help_content PRIMARY KEY (help_id),
    CONSTRAINT ck_help_type    CHECK (help_type IN ('FAQ','TERM','TIP'))
);

COMMENT ON TABLE  help_content IS '도움말 콘텐츠 (FAQ / 용어 / TIP). 원본은 엑셀, CSV(UTF-8)로 내보내 DB에 적재. DB 직접 수정 금지(다음 적재 때 덮어써짐)';
COMMENT ON COLUMN help_content.help_type  IS 'FAQ 자주 묻는 질문 / TERM 용어 / TIP 대출 TIP';
COMMENT ON COLUMN help_content.help_no    IS '엑셀 원본의 고정 번호. 종류(help_type)별로 1부터. 제목을 고쳐도 같은 행으로 인식하기 위한 적재 키(unique(help_type, help_no)). 한 번 부여하면 바꾸거나 재사용하지 않음';
COMMENT ON COLUMN help_content.category   IS '분류 칩. 용어 사전의 분류(예: 금리, 심사·한도). FAQ에 분류가 있으면 함께 사용. 표기를 통일할 것(표기가 다르면 칩이 갈라짐)';
COMMENT ON COLUMN help_content.keyword    IS 'TIP 키워드 (예: 금리, 신용점수)';
COMMENT ON COLUMN help_content.title      IS 'FAQ 질문 / 용어 이름 / TIP 제목. 엑셀 기준 200자 이내';
COMMENT ON COLUMN help_content.content    IS 'FAQ 답변 / 용어 설명 / TIP 내용';

CREATE TABLE help_stat (
    stat_id          NUMBER GENERATED ALWAYS AS IDENTITY,
    target_type      VARCHAR2(10)  NOT NULL,
    target_key       VARCHAR2(50)  NOT NULL,
    open_count       NUMBER(10)    DEFAULT 0 NOT NULL,
    helpful_count    NUMBER(10)    DEFAULT 0 NOT NULL,
    unhelpful_count  NUMBER(10)    DEFAULT 0 NOT NULL,
    CONSTRAINT pk_help_stat     PRIMARY KEY (stat_id),
    CONSTRAINT uq_help_stat     UNIQUE (target_type, target_key),
    CONSTRAINT ck_stat_type     CHECK (target_type IN ('FAQ','TERM','TIP')),
    CONSTRAINT ck_stat_counts   CHECK (open_count >= 0 AND helpful_count >= 0 AND unhelpful_count >= 0)
);

COMMENT ON TABLE  help_stat IS '도움말 통계 (FAQ 연 횟수 + 도움돼요/아니에요 수). 엑셀을 다시 적재해도 help_id가 유지되므로 통계가 끊기지 않음';
COMMENT ON COLUMN help_stat.stat_id         IS '자동 증가(IDENTITY)';
COMMENT ON COLUMN help_stat.target_type     IS 'FAQ / TERM / TIP';
COMMENT ON COLUMN help_stat.target_key IS '대상 번호. FAQ·TERM·TIP 모두 help_content.help_id (문자로 저장). 엑셀 번호(help_no)가 아님. unique(target_type, target_key)';
COMMENT ON COLUMN help_stat.open_count      IS 'FAQ를 연 횟수. 기본 0';
COMMENT ON COLUMN help_stat.helpful_count   IS '도움돼요 횟수. 기본 0';
COMMENT ON COLUMN help_stat.unhelpful_count IS '아니에요 횟수. 기본 0';

CREATE TABLE help_question (
    question_id      NUMBER GENERATED ALWAYS AS IDENTITY,
    content          VARCHAR2(300 CHAR)  NOT NULL,
    member_yn        CHAR(1)             DEFAULT 'N'       NOT NULL,
    question_status  VARCHAR2(12)        DEFAULT 'PENDING' NOT NULL,
    created_at       DATE                DEFAULT SYSDATE   NOT NULL,
    CONSTRAINT pk_help_question PRIMARY KEY (question_id),
    CONSTRAINT ck_question_yn   CHECK (member_yn IN ('Y','N')),
    CONSTRAINT ck_question_stat CHECK (question_status IN ('PENDING','FAQ_PLANNED','DONE','HOLD'))
);

COMMENT ON TABLE  help_question IS '이용자 질문 보관함 (회원 번호는 저장하지 않고 회원 여부만)';
COMMENT ON COLUMN help_question.question_id     IS '자동 증가(IDENTITY)';
COMMENT ON COLUMN help_question.content         IS '질문 내용. 4~300자, 쓴 그대로 저장 (화면에서는 글자로만 출력)';
COMMENT ON COLUMN help_question.member_yn       IS '로그인한 회원이 남겼는지 Y/N. 기본 N';
COMMENT ON COLUMN help_question.question_status IS 'PENDING 확인 전 / FAQ_PLANNED FAQ 추가 예정(엑셀에 추가 예정) / DONE 반영 완료(엑셀 적재까지 끝남) / HOLD 보류. 기본 PENDING';
COMMENT ON COLUMN help_question.created_at      IS '질문 일시 (SYSDATE)';

CREATE TABLE term_request (
    request_id         NUMBER GENERATED ALWAYS AS IDENTITY,
    term_word          VARCHAR2(30 CHAR)  NOT NULL,
    request_count      NUMBER(8)          DEFAULT 1       NOT NULL,
    created_at         DATE               DEFAULT SYSDATE NOT NULL,
    last_requested_at  DATE               DEFAULT SYSDATE NOT NULL,
    CONSTRAINT pk_term_request  PRIMARY KEY (request_id),
    CONSTRAINT uq_term_word     UNIQUE (term_word),
    CONSTRAINT ck_term_count    CHECK (request_count >= 1)
);

COMMENT ON TABLE  term_request IS '용어 추가 요청';
COMMENT ON COLUMN term_request.request_id        IS '자동 증가(IDENTITY)';
COMMENT ON COLUMN term_request.term_word         IS '요청한 단어. 30자까지. 같은 단어는 새로 안 만들고 횟수만 +1';
COMMENT ON COLUMN term_request.request_count     IS '요청 횟수. 기본 1';
COMMENT ON COLUMN term_request.created_at        IS '처음 요청한 일시 (SYSDATE)';
COMMENT ON COLUMN term_request.last_requested_at IS '가장 최근 요청 일시';
-- ============================================================