import { describe, it, expect } from 'vitest'
import { normalizeQuizOptions } from './quiz'

describe('normalizeQuizOptions', () => {
  it('returns null for null input', () => {
    expect(normalizeQuizOptions(null)).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(normalizeQuizOptions('not json {')).toBeNull()
  })

  it('returns null when the parsed value is not an array', () => {
    expect(normalizeQuizOptions(JSON.stringify({ a: 1 }))).toBeNull()
  })

  it('parses lettered string options into {id,text}', () => {
    const result = normalizeQuizOptions(JSON.stringify(['a) 1995', 'B. 2001']))
    expect(result).toEqual([
      { id: 'a', text: '1995' },
      { id: 'b', text: '2001' },
    ])
  })

  it('assigns sequential fallback ids to bare string options', () => {
    const result = normalizeQuizOptions(JSON.stringify(['Red', 'Green', 'Blue']))
    expect(result).toEqual([
      { id: 'a', text: 'Red' },
      { id: 'b', text: 'Green' },
      { id: 'c', text: 'Blue' },
    ])
  })

  it('preserves well-formed {id,text} objects', () => {
    const result = normalizeQuizOptions(
      JSON.stringify([
        { id: 'x', text: 'First' },
        { id: 'y', text: 'Second' },
      ]),
    )
    expect(result).toEqual([
      { id: 'x', text: 'First' },
      { id: 'y', text: 'Second' },
    ])
  })

  it('fills in missing object fields with fallbacks', () => {
    const result = normalizeQuizOptions(JSON.stringify([{ text: 'No id here' }, { id: 'q' }]))
    expect(result).toEqual([
      { id: 'a', text: 'No id here' },
      { id: 'q', text: '' },
    ])
  })
})
