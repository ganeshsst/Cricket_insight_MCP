export class VenueDto {
  venueId!: string;
  name!: string | null;
  city?: string | null;
  imagePath?: string | null;
  capacity?: number | null;
  floodlight?: boolean | null;
  matches!: number;
  firstMatchDate!: string | null;
  latestMatchDate!: string | null;
  note?: string;
}
