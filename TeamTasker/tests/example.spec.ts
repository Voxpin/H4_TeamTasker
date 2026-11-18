import { expect, test, type Page } from '@playwright/test'

const tasksApiUrl = /^https:\/\/jsonplaceholder\.typicode\.com\/posts(?:\?.*)?$/

const samplePosts = [
  { userId: 1, id: 1, title: 'Build the dashboard', body: 'Prepare the main task view.' },
  { userId: 2, id: 2, title: 'Write release notes', body: 'Summarize the release changes.' },
  { userId: 3, id: 3, title: 'Review release checklist', body: 'Confirm launch readiness.' },
  { userId: 3, id: 4, title: 'Build a test suite', body: 'Cover the primary task flows.' },
]

async function mockTasksApi(page: Page) {
  await page.route(tasksApiUrl, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, json: samplePosts })
      return
    }

    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 201, json: { id: 101 } })
      return
    }

    await route.fallback()
  })
}


test.beforeEach(async ({ page }) => {
  await mockTasksApi(page)
})


test('loads tasks and opens a task detail', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Build the dashboard', level: 2 })).toBeVisible()
  await page.getByRole('heading', { name: 'Build the dashboard', level: 2 }).click()

  await expect(page.locator('.task-detail h1')).toHaveText('Build the dashboard')
  await expect(page.locator('.task-detail')).toContainText('Prepare the main task view.')
})


test('filters tasks by search, status, and priority', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('searchbox', { name: 'Search tasks' }).fill('release')
  await page.getByLabel('Filter by status').selectOption('Completed')
  await page.getByLabel('Filter by priority').selectOption('High')

  await expect(page.locator('.task-card h2')).toHaveText(['Review release checklist'])

  await page.getByLabel('Filter by priority').selectOption('Low')
  await expect(page.locator('.task-card')).toHaveCount(0)
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.locator('.task-card')).toHaveCount(samplePosts.length)
})


test('validates required fields before creating a task', async ({ page }) => {
  await page.goto('/create')
  await page.getByRole('button', { name: /^Create task/ }).click()

  await expect(page.getByRole('alert')).toHaveText('Please add a task title.')
  await expect(page.getByRole('dialog')).toBeVisible()
})


test('creates a task and sends its form values to the API', async ({ page }) => {
  await page.goto('/create')
  const form = page.getByRole('dialog')
  await form.getByLabel(/Task title/).fill('Prepare demo')
  await form.getByLabel(/Priority/).selectOption('High')
  await form.getByLabel('Status').selectOption('In progress')
  await form.getByLabel(/Due date/).fill('2030-05-17')
  await form.getByLabel('About the task').fill('Check the main user flows.')

  const postRequestPromise = page.waitForRequest((request) => request.url() === 'https://jsonplaceholder.typicode.com/posts' && request.method() === 'POST')
  await page.getByRole('button', { name: /^Create task/ }).click()
  const postRequest = await postRequestPromise

  expect(postRequest.postDataJSON()).toEqual({
    title: 'Prepare demo',
    body: 'Check the main user flows.',
    userId: 1,
    status: 'In progress',
    priority: 'High',
    date: '2030-05-17',
  })
  await expect(page.locator('.task-detail h1')).toHaveText('Prepare demo')
  await expect(page.locator('.task-detail')).toContainText('Check the main user flows.')
})


test('edits a task, sends the task id, and shows the updated details', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('heading', { name: 'Write release notes', level: 2 }).click()
  await page.getByRole('link', { name: 'Edit task' }).click()
  const form = page.getByRole('dialog')
  await form.getByLabel(/Task title/).fill('Publish release notes')
  await form.getByLabel('Status').selectOption('Completed')

  const postRequestPromise = page.waitForRequest((request) => request.url() === 'https://jsonplaceholder.typicode.com/posts' && request.method() === 'POST')
  await page.getByRole('button', { name: /^Save changes/ }).click()
  const postRequest = await postRequestPromise

  expect(postRequest.postDataJSON()).toMatchObject({
    id: 2,
    title: 'Publish release notes',
    status: 'Completed',
    priority: 'Medium',
  })
  await expect(page.locator('.task-detail h1')).toHaveText('Publish release notes')
  await expect(page.locator('.task-detail')).toContainText('Status: Completed')
})


test('shows a useful error when task loading fails', async ({ page }) => {
  await page.route(tasksApiUrl, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 503, json: { message: 'Unavailable' } })
      return
    }

    await route.fallback()
  })

  await page.goto('/tasks/999')

  await expect(page.getByRole('heading', { name: 'Task unavailable' })).toBeVisible()
  await expect(page.locator('.task-detail')).toContainText('We couldn’t load the tasks.')
})


test('keeps the form open and reports an error when saving fails', async ({ page }) => {
  await page.route(tasksApiUrl, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 503, json: { message: 'Unavailable' } })
      return
    }

    await route.fallback()
  })

  await page.goto('/create')
  const form = page.getByRole('dialog')
  await form.getByLabel(/Task title/).fill('Task that cannot be saved')
  await form.getByLabel(/Priority/).selectOption('Low')
  await form.getByLabel(/Due date/).fill('2030-05-17')
  await form.getByRole('button', { name: /^Create task/ }).click()

  await expect(page.getByRole('alert')).toHaveText('We couldn’t save the task. Please check your connection and try again.')
  await expect(page.getByRole('dialog')).toBeVisible()
})
