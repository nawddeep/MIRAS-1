// Mirrors the backend Pydantic models (backend/models). Keep in sync.

export type DataType = "Live" | "Scheduled" | "Estimated" | "Historical";
export type ProviderState = "ok" | "empty" | "not_configured" | "error" | "skipped";

export interface Provenance {
  source: string;
  data_type: DataType;
  last_checked: string;
  attribution?: string | null;
  note?: string | null;
}

export interface ProviderStatus {
  provider: string;
  state: ProviderState;
  message?: string | null;
}

export interface Envelope<T> {
  data: T;
  providers: ProviderStatus[];
  fetched_at: string;
}

export interface PhotoRef { ref: string; width?: number | null; height?: number | null; attributions: string[] }
export interface OpeningPeriod { open_day: number; open_time: string; close_day?: number | null; close_time?: string | null }
export interface OpeningHours { weekday_text: string[]; periods: OpeningPeriod[]; open_now?: boolean | null; raw?: string | null }
export interface PriceRange { min?: number | null; max?: number | null; currency: string; basis: string }

export interface Place {
  id: string;
  provider: "google" | "geoapify" | "nominatim" | "osm";
  provider_place_id: string;
  google_place_id?: string | null;
  name: string;
  category?: string | null;
  types: string[];
  primary_type?: string | null;
  business_status?: string | null;
  wikidata?: string | null;
  vehicle_types: string[];
  address?: string | null;
  lat: number;
  lng: number;
  maps_url: string;
  maps_url_is_listing: boolean;
  rating?: number | null;
  rating_count?: number | null;
  opening_hours?: OpeningHours | null;
  website?: string | null;
  phone?: string | null;
  photos: PhotoRef[];
  price_level?: string | null;
  price_range?: PriceRange | null;
  distance_m?: number | null;
  score?: number | null;
  score_reasons: string[];
  hidden_gem: boolean;
  provenance: Provenance;
}

export interface Suggestion {
  id: string;
  provider: string;
  title: string;
  subtitle?: string | null;
  lat?: number | null;
  lng?: number | null;
  google_place_id?: string | null;
}

export interface PlacesPage { places: Place[]; next_cursor?: string | null }

export interface DailyWeather {
  date: string;
  temp_max_c?: number | null;
  temp_min_c?: number | null;
  rain_probability_pct?: number | null;
  precipitation_mm?: number | null;
  condition?: string | null;
  weather_code?: number | null;
  wind_max_kmh?: number | null;
  sunrise?: string | null;
  sunset?: string | null;
  suggestion: "outdoor" | "indoor" | "mixed";
  provenance: Provenance;
}

export interface Money { amount: number; currency: string }

export interface FlightOption {
  kind: "flight"; id: string; airline?: string | null; flight_number?: string | null;
  departure?: string | null; arrival?: string | null; duration_min?: number | null; stops?: number | null;
  price?: Money | null; redirect_url?: string | null; redirect_label: string; provenance: Provenance;
}
export interface TrainOption {
  kind: "train"; id: string; train_number?: string | null; train_name?: string | null;
  from_station?: string | null; to_station?: string | null; departure?: string | null; arrival?: string | null;
  duration_min?: number | null; fare?: Money | null; running_status?: string | null;
  redirect_url?: string | null; redirect_label: string; provenance: Provenance;
}
export interface BusOption {
  kind: "bus"; id: string; operator?: string | null; route_name?: string | null; category?: string | null;
  from_stop?: string | null; to_stop?: string | null; departure?: string | null; arrival?: string | null;
  duration_min?: number | null; fare?: Money | null; redirect_url?: string | null; redirect_label: string; provenance: Provenance;
}
export interface TransportResults {
  origin_label: string; destination_label: string; date: string;
  flights: FlightOption[]; trains: TrainOption[]; buses: BusOption[];
  origin_airport?: string | null; destination_airport?: string | null; notes: string[];
}

