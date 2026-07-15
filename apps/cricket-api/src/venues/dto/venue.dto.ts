export class VenueDto {
  venueId!: string;
  name!: string | null;
  matches!: number;
  firstMatchDate!: string | null;
  latestMatchDate!: string | null;
  note?: string;
}
