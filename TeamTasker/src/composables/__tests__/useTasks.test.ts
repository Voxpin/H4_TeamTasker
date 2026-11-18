import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NewTask } from '../../types/task'

const tasksApiUrl = 'https://jsonplaceholder.typicode.com/posts'
const samplePosts = [
  { userId: 1, id: 1, title: 'Build the dashboard', body: 'Prepare the main task view.' },
  { userId: 3, id: 2, title: 'Write release notes', body: 'Summarize the release changes.' },
]

const newTask: NewTask = {
  title: 'Prepare demo',
  description: 'Check the main user flows.',
  status: 'In progress',
  priority: 'High',
  date: '2030-05-17',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

async function loadTasksComposable() {
  vi.resetModules()
  const { useTasks } = await import('../useTasks')
  return useTasks()
}

function mockFetch() {
  const fetchMock = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('useTasks', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('maps API posts, exposes filter options, and fetches only once', async () => {
    const fetchMock = mockFetch()
    fetchMock.mockResolvedValue(jsonResponse(samplePosts))
    const store = await loadTasksComposable()

    await Promise.all([store.fetchTasks(), store.fetchTasks()])
    await store.fetchTasks()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(`${tasksApiUrl}?_limit=50`)
    expect(store.tasks.value).toMatchObject([
      {
        userId: 1,
        id: 1,
        title: 'Build the dashboard',
        description: 'Prepare the main task view.',
        status: 'Not started',
        priority: 'Low',
      },
      {
        userId: 3,
        id: 2,
        title: 'Write release notes',
        description: 'Summarize the release changes.',
        status: 'In progress',
        priority: 'High',
      },
    ])
    expect(store.tasks.value[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(store.statusus.value).toEqual(['In progress', 'Not started'])
    expect(store.priorities.value).toEqual(['High', 'Low'])
  })

  it('allows fetching again after a failed request', async () => {
    const fetchMock = mockFetch()
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: 'Unavailable' }, 503))
      .mockResolvedValueOnce(jsonResponse(samplePosts))
    const store = await loadTasksComposable()

    await store.fetchTasks()

    expect(store.errorMessage.value).toBe('We couldn’t load the tasks. Please check your connection and try again.')
    expect(store.isLoading.value).toBe(false)
    await store.fetchTasks()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store.errorMessage.value).toBe('')
    expect(store.tasks.value).toHaveLength(samplePosts.length)
  })

  it('posts a new task before adding it to the local task list', async () => {
    const fetchMock = mockFetch()
    fetchMock.mockResolvedValue(jsonResponse({ id: 101 }, 201))
    const store = await loadTasksComposable()

    const createdTask = await store.addTask(newTask)

    expect(fetchMock).toHaveBeenCalledWith(tasksApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTask.title,
        body: newTask.description,
        userId: 1,
        status: newTask.status,
        priority: newTask.priority,
        date: newTask.date,
      }),
    })
    expect(createdTask).toMatchObject({ ...newTask, userId: 1, id: -1 })
    expect(store.tasks.value[0]).toEqual(createdTask)
    expect(store.getTaskById(-1)).toEqual(createdTask)
  })

  it('sends an existing task id when updating and stores the updated values', async () => {
    const fetchMock = mockFetch()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(samplePosts.slice(0, 1)))
      .mockResolvedValueOnce(jsonResponse({ id: 1 }, 201))
    const store = await loadTasksComposable()
    await store.fetchTasks()

    const updatedTask = await store.updateTask(1, { ...newTask, title: 'Publish demo' })

    expect(fetchMock).toHaveBeenLastCalledWith(tasksApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Publish demo',
        body: newTask.description,
        userId: 1,
        status: newTask.status,
        priority: newTask.priority,
        date: newTask.date,
        id: 1,
      }),
    })
    expect(updatedTask).toMatchObject({ ...newTask, title: 'Publish demo', userId: 1, id: 1 })
    expect(store.getTaskById(1)).toEqual(updatedTask)
  })

  it('leaves the existing task unchanged when saving an update fails', async () => {
    const fetchMock = mockFetch()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(samplePosts.slice(0, 1)))
      .mockResolvedValueOnce(jsonResponse({ message: 'Unavailable' }, 503))
    const store = await loadTasksComposable()
    await store.fetchTasks()
    const originalTask = store.getTaskById(1)

    await expect(store.updateTask(1, { ...newTask, title: 'Unsaved change' })).rejects.toThrow(
      'We couldn’t save the task. Please check your connection and try again.',
    )

    expect(store.getTaskById(1)).toEqual(originalTask)
    expect(store.tasks.value).toHaveLength(1)
  })
})