export interface Team {
  id: number;
  name: string;
  abbreviation: string;
  created_at: string;
}

export interface TeamWithPlayers extends Team {
  players: Player[];
}

export interface Player {
  id: number;
  team_id: number;
  name: string;
  jersey_number: string;
  positions: string[];
  bats: 'L' | 'R' | 'S';
  throws: 'L' | 'R';
  active: number;
  default_batting_order: number; // 0 = not in default lineup
  default_position: string;
  defensive_rating: string;
  stealing: string;
  running: string;
}

export interface League {
  id: number;
  name: string;
  season: string;
  description: string;
  created_at: string;
  teams?: Team[];
}

export interface Game {
  id: number;
  home_team_id: number;
  away_team_id: number;
  home_team_name: string;
  away_team_name: string;
  home_abbr: string;
  away_abbr: string;
  game_date: string;
  status: 'scheduled' | 'in_progress' | 'final';
  innings: number;
  created_at: string;
}

export interface LineupEntry {
  id: number;
  game_id: number;
  team_id: number;
  batting_order: number;
  player_id: number;
  position: string;
  is_starter: number;
  // joined
  player_name?: string;
  jersey_number?: string;
  positions?: string[];
  bats?: string;
  throws?: string;
  defensive_rating?: string;
  stealing?: string;
  running?: string;
}

export type PlayType =
  | 'at_bat'
  | 'mid_pa_sb'
  | 'mid_pa_cs'
  | 'mid_pa_po'
  | 'mid_pa_wp'
  | 'mid_pa_pb'
  | 'mid_pa_bk'
  | 'mid_pa_e'
  | 'substitution'
  | 'inning_end'
  | 'game_end';

export interface Play {
  id: number;
  game_id: number;
  play_index: number;
  inning: number;
  half: 'top' | 'bottom';
  outs_before: number;
  batter_id: number | null;
  pitcher_id: number;
  offense_team_id: number;
  play_type: PlayType;
  result_code: string | null;
  runners_before: Record<string, number | null>;
  runners_after: Record<string, number | null>;
  outs_on_play: number;
  runs_on_play: number;
  scored_runner_ids: number[];
  rbi: number;
  earned: number;
  display_text: string | null;
  created_at: string;
}

export interface RunnerState {
  [base: string]: number | null;
}

export interface GameState {
  game_id: number;
  status: string;
  inning: number;
  half: 'top' | 'bottom';
  outs: number;
  runners: RunnerState;
  home_score: number;
  away_score: number;
  current_batter_id: number | null;
  current_pitcher_id: number | null;
  away_lineup: LineupEntry[];
  home_lineup: LineupEntry[];
  next_batting_order: number;
  play_count: number;
}

export interface BatterLine {
  player_id: number;
  player_name: string;
  position: string;
  batting_order: number;
  pa: number;
  ab: number;
  r: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  rbi: number;
  bb: number;
  so: number;
  hbp: number;
  sb: number;
  cs: number;
  sac: number;
  sf: number;
  lob: number;
  avg?: string;
}

export interface PitcherLine {
  player_id: number;
  player_name: string;
  ip_outs: number;
  bf: number;
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  hr: number;
  wp: number;
  hbp: number;
  era?: string;
}

export interface LineScoreTeam {
  runs: (number | null)[];
  total_r: number;
  total_h: number;
  total_e: number;
}

export interface BoxScore {
  game: Game & { home_team: Team; away_team: Team };
  line_score: {
    innings: number;
    away: LineScoreTeam;
    home: LineScoreTeam;
  };
  batting: {
    away: BatterLine[];
    home: BatterLine[];
  };
  pitching: {
    away: PitcherLine[];
    home: PitcherLine[];
  };
}

export interface LeaderEntry {
  player_id: number;
  player_name: string;
  team_abbr: string;
  value: string;
}

export interface TeamStanding {
  team_id: number;
  team_name: string;
  team_abbr: string;
  wins: number;
  losses: number;
  pct: string;
  gb: string;
  rs: number;
  ra: number;
}

export interface LeagueStats {
  standings: TeamStanding[];
  games_played: number;
  batting_leaders: {
    hr: LeaderEntry[];
    rbi: LeaderEntry[];
    avg: LeaderEntry[];
    ops: LeaderEntry[];
    h: LeaderEntry[];
    sb: LeaderEntry[];
  };
  pitching_leaders: {
    era: LeaderEntry[];
    so: LeaderEntry[];
    ip: LeaderEntry[];
  };
}

// Result picker types
export interface PlayResult {
  result_code: string;
  display_text: string;
  outs_on_play: number;
  is_hit: boolean;
}
