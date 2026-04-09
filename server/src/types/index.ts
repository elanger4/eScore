export interface Team {
  id: number;
  name: string;
  abbreviation: string;
  created_at: string;
}

export interface League {
  id: number;
  name: string;
  season: string;
  description: string;
  created_at: string;
}

export interface Player {
  id: number;
  team_id: number;
  name: string;
  jersey_number: string;
  positions: string[]; // JSON array stored as text
  bats: 'L' | 'R' | 'S';
  throws: 'L' | 'R';
  active: number; // 1 = active, 0 = inactive
  default_batting_order: number; // 0 = not in default lineup
  default_position: string;
}

export interface Game {
  id: number;
  home_team_id: number;
  away_team_id: number;
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
  player_name?: string;
  jersey_number?: string;
}

export type PlayType =
  | 'at_bat'
  | 'mid_pa_sb'
  | 'mid_pa_cs'
  | 'mid_pa_po'
  | 'mid_pa_wp'
  | 'mid_pa_pb'
  | 'mid_pa_bk'
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
  runners_before: string; // JSON: {"1": pid, "2": pid, "3": pid}
  runners_after: string;  // JSON same shape
  outs_on_play: number;
  runs_on_play: number;
  scored_runner_ids: string; // JSON array of player ids
  rbi: number;
  earned: number; // 1 = earned, 0 = unearned
  display_text: string | null;
  created_at: string;
}

export interface PitchingAppearance {
  id: number;
  game_id: number;
  pitcher_id: number;
  team_id: number;
  entry_play_index: number;
  exit_play_index: number | null;
  inherited_runners: string; // JSON array of player ids
}

// Game state derived from play log
export interface RunnerState {
  [base: string]: number | null; // "1", "2", "3" -> player_id or null
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
  current_pitcher_id: number | null; // pitcher for the current half-inning
  away_lineup: LineupEntry[];
  home_lineup: LineupEntry[];
  next_batting_order: number; // next batter's slot (1-9)
  play_count: number;
}

// Box score types
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
  ip_outs: number; // total outs recorded (divide by 3 to display as X.Y)
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
