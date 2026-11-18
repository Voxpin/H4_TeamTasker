import { describe, expect, it } from 'vitest'
import { getTaskFormError, todayAsDateString, type TaskFormValues } from '../taskForm'

const validValues: TaskFormValues = {
  title: 'Prepare release',
  description: 'Review the final checklist.',
  status: 'Not started',
  priority: 'Medium',
  date: '2030-05-17',
}

describe('todayAsDateString', () => {
  it('formats the provided local date with zero-padded month and day', () => {
    expect(todayAsDateString(new Date(2024, 0, 9))).toBe('2024-01-09')
  })
})

describe('getTaskFormError', () => {
  it('requires a title', () => {
    expect(getTaskFormError({ ...validValues, title: '' })).toBe('Please add a task title.')
  })

  it('rejects a whitespace-only title', () => {
    expect(getTaskFormError({ ...validValues, title: '   ' })).toBe('Please add a task title.')
  })

  it('requires a priority', () => {
    expect(getTaskFormError({ ...validValues, priority: '' })).toBe('Please choose a priority.')
  })

  it('requires a date', () => {
    expect(getTaskFormError({ ...validValues, date: '' })).toBe('Please choose a date.')
  })

  it('accepts valid form values', () => {
    expect(getTaskFormError(validValues)).toBe('')
  })
})