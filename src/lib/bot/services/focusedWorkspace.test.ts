import { describe, it, expect } from 'vitest'
import { formatFocusedWorkspaceLine } from './focusedWorkspace'

describe('formatFocusedWorkspaceLine', () => {
  it('includes title, description, and id', () => {
    const line = formatFocusedWorkspaceLine({
      id: 'workspace-1',
      title: "AI's Workspace",
      description: 'Research, reports, and AI notes',
    })
    expect(line).toContain("Active workspace: \"AI's Workspace\"")
    expect(line).toContain('Research, reports, and AI notes')
    expect(line).toContain('workspace-1')
  })

  it('omits dash description when empty', () => {
    const line = formatFocusedWorkspaceLine({
      id: 'workspace-2',
      title: 'Personal',
      description: null,
    })
    expect(line).toContain('Active workspace: "Personal"')
    expect(line).not.toContain(' — ')
  })
})
