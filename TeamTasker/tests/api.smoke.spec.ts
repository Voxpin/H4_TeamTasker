import { expect, test } from '@playwright/test'

test('loads the task list from the live JSONPlaceholder API', { tag: '@smoke' }, async ({ page }) => {
  const responsePromise = page.waitForResponse((response) =>
    response.url() === 'https://jsonplaceholder.typicode.com/posts?_limit=50' && response.request().method() === 'GET',
  )

  await page.goto('/')

  const response = await responsePromise
  expect(response.ok()).toBeTruthy()

  const posts = await response.json() as { title: string }[]
  expect(posts.length).toBeGreaterThan(0)
  await expect(page.locator('.task-card h2').first()).toHaveText(posts[0].title)
})