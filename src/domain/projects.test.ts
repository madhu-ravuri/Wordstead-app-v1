import { describe, expect, it } from 'vitest'
import {
  createProject,
  getLastEditedAt,
  getProjectTotal,
  sortByLastEdited,
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

  const invalidStartingCounts = [
    '-1', '1.5', '1000001', 'not a number', '1e3', '0x10', '+5', '1-', '--5', 'e', '12abc', '1 000',
  ]

  it.each(invalidStartingCounts)('rejects invalid starting count %s', (count) => {
    const result = validateProjectForm({ ...validForm, startingWordCount: count })

    expect(result.fields).toBeNull()
    expect(result.errors.startingWordCount).toBeDefined()
  })

  it('accepts a whole number surrounded by whitespace', () => {
    expect(validateProjectForm({ ...validForm, startingWordCount: ' 42 ' }).fields?.startingWordCount).toBe(42)
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

describe('last-edited ordering', () => {
  const fields = { title: 'Draft', startingWordCount: 0, deadline: null, synopsis: null, notes: null }

  it('lists the most recently edited project first', () => {
    const older = createProject(fields, 'older', '2026-10-01T09:00:00.000Z')
    const newer = createProject(fields, 'newer', '2026-10-02T09:00:00.000Z')
    const editedOlder = updateProject(older, { ...fields, title: 'Revised' }, '2026-10-03T09:00:00.000Z')

    expect(sortByLastEdited([older, newer]).map((project) => project.id)).toEqual(['newer', 'older'])
    expect(sortByLastEdited([editedOlder, newer]).map((project) => project.id)).toEqual(['older', 'newer'])
  })

  it('breaks last-edited ties by newest creation, then id', () => {
    const a = { ...createProject(fields, 'a', '2026-10-01T09:00:00.000Z'), updatedAt: '2026-10-05T09:00:00.000Z' }
    const b = { ...createProject(fields, 'b', '2026-10-02T09:00:00.000Z'), updatedAt: '2026-10-05T09:00:00.000Z' }
    const c = { ...createProject(fields, 'c', '2026-10-02T09:00:00.000Z'), updatedAt: '2026-10-05T09:00:00.000Z' }

    expect(sortByLastEdited([a, c, b]).map((project) => project.id)).toEqual(['b', 'c', 'a'])
  })

  it("uses the latest session log time when it is later than the project's edit time", () => {
    const project = createProject(fields, 'p', '2026-10-01T09:00:00.000Z')
    const session: WritingSession = {
      id: 's',
      projectId: 'p',
      date: '2026-09-20',
      wordCount: 10,
      createdAt: '2026-10-04T09:00:00.000Z',
      updatedAt: '2026-10-06T09:00:00.000Z',
    }

    expect(getLastEditedAt(project, [session])).toBe('2026-10-04T09:00:00.000Z')
    expect(getLastEditedAt(project, [{ ...session, projectId: 'other' }])).toBe(project.updatedAt)
  })
})
