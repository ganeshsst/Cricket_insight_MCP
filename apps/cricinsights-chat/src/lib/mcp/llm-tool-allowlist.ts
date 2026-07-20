/**
 * MCP tools hidden from the chat LLM (keep catalog lean for Nemotron).
 * Still available via MCP for Cursor / direct clients.
 *
 * Id-only player tools are excluded: small models often pass name slugs
 * (e.g. "ravindra-jadeja") as sportmonksId and blow up Postgres bigint casts.
 * Chat should use *_by_name / search_players instead.
 */
export const LLM_EXCLUDED_MCP_TOOLS = new Set([
  'compare_players',
  'get_player',
  'player_batting_stats',
  'player_bowling_stats',
  'get_player_career',
  'get_player_matches',
  'get_season_awards',
  'get_season_playoffs',
  'get_team_season_stats',
  'get_match_balls',
  'get_match_coverage',
]);

export function isLlmExposedMcpTool(name: string): boolean {
  return !LLM_EXCLUDED_MCP_TOOLS.has(name);
}
