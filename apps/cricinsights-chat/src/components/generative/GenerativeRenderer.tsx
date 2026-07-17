'use client';

import type { UIComponent } from '@/types/generative-ui';
import { PlayerHero } from './patterns/PlayerHero';
import { DuelStage } from './patterns/DuelStage';
import { BarChartCard, LineChartCard, RadarCard } from './patterns/Charts';
import { StatsTable } from './patterns/StatsTable';
import { Podium } from './patterns/Podium';
import { FollowUpChips, TextBlock } from './patterns/TextAndChips';

export function GenerativeRenderer({
  ui,
  onFollowUp,
}: {
  ui?: UIComponent[];
  onFollowUp?: (prompt: string) => void;
}) {
  if (!ui?.length) return null;

  return (
    <div className="flex flex-col gap-4">
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
          case 'bar_chart':
            return (
              <BarChartCard
                key={key}
                title={item.title}
                metric={item.metric}
                values={item.values}
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
          case 'stats_table':
            return (
              <StatsTable key={key} headers={item.headers} rows={item.rows} />
            );
          case 'podium':
            return (
              <Podium key={key} title={item.title} entries={item.entries} />
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
