import type { Dataset } from '../../data/backup'

export function plural(count: number, word: string): string {
  return `${new Intl.NumberFormat().format(count)} ${word}${count === 1 ? '' : 's'}`
}

export function describeDataset(data: Dataset): string {
  const completed = data.projects.filter((project) => project.completedAt && !project.deletedAt).length
  const deleted = data.projects.filter((project) => project.deletedAt).length
  const details = [completed && `${completed} completed`, deleted && `${deleted} deleted`].filter(Boolean)
  const projects = plural(data.projects.length, 'project') + (details.length ? ` (${details.join(', ')})` : '')
  return `${projects} and ${plural(data.sessions.length, 'writing session')}`
}
