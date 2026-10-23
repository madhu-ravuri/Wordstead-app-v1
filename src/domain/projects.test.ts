import { describe, expect, it } from 'vitest'
import {
  createProject,
  getProjectTotal,
  updateProject,
  validateProjectForm,
  type ProjectFormValues,
  type WritingSession,
} from './projects'

const validForm: ProjectFormValues = {
  title: '  The Long Draft  ',
  startingWordCount: '',
  deadline: '',
  synopsis: '',
  notes: '',
}

describe('validateProjectForm', () => {
  it('trims the required title and defaults omitted optional fields', () => {
    const result = validateProjectForm(validForm)

    expect(result.errors).toEqual({})
    expect(result.fields).toEqual({
      title: 'The Long Draft',
      startingWordCount: 0,
      deadline: null,
      synopsis: null,
      notes: null,
    })
  })

  it('accepts both starting-count boundaries', () => {
    expect(validateProjectForm({ ...validForm, startingWordCount: '0' }).fields?.startingWordCount).toBe(0)
    expect(
      validateProjectForm({ ...validForm, startingWordCount: '1000000' }).fields
        ?.startingWordCount,
    ).toBe(1_000_000)
  })

  it.each(['-1', '1.5', '1000001', 'not a number'])('rejects invalid starting count %s', (count) => {
    const result = validateProjectForm({ ...validForm, startingWordCount: count })

    expect(result.fields).toBeNull()
    expect(result.errors.startingWordCount).toBeDefined()
  })

  it('rejects a blank title', () => {
    const result = validateProjectForm({ ...validForm, title: ' \n ' })

    expect(result.fields).toBeNull()
    expect(result.errors.title).toBe('Enter a project title.')
  })

  it('preserves plain-text synopsis and notes', () => {
    const result = validateProjectForm({
      ...validForm,
      synopsis: 'A short premise.',
      notes: '<not markup>',
    })

    expect(result.fields?.synopsis).toBe('A short premise.')
    expect(result.fields?.notes).toBe('<not markup>')
  })
})

describe('project operations', () => {
  it('creates an active project and updates project metadata on edit', () => {
    const created = createProject(
      {
        title: 'Draft',
        startingWordCount: 120,
        deadline: null,
        synopsis: null,
        notes: null,
      },
      'project-1',
      '2026-10-23T12:00:00.000Z',
    )
    const updated = updateProject(
      created,
      {
        ...created,
        title: 'Revised Draft',
      },
      '2026-10-24T09:00:00.000Z',
    )

    expect(created.completedAt).toBeNull()
    expect(created.deletedAt).toBeNull()
    expect(created.createdAt).toBe('2026-10-23T12:00:00.000Z')
    expect(updated.updatedAt).toBe('2026-10-24T09:00:00.000Z')
    expect(updated.title).toBe('Revised Draft')
    expect(updated.createdAt).toBe(created.createdAt)
  })

  it('adds matching sessions to the starting count without applying the entry cap to totals', () => {
    const project = createProject(
      {
        title: 'Draft',
        startingWordCount: 1_000_000,
        deadline: null,
        synopsis: null,
        notes: null,
      },
      'project-1',
    )
    const sessions: WritingSession[] = [
      {
        id: 'session-1',
        projectId: 'project-1',
        date: '2026-10-23',
        wordCount: 1_000_000,
        createdAt: '2026-10-23T12:00:00.000Z',
        updatedAt: '2026-10-23T12:00:00.000Z',
      },
      {
        id: 'session-2',
        projectId: 'another-project',
        date: '2026-10-23',
        wordCount: 1_000_000,
        createdAt: '2026-10-23T12:00:00.000Z',
        updatedAt: '2026-10-23T12:00:00.000Z',
      },
    ]

    expect(getProjectTotal(project)).toBe(1_000_000)
    expect(getProjectTotal(project, sessions)).toBe(2_000_000)
  })
})