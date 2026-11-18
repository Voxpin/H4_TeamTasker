# Security report: TeamTasker with a real backend

## 1. Scope and current architecture

TeamTasker currently loads tasks from JSONPlaceholder and simulates create and edit requests. Successful changes are kept in browser memory and disappear on reload. There is no project-controlled backend or database in the current implementation, so the SQL injection scenarios below are **hypothetical**, not confirmed vulnerabilities.

The assessment focuses on what would change if tasks were stored in a real database and shared between users. It is not a full security audit.

## 2. SQL injection

**Risk.** SQL injection occurs when a backend includes untrusted input directly in a database query, allowing that input to change the query’s meaning. For example, an attacker could submit a specially crafted task title, description, search term or task ID. Depending on the query and database permissions, this could expose, modify or delete data.

**Example scenario.** A future API that constructs a query by concatenating a task title into an SQL string could interpret part of that title as SQL rather than ordinary text.

**Mitigation.** Use parameterized queries or a database library that binds values separately from SQL. For example, with PostgreSQL-style parameters:

```ts
await db.query(
  'UPDATE tasks SET title = $1 WHERE id = $2 AND owner_id = $3',
  [title, taskId, authenticatedUser.id],
)
```

The backend must obtain `authenticatedUser.id` from a verified session or token, not from the request body. Parameterization applies to values; dynamic table names, column names and sort directions must instead be selected from a server-side allowlist.

Also validate inputs on the server, use a database account with only the permissions the application needs, and avoid returning database error details to users. Validation is useful, but it does not replace parameterized queries.

## 3. Cross-site scripting (XSS)

**Risk.** XSS occurs when attacker-controlled content is interpreted as executable script in another user’s browser. For example, if task descriptions were stored and later inserted as raw HTML, a malicious description could execute when another user opened the task. This is called **stored XSS**. Reflected and DOM-based XSS are other possibilities if untrusted input reaches an unsafe rendering context.

An attacker could use XSS to act as the victim within the application, read information available to the page, or change what the victim sees. Even an `HttpOnly` cookie does not prevent injected script from making authenticated requests through the victim’s browser.

**Current protection.** Task titles and descriptions are rendered using Vue interpolation in `src/components/TaskCard.vue` and `src/views/TaskDetailView.vue`. Vue escapes text in these contexts, so a title containing HTML is displayed as text rather than executed. This does not prove that every possible XSS path is absent, particularly if future features introduce new rendering contexts.

**Mitigation.**

- Continue rendering task content as text; avoid inserting untrusted content with `v-html` or `innerHTML`.
- If rich text is required, sanitize it with a well-maintained HTML sanitizer configured for an explicit allowlist before rendering. Treat stored and API-provided content as untrusted.
- Validate untrusted URLs separately; text escaping does not make a dangerous URL safe.
- Deploy a restrictive Content Security Policy as defense in depth, not as a substitute for safe rendering.

## 4. Other backend security concerns

- **Authentication and authorization:** Require authentication where appropriate and check access to each task on the server for every read and write. `src/composables/useTasks.ts` currently assigns new tasks `userId: 1`; a real backend must derive identity from the authenticated session and must not trust a client-supplied user ID or task ID as proof of ownership.
- **Server-side validation:** The form checks required fields and sets browser-side length limits, but requests can bypass the UI. Validate types, lengths, dates and allowed status and priority values on the server.
- **CSRF and sessions:** If authentication uses cookies, protect state-changing requests against CSRF using an appropriate token or origin-checking strategy, alongside suitable `SameSite`, `Secure` and `HttpOnly` cookie settings. CORS is not an authorization mechanism or a complete CSRF defense.
- **Transport and operations:** Use HTTPS, protect secrets outside the frontend bundle, limit request sizes and rates, maintain dependencies, and log security-relevant events without exposing secrets or sensitive task content unnecessarily.

## 5. Recommended verification

1. Add backend tests that submit SQL metacharacters in task fields and IDs, confirm they are treated as data, and verify that one user cannot access another user’s tasks.
2. Add browser tests that render HTML-like text in titles and descriptions and confirm it remains visible text without executing. Test any future rich-text sanitizer separately.
3. Test rejected invalid requests and unauthorized create, read and update operations. If cookie authentication is used, test CSRF protections as well.
4. Review database permissions, dependency updates and the deployed security headers before release.

## 6. Conclusion

The current mock setup does not establish a SQL injection vulnerability, and the inspected Vue task views use text interpolation rather than raw HTML. A real shared backend would introduce new trust boundaries: parameterized queries, server-side authorization and safe rendering should be requirements from the start.

**References:** [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) · [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) · [Vue security guidance](https://vuejs.org/guide/best-practices/security.html)