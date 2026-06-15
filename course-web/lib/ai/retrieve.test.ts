import { describe, it, expect } from 'vitest'
import { selectRelevantChunks } from './retrieve'

const passageA =
  'Photosynthesis is the process by which green plants convert sunlight into chemical energy stored as glucose.'
const passageB =
  'The mitochondria are the powerhouse of the cell, producing ATP through cellular respiration in animals.'
const passageC =
  'Tax law in many jurisdictions distinguishes between capital gains and ordinary income for accounting purposes.'

const source = [passageA, passageB, passageC].join('\n\n')

describe('selectRelevantChunks', () => {
  it("returns '' for empty source", () => {
    expect(selectRelevantChunks('', 'anything')).toBe('')
    expect(selectRelevantChunks('   \n  ', 'anything')).toBe('')
  })

  it('returns the passage most relevant to the query', () => {
    const result = selectRelevantChunks(source, 'How does photosynthesis convert sunlight in plants?')
    expect(result).toContain('Photosynthesis')
    expect(result).not.toContain('Tax law')
  })

  it('respects the character budget', () => {
    const budget = passageA.length + 5
    const result = selectRelevantChunks(source, 'photosynthesis sunlight glucose plants', budget)
    expect(result.length).toBeLessThanOrEqual(budget)
    expect(result).toContain('Photosynthesis')
  })

  it('falls back to opening passages when the query has no term overlap', () => {
    // A query made entirely of stopwords / sub-3-char tokens produces no tokens,
    // so nothing scores > 0 and the function falls back to leading passages.
    const result = selectRelevantChunks(source, 'a an it')
    expect(result.length).toBeGreaterThan(0)
    expect(result).toContain('Photosynthesis')
  })

  it('preserves original passage order in the output', () => {
    const result = selectRelevantChunks(
      source,
      'photosynthesis glucose mitochondria respiration',
      10_000,
    )
    expect(result.indexOf('Photosynthesis')).toBeLessThan(result.indexOf('mitochondria'))
  })
})
