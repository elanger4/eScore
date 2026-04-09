import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GameState, Game, LineupEntry, Player } from '../../types';
import { teamsApi } from '../../api/teams';

interface Props {
  state: GameState;
  gameInfo: Game;
  onSubmit: (play: Record<string, unknown>) => void;
  onClose: () => void;
}

const FIELD_POSITIONS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

type SubType = 'bat' | 'pitch' | 'field' | 'run';

const SUB_LABELS: Record<SubType, string> = {
  bat: 'Pinch Hitter',
  pitch: 'Pitcher Change',
  field: 'Fielder Swap',
  run: 'Pinch Runner',
};

export default function SubstitutionModal({ state, gameInfo, onSubmit, onClose }: Props) {
  const [subType, setSubType] = useState<SubType>('bat');
  const [outPlayerId, setOutPlayerId] = useState<number | ''>('');
  const [inPlayerId, setInPlayerId] = useState<number | ''>('');
  const [newPosition, setNewPosition] = useState('');

  const offenseTeamId = state.half === 'top' ? gameInfo.away_team_id : gameInfo.home_team_id;
  const defenseTeamId = state.half === 'top' ? gameInfo.home_team_id : gameInfo.away_team_id;

  const offenseLineup = state.half === 'top' ? state.away_lineup : state.home_lineup;
  const defenseLineup = state.half === 'top' ? state.home_lineup : state.away_lineup;

  const { data: offenseRoster = [] } = useQuery({
    queryKey: ['teamPlayers', offenseTeamId],
    queryFn: () => teamsApi.listPlayers(offenseTeamId),
  });
  const { data: defenseRoster = [] } = useQuery({
    queryKey: ['teamPlayers', defenseTeamId],
    queryFn: () => teamsApi.listPlayers(defenseTeamId),
  });

  const offenseLineupIds = useMemo(() => new Set(offenseLineup.map(e => e.player_id)), [offenseLineup]);
  const defenseLineupIds = useMemo(() => new Set(defenseLineup.map(e => e.player_id)), [defenseLineup]);

  const offenseBench = useMemo(
    () => offenseRoster.filter(p => !offenseLineupIds.has(p.id)),
    [offenseRoster, offenseLineupIds],
  );
  const defenseBench = useMemo(
    () => defenseRoster.filter(p => !defenseLineupIds.has(p.id)),
    [defenseRoster, defenseLineupIds],
  );

  const runnersOnBase = useMemo(
    () =>
      Object.entries(state.runners)
        .filter(([, id]) => id !== null)
        .map(([base, id]) => {
          const entry = offenseLineup.find(e => e.player_id === id);
          return { base, playerId: id!, name: entry?.player_name ?? `#${id}` };
        }),
    [state.runners, offenseLineup],
  );

  function handleSubTypeChange(t: SubType) {
    setSubType(t);
    setInPlayerId('');
    setNewPosition('');
    if (t === 'pitch') {
      const pitcher = defenseLineup.find(e => e.position === 'P');
      setOutPlayerId(pitcher?.player_id ?? '');
    } else {
      setOutPlayerId('');
    }
  }

  // Players eligible to come IN by sub type
  const inOptions = useMemo((): Player[] => {
    switch (subType) {
      case 'bat':
        return offenseBench.filter(p => !p.positions.includes('P'));
      case 'pitch':
        return defenseBench.filter(p => p.positions.includes('P'));
      case 'field':
        return defenseRoster.filter(p => !p.positions.includes('P'));
      case 'run':
        return offenseBench.filter(p => !p.positions.includes('P'));
    }
  }, [subType, offenseBench, defenseBench, defenseRoster]);

  // Players eligible to come OUT by sub type (for lineup-based selectors)
  const outLineupOptions = useMemo((): LineupEntry[] => {
    switch (subType) {
      case 'bat':
        return offenseLineup;
      case 'field':
        return defenseLineup.filter(e => e.position !== 'P');
      default:
        return [];
    }
  }, [subType, offenseLineup, defenseLineup]);

  const computeRunnersAfter = () => {
    if (subType !== 'run' || outPlayerId === '' || inPlayerId === '') return state.runners;
    const updated: Record<string, number | null> = { ...state.runners };
    for (const base of Object.keys(updated)) {
      if (updated[base] === outPlayerId) updated[base] = inPlayerId as number;
    }
    return updated;
  };

  const buildCode = () => {
    if (subType === 'pitch') return `SUB:pitch:${inPlayerId}:${outPlayerId}`;
    if (subType === 'field') return `SUB:field:${inPlayerId}:${outPlayerId}:${newPosition}`;
    if (subType === 'run') return `SUB:run:${inPlayerId}:${outPlayerId}`;
    return `SUB:bat:${inPlayerId}:${outPlayerId}`;
  };

  const buildDisplay = () => {
    const allLineup = [...offenseLineup, ...defenseLineup];
    const outName =
      allLineup.find(e => e.player_id === outPlayerId)?.player_name ??
      runnersOnBase.find(r => r.playerId === outPlayerId)?.name ??
      `#${outPlayerId}`;
    const inPlayer = [...offenseRoster, ...defenseRoster].find(p => p.id === inPlayerId);
    const inName = inPlayer?.name ?? `#${inPlayerId}`;
    if (subType === 'pitch') return `Pitcher change: ${inName} for ${outName}`;
    if (subType === 'bat') return `PH: ${inName} for ${outName}`;
    if (subType === 'field') return `Swap: ${inName} for ${outName} (${newPosition})`;
    return `PR: ${inName} for ${outName}`;
  };

  const handleSubmit = () => {
    if (outPlayerId === '' || inPlayerId === '') return;
    if (subType === 'field' && !newPosition) return;
    onSubmit({
      play_type: 'substitution',
      pitcher_id: state.current_pitcher_id,
      result_code: buildCode(),
      runners_before: state.runners,
      runners_after: computeRunnersAfter(),
      outs_before: state.outs,
      outs_on_play: 0,
      runs_on_play: 0,
      scored_runner_ids: [],
      inning: state.inning,
      half: state.half,
      offense_team_id: offenseTeamId,
      display_text: buildDisplay(),
    });
  };

  const isValid =
    outPlayerId !== '' &&
    inPlayerId !== '' &&
    (subType !== 'field' || !!newPosition);

  const currentPitcher = defenseLineup.find(e => e.position === 'P');

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Substitution</h2>
          <button className="text-gray-400 hover:text-white text-lg p-1" onClick={onClose}>✕</button>
        </div>

        {/* Sub type tabs */}
        <div className="grid grid-cols-2 gap-1.5 mb-5">
          {(['bat', 'pitch', 'field', 'run'] as const).map(t => (
            <button
              key={t}
              className={`py-1.5 rounded text-sm font-medium border transition-colors ${
                subType === t
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-400'
              }`}
              onClick={() => handleSubTypeChange(t)}
            >
              {SUB_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {/* ── Player OUT ── */}

          {subType === 'pitch' && (
            <div>
              <label className="label">Pitcher leaving</label>
              <div className="input bg-gray-800/50 text-gray-300">
                {currentPitcher
                  ? `${currentPitcher.batting_order}. ${currentPitcher.player_name ?? `#${currentPitcher.player_id}`} (P)`
                  : <span className="text-gray-500">No pitcher in lineup</span>}
              </div>
            </div>
          )}

          {(subType === 'bat' || subType === 'field') && (
            <div>
              <label className="label">
                {subType === 'bat' ? 'Player leaving (offense)' : 'Player leaving (defense)'}
              </label>
              <select
                className="select"
                value={outPlayerId}
                onChange={e => setOutPlayerId(e.target.value === '' ? '' : parseInt(e.target.value))}
              >
                <option value="">— select player —</option>
                {outLineupOptions.map(e => (
                  <option key={e.player_id} value={e.player_id}>
                    {e.batting_order}. {e.player_name ?? `#${e.player_id}`} ({e.position})
                  </option>
                ))}
              </select>
            </div>
          )}

          {subType === 'run' && (
            <div>
              <label className="label">Runner being replaced</label>
              {runnersOnBase.length === 0 ? (
                <div className="text-xs text-amber-400 py-2">No runners on base.</div>
              ) : (
                <select
                  className="select"
                  value={outPlayerId}
                  onChange={e => setOutPlayerId(e.target.value === '' ? '' : parseInt(e.target.value))}
                >
                  <option value="">— select runner —</option>
                  {runnersOnBase.map(r => (
                    <option key={r.playerId} value={r.playerId}>
                      {r.name} (on {r.base === 'H' ? 'home' : `${r.base}B`})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* ── Player IN ── */}
          <div>
            <label className="label">
              {subType === 'bat' ? 'Pinch hitter'
                : subType === 'pitch' ? 'New pitcher'
                : subType === 'field' ? 'Replacing fielder'
                : 'Pinch runner'}
            </label>
            {inOptions.length === 0 ? (
              <div className="text-xs text-amber-400 py-2">No eligible players available.</div>
            ) : (
              <select
                className="select"
                value={inPlayerId}
                onChange={e => setInPlayerId(e.target.value === '' ? '' : parseInt(e.target.value))}
              >
                <option value="">— select player —</option>
                {inOptions.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.jersey_number ? ` #${p.jersey_number}` : ''}
                    {p.positions.length > 0 ? ` (${p.positions.join('/')})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* ── New position (fielder swap only) ── */}
          {subType === 'field' && (
            <div>
              <label className="label">New position</label>
              <select className="select" value={newPosition} onChange={e => setNewPosition(e.target.value)}>
                <option value="">— select position —</option>
                {FIELD_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <button className="btn-primary flex-1" onClick={handleSubmit} disabled={!isValid}>
            Confirm Substitution
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
