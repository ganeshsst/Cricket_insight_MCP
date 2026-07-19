import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { VenueDto } from './dto/venue.dto.js';

@Injectable()
export class VenuesService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async getById(venueId: string): Promise<VenueDto> {
    const master = await this.db.query<{
      venue_id: string;
      name: string | null;
      city: string | null;
      image_path: string | null;
      capacity: number | null;
      floodlight: boolean | null;
    }>(
      `SELECT sportmonks_id::text AS venue_id,
              name,
              city,
              image_path,
              capacity,
              floodlight
       FROM master.venues
       WHERE sportmonks_id = $1::bigint`,
      [venueId],
    );

    const usage = await this.db.query<{
      matches: string;
      first_match_date: string | null;
      latest_match_date: string | null;
    }>(
      `SELECT COUNT(*)::text AS matches,
              MIN(date_key)::text AS first_match_date,
              MAX(date_key)::text AS latest_match_date
       FROM gold.fact_fixture
       WHERE venue_id = $1::bigint`,
      [venueId],
    );

    const usageRow = usage.rows[0];
    const matches = Number(usageRow?.matches ?? 0);
    const masterRow = master.rows[0];

    if (!masterRow && matches === 0) {
      throw new NotFoundException(`Venue ${venueId} not found`);
    }

    return {
      venueId: masterRow?.venue_id ?? venueId,
      name: masterRow?.name ?? null,
      city: masterRow?.city ?? null,
      imagePath: masterRow?.image_path ?? null,
      capacity: masterRow?.capacity ?? null,
      floodlight: masterRow?.floodlight ?? null,
      matches,
      firstMatchDate: usageRow?.first_match_date ?? null,
      latestMatchDate: usageRow?.latest_match_date ?? null,
      note: masterRow
        ? undefined
        : 'Venue master row missing; returning fixture usage only.',
    };
  }
}
