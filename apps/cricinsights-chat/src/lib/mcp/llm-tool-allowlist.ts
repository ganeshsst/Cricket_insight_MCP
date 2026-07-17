/**
 * MCP tools hidden from the chat LLM.
 */
export const LLM_EXCLUDED_MCP_TOOLS = new Set([
  'compare_players',
  'get_player_matches',
  'get_season_awards',
  'get_season_playoffs',
  'get_team_season_stats',
]);

export function isLlmExposedMcpTool(name: string): boolean {
  return !LLM_EXCLUDED_MCP_TOOLS.has(name);
}
