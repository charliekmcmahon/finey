/**
 * Resolves the project root for path lookups (secrets/, data/, .env.local).
 *
 * `process.cwd()` works for `next dev`/`next start` and for scripts run via `npm run` from
 * the project directory — but MCP clients that spawn this server don't all set the child
 * process's cwd (Claude Desktop's config has no `cwd` field, unlike Claude Code's
 * `.mcp.json`), so a spawned server can end up with cwd `/`. Setting `FINEY_PROJECT_ROOT` in
 * that client's env config sidesteps it entirely.
 */
export function projectRoot(): string {
  return process.env.FINEY_PROJECT_ROOT ?? process.cwd();
}
