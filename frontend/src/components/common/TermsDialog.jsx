import styled from 'styled-components'
import { TERMS, TERMS_EFFECTIVE_DATE, TERMS_NOTICE } from '../../constants/terms'
import { Button } from '../../styles/common'
import Modal from '../ui/Modal'

// CM-21 약관 창: 이용약관, 개인정보 수집/이용 전문 (constants/terms.js 고정 글, 글자로만 출력 E1)
// kind: 'service' 또는 'privacy' (null이면 닫힘). 여는 쪽(가입 단계, 푸터)이 useState(종류)로 관리
// Esc, 뒤 막, 닫기(X), [닫기] → onClose
const Title = styled.h2`
  margin-bottom: 8px;
  font-size: var(--fs-h3);
  font-weight: 800;
`

const Notice = styled.p`
  margin-bottom: 20px;
  color: var(--cocoa);
  font-size: var(--fs-sm);
`

const Section = styled.section`
  margin-bottom: 20px;
  color: var(--ink-2);
  font-size: var(--fs-md);
  line-height: 1.7;
  h3 {
    margin-bottom: 6px;
    color: var(--ink);
    font-size: var(--fs-base);
    font-weight: 800;
  }
  p {
    margin-bottom: 6px;
  }
  ol,
  ul {
    margin-bottom: 6px;
    padding-left: 20px;
  }
  ol {
    list-style: decimal;
  }
  ul {
    list-style: disc;
  }
`

const Table = styled.table`
  width: 100%;
  margin-bottom: 8px;
  border-collapse: collapse;
  font-size: var(--fs-sm);
  th,
  td {
    padding: 8px;
    border: 1px solid var(--line);
    text-align: left;
    vertical-align: top;
  }
  th {
    background: var(--mist);
    font-weight: 600;
  }
`

const Bottom = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--cocoa);
  font-size: var(--fs-sm);
`

function TermsBlock({ block }) {
  if (block.type === 'ol' || block.type === 'ul') {
    const items = block.items.map((item) => <li key={item}>{item}</li>)
    return block.type === 'ol' ? <ol>{items}</ol> : <ul>{items}</ul>
  }
  if (block.type === 'table') {
    return (
      <Table>
        <thead>
          <tr>
            {block.head.map((cell) => (
              <th key={cell}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.join('|')}>
              {row.map((cell) => (
                <td key={cell}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    )
  }
  return <p>{block.text}</p>
}

function TermsDialog({ kind, onClose }) {
  const terms = TERMS[kind]
  if (!terms) return null

  return (
    <Modal isOpen onClose={onClose} label={terms.title}>
      <Title>{terms.title}</Title>
      <Notice>{TERMS_NOTICE}</Notice>
      {terms.sections.map((section) => (
        <Section key={section.heading}>
          <h3>{section.heading}</h3>
          {section.blocks.map((block, index) => (
            <TermsBlock key={`${block.type}-${index}`} block={block} />
          ))}
        </Section>
      ))}
      <Bottom>
        <span>시행일: {TERMS_EFFECTIVE_DATE}</span>
        <Button $variant="outline" onClick={onClose}>
          닫기
        </Button>
      </Bottom>
    </Modal>
  )
}

export default TermsDialog