export type Interest = "cafes" | "food" | "adventure" | "shopping" | "heritage" | "museums" | "nature" | "nightlife" | "arts" | "wellness" | "photography";
export type Rental = "none" | "two_wheeler" | "car" | "unsure";
export type Pace = "relaxed" | "balanced" | "packed";
export type BudgetTier = "budget" | "mid" | "premium";
export type TransportPref = "flight" | "train" | "bus" | "any";
export type StayType = "hotel" | "hostel" | "homestay" | "heritage";
export type TravelMode = "walk" | "cycle" | "scooter" | "car";

export interface Origin { label: string; lat: number; lng: number; airport_code?: string | null; station_code?: string | null }

export interface TripRequest {
  destination_id: string;
  origin?: Origin | null;
  start_date: string;
  days: number;
  adults: number;
  children: number;
  budget_tier: BudgetTier;
  budget_min_per_day?: number | null;
  budget_max_per_day?: number | null;
  transport: TransportPref;
  interests: Interest[];
  pace: Pace;
  stay_type?: StayType | null;
  rental: Rental;
  preset?: string | null;
}

export interface ModeEstimate {
  mode: TravelMode; distance_m: number; duration_s: number; data_type: "Live" | "Estimated"; source: string;
  traffic_aware: boolean; suitable: boolean; note?: string | null;
}
export interface Leg { distance_m: number; duration_s: number; mode: TravelMode; provenance: Provenance; modes: ModeEstimate[] }

export type BlockKind = "visit" | "meal" | "buffer" | "free";
export interface Block {
  id: string; kind: BlockKind; part: "morning" | "afternoon" | "evening";
  start: string; end: string; duration_min: number; title: string;
  place?: Place | null; visit_minutes_is_estimate: boolean; hours_note?: string | null;
  indoor?: boolean | null; leg_from_previous?: Leg | null; reason?: string | null;
  meal?: "lunch" | "dinner" | null; interests: string[]; auto: boolean;
}

export interface TrailWaypoint { name: string; lat: number; lng: number; place_id?: string | null }
export interface TrailRoute {
  id: string; title: string; label: "Suggested route"; mode: TravelMode; waypoints: TrailWaypoint[];
  geometry: [number, number][]; distance_m: number; duration_s: number;
  elevation_gain_m?: number | null; elevation_profile?: [number, number][] | null;
  difficulty: { level: "Easy" | "Moderate" | "Hard"; basis: string; is_estimate: boolean };
  navigation_url: string; navigation_urls: Record<string, string>; mode_estimates: ModeEstimate[]; provenance: Provenance;
}

export interface Area { id: string; name: string; lat: number; lng: number }
export interface Day {
  index: number; date: string; area?: Area | null; weather?: DailyWeather | null; weather_note?: string | null;
  blocks: Block[]; trails: TrailRoute[]; mode_totals: ModeEstimate[]; navigation_urls: Record<string, string>; search_notes: string[];
}

export interface RentalSection {
  choice: Rental; group: string; arrival_label: string; arrival: { lat: number; lng: number };
  stay_label: string; stay: { lat: number; lng: number }; near_arrival: Place[]; near_stay: Place[]; advice: string[]; notes: string[];
}

export interface BudgetLine {
  label: string; amount_min?: number | null; amount_max?: number | null; currency: string; basis: string;
  data_type: DataType | "User";
}

export interface Itinerary {
  id?: string | null;
  share_token?: string | null;
  request: TripRequest;
  destination_name: string;
  generated_at: string;
  days: Day[];
  stays: Place[];
  transport?: TransportResults | null;
  budget: { lines: BudgetLine[]; user_range_per_day?: [number | null, number | null] | null; notes: string[] };
  essentials: {
    emergency: { label: string; number: string }[];
    emergency_source: string;
    hospitals: Place[];
    pharmacies: Place[];
    documents: string[];
    money_notes: string[];
  };
  rentals?: RentalSection | null;
  providers: ProviderStatus[];
}

export interface Preset {
  id: string; label: string; description: string; interests: Interest[]; pace: Pace; budget_tier: BudgetTier;
}

export interface Meta {
  destinations: { id: string; name: string; region: string; lat: number; lng: number }[];
  interests: { key: Interest; label: string }[];
  presets: Preset[];
  before_you_rent: string[];
}
