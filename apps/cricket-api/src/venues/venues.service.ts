import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { VenueDto } from './dto/venue.dto.js';

@Injectable()
export class VenuesService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async getById(venueId: string): Promise<VenueDto> {
    const { rows } = await this.db.query<{
      venue_id: string;
      matches: string;
      first_match_date: string | null;
      latest_match_date: string | null;
    }>(
      `SELECT venue_id::text,
              COUNT(*)::text AS matches,
              MIN(date_key)::text AS first_match_date,
              MAX(date_key)::text AS latest_match_date
       FROM gold.fact_fixture
       WHERE venue_id = $1::bigint
       GROUP BY venue_id`,
      [venueId],
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundException(`Venue ${venueId} not found`);
    }

    return {
      venueId: row.venue_id,
      name: null,
      matches: Number(row.matches),
      firstMatchDate: row.first_match_date,
      latestMatchDate: row.latest_match_date,
      note: 'Venue master data is not ingested yet; only fixture usage is available.',
    };
  }
}
