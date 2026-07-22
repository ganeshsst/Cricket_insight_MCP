'use client';

import { motion } from 'framer-motion';
import type { PlayerHeroData } from '@/types/generative-ui';
import { PlayerHero } from './PlayerHero';

export function DuelStage({
  playerA,
  playerB,
}: {
  playerA: PlayerHeroData;
  playerB: PlayerHeroData;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-6 sm:grid-cols-[1fr_auto_1fr]">
      <PlayerHero player={playerA} size="md" />
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full glass display text-lg text-accent"
      >
        VS
      </motion.div>
      <PlayerHero player={playerB} size="md" />
    </div>
  );
}
