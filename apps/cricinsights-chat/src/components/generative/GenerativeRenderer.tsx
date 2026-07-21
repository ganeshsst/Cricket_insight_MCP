'use client';

import type { UIComponent } from '@/types/generative-ui';
import { PlayerHero } from './patterns/PlayerHero';
import { DuelStage } from './patterns/DuelStage';
import { MetricDuelCard } from './patterns/MetricDuel';
import { BarChartCard, LineChartCard, RadarCard } from './patterns/Charts';
import { StatsTable } from './patterns/StatsTable';
import { Podium } from './patterns/Podium';
import { FollowUpChips, TextBlock } from './patterns/TextAndChips';
import {
  AiInsightsCard,
  ComparisonTableCard,
  ManhattanChartCard,
  MatchHeaderCard,
  PartnershipsCard,
  ScorecardMiniCard,
} from './patterns/MatchWidgets';

export function GenerativeRenderer({
  ui,
  onFollowUp,
}: {
  ui?: UIComponent[];
  onFollowUp?: (prompt: string) => void;
}) {
  if (!ui?.length) return null;

  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      {ui.map((item, i) => {
        const key = `${item.type}-${i}`;
        switch (item.type) {
          case 'text':
            return <TextBlock key={key} content={item.content} />;
          case 'player_hero':
            return <PlayerHero key={key} player={item.player} />;
          case 'duel_stage':
            return (
              <DuelStage
                key={key}
                playerA={item.playerA}
                playerB={item.playerB}
              />
            );
          case 'comparison_table':
            return (
              <ComparisonTableCard
                key={key}
                title={item.title}
                entities={item.entities}
                metrics={item.metrics}
              />
            );
          case 'metric_duel':
            return (
              <MetricDuelCard
                key={key}
                title={item.title}
                labelA={item.labelA}
                labelB={item.labelB}
                rows={item.rows}
                insight={item.insight}
              />
            );
          case 'bar_chart':
            return (
              <BarChartCard
                key={key}
                title={item.title}
                metric={item.metric}
                values={item.values}
                insight={item.insight}
              />
            );
          case 'line_chart':
            return (
              <LineChartCard
                key={key}
                title={item.title}
                metric={item.metric}
                values={item.values}
              />
            );
          case 'radar_chart':
            return (
              <RadarCard
                key={key}
                title={item.title}
                data={item.data}
                players={item.players}
              />
            );
          case 'manhattan_chart':
            return (
              <ManhattanChartCard
                key={key}
                title={item.title}
                innings={item.innings}
                insight={item.insight}
              />
            );
          case 'partnerships':
            return (
              <PartnershipsCard
                key={key}
                title={item.title}
                rows={item.rows}
                insight={item.insight}
              />
            );
          case 'match_header':
            return <MatchHeaderCard key={key} match={item.match} />;
          case 'scorecard_mini':
            return (
              <ScorecardMiniCard
                key={key}
                title={item.title}
                batting={item.batting ?? []}
                bowling={item.bowling}
                note={item.note}
              />
            );
          case 'stats_table':
            return (
              <StatsTable key={key} headers={item.headers} rows={item.rows} />
            );
          case 'podium':
            return (
              <Podium key={key} title={item.title} entries={item.entries} />
            );
          case 'ai_insights':
            return (
              <AiInsightsCard
                key={key}
                headline={item.headline}
                text={item.text}
              />
            );
          case 'follow_up_chips':
            return (
              <FollowUpChips
                key={key}
                prompts={item.prompts}
                onSelect={onFollowUp}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
