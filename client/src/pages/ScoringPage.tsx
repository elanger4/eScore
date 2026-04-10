import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gamesApi } from '../api/games';
import { GameState, Play, LineupEntry, RunnerState } from '../types';
import { displayText, outsOnPlay } from '../lib/playParser';
import FieldView from '../components/scoring/FieldView';
import ResultPicker from '../components/scoring/ResultPicker';
import MidPAPanel from '../components/scoring/MidPAPanel';
import SubstitutionModal from '../components/scoring/SubstitutionModal';
import Scoreboard from '../components/scoring/Scoreboard';
import RunnerAdvancementModal from '../components/scoring/RunnerAdvancementModal';
import FielderPickerModal from '../components/scoring/FielderPickerModal';

export default function ScoringPage() {
  const { id } = useParams<{ id: string }>();
  const gameId = parseInt(id!);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: gameInfo } = useQuery({ queryKey: ['game', gameId], queryFn: () => gamesApi.get(gameId) });
  const { data: state, isLoading: stateLoading } = useQuery({
    queryKey: ['gameState', gameId],
    queryFn: () => gamesApi.getState(gameId),
    refetchOnWindowFocus: false,
  });
  const { data: plays = [] } = useQuery({
    queryKey: ['plays', gameId],
    queryFn: () => gamesApi.getPlays(gameId),
  });

  const [showMidPA, setShowMidPA] = useState(false);
  const [showSub, setShowSub] = useState(false);
  const [earnedInput, setEarnedInput] = useState(true);
  const [pendingResult, setPendingResult] = useState<{ resultCode: string; dispText: string } | null>(null);
  const [pendingFielderPlay, setPendingFielderPlay] = useState<string | null>(null);
  const [runnerAction, setRunnerAction] = useState<{ base: string; runnerId: number } | null>(null);

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['gameState', gameId] });
    qc.invalidateQueries({ queryKey: ['plays', gameId] });
    qc.invalidateQueries({ queryKey: ['games'] });
  }, [qc, gameId]);

  const startGame = useMutation({
    mutationFn: () => gamesApi.start(gameId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['game', gameId] }); invalidate(); },
  });

  const endGame = useMutation({
    mutationFn: () => gamesApi.end(gameId),
    onSuccess: () => navigate(`/games/${gameId}/boxscore`),
  });

  const addPlay = useMutation({
    mutationFn: (play: Record<string, unknown>) => gamesApi.addPlay(gameId, play),
    onSuccess: () => { invalidate(); setEarnedInput(true); },
  });

  const undoPlay = useMutation({
    mutationFn: () => gamesApi.undoLastPlay(gameId),
    onSuccess: () => invalidate(),
  });

  useEffect(() => {
    if (!state || state.status !== 'in_progress') return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const shortcuts: Record<string, () => void> = {
        'k': () => handleResultSelect('K', 'K'),
        'K': () => handleResultSelect('KL', 'K (looking)'),
        'w': () => handleResultSelect('BB', 'BB'),
        'h': () => handleResultSelect('HR', 'HR'),
        '1': () => handleResultSelect('1B', '1B'),
        '2': () => handleResultSelect('2B', '2B'),
        '3': () => handleResultSelect('3B', '3B'),
        'b': () => handleResultSelect('HBP', 'HBP'),
      };
      if (shortcuts[e.key]) { e.preventDefault(); shortcuts[e.key](); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state, earnedInput]); // eslint-disable-line

  if (stateLoading || !state) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 text-sm">Loading game…</div>
      </div>
    );
  }

  const offenseTeamId = state.half === 'top' ? gameInfo?.away_team_id : gameInfo?.home_team_id;
  const currentLineup = state.half === 'top' ? state.away_lineup : state.home_lineup;
  const pitchingLineup = state.half === 'top' ? state.home_lineup : state.away_lineup;

  // ── At-bat result selection ──────────────────────────────────────────────

  function handleResultSelect(resultCode: string, dispText: string) {
    if (!state) return;

    const hasRunners = Object.values(state.runners).some(v => v !== null);

    // Results where runners stay put / have a deterministic outcome — no modal needed
    const isAutoResult =
      resultCode === 'HR' ||
      ['K', 'KL', 'BB', 'IBB', 'HBP'].includes(resultCode) ||
      (state.outs + outsOnPlay(resultCode) >= 3); // inning ends — stranded runners don't matter

    if (!hasRunners || isAutoResult) {
      const { runners_after, runs_on_play, scored_runner_ids } = computeAtBatOutcome(
        resultCode, state.runners, state.current_batter_id,
      );
      submitAtBat(resultCode, dispText, runners_after, runs_on_play, scored_runner_ids);
      return;
    }

    setPendingResult({ resultCode, dispText });
  }

  function submitAtBat(
    resultCode: string,
    dispText: string,
    runners_after: Record<string, number | null>,
    runs_on_play: number,
    scored_runner_ids: number[],
  ) {
    if (!state || !offenseTeamId) return;
    const outs = outsOnPlay(resultCode);
    const totalOuts = state.outs + outs;
    const isInningEnd = totalOuts >= 3;

    // Auto-RBI: errors don't earn an RBI; everything else does
    const autoRbi = resultCode.startsWith('E') ? 0 : scored_runner_ids.length;

    const playData: Record<string, unknown> = {
      play_type: 'at_bat',
      batter_id: state.current_batter_id,
      pitcher_id: state.current_pitcher_id,
      result_code: resultCode,
      runners_before: state.runners,
      runners_after,
      outs_before: state.outs,
      outs_on_play: outs,
      runs_on_play,
      scored_runner_ids,
      inning: state.inning,
      half: state.half,
      rbi: autoRbi,
      earned: earnedInput ? 1 : 0,
      offense_team_id: offenseTeamId,
      display_text: dispText,
    };

    addPlay.mutate(playData, {
      onSuccess: async ({ state: newState }) => {
        const gameInnings = gameInfo?.innings ?? 9;

        // Walk-off: home team scores to take the lead in bottom of inning >= scheduled innings
        if (isWalkOff(state.half, state.inning, newState.home_score, newState.away_score, gameInnings)) {
          endGame.mutate();
          return;
        }

        if (isInningEnd && newState.outs >= 3) {
          await gamesApi.addPlay(gameId, {
            play_type: 'inning_end',
            pitcher_id: state.current_pitcher_id,
            runners_before: playData.runners_after,
            runners_after: {},
            outs_before: totalOuts,
            outs_on_play: 0,
            runs_on_play: 0,
            scored_runner_ids: [],
            inning: state.inning,
            half: state.half,
            offense_team_id: offenseTeamId,
            earned: 1,
          });

          if (shouldEndAfterInning(state.inning, state.half, newState.home_score, newState.away_score, gameInnings)) {
            endGame.mutate();
            return;
          }

          invalidate();
        }
      },
    });
  }

  // ── Fielded play picker ──────────────────────────────────────────────────

  function handleFielderPlay(type: string) {
    setPendingFielderPlay(type);
  }

  function handleFielderConfirm(code: string, text: string) {
    setPendingFielderPlay(null);
    handleResultSelect(code, text);
  }

  // ── Mid-PA events ────────────────────────────────────────────────────────

  function submitMidPA(playType: string, resultCode: string, dispText: string, extra?: Partial<Record<string, unknown>>) {
    if (!state || !offenseTeamId) return;
    const outsOnPlay = (extra?.outs_on_play as number) ?? 0;
    const newTotalOuts = state.outs + outsOnPlay;
    const isInningEnd = newTotalOuts >= 3;
    const runnersAfter = (extra?.runners_after ?? state.runners) as Record<string, number | null>;

    addPlay.mutate({
      play_type: playType,
      pitcher_id: state.current_pitcher_id,
      result_code: resultCode,
      runners_before: state.runners,
      runners_after: state.runners,
      outs_before: state.outs,
      outs_on_play: 0,
      runs_on_play: 0,
      scored_runner_ids: [],
      inning: state.inning,
      half: state.half,
      offense_team_id: offenseTeamId,
      display_text: dispText,
      rbi: 0,
      earned: 1,
      ...extra,
    }, {
      onSuccess: async ({ state: newState }) => {
        if (isInningEnd && newState.outs >= 3) {
          await gamesApi.addPlay(gameId, {
            play_type: 'inning_end',
            pitcher_id: state.current_pitcher_id,
            runners_before: runnersAfter,
            runners_after: {},
            outs_before: newTotalOuts,
            outs_on_play: 0,
            runs_on_play: 0,
            scored_runner_ids: [],
            inning: state.inning,
            half: state.half,
            offense_team_id: offenseTeamId,
            earned: 1,
          });
          invalidate();
        }
      },
    });
  }

  // ── Runner click (SB / CS) ────────────────────────────────────────────────

  function handleRunnerClick(base: string, runnerId: number) {
    setRunnerAction({ base, runnerId });
  }

  function submitRunnerEvent(
    type: 'sb' | 'cs',
    fromBase: string,
    toBase: string,
    runnerId: number,
  ) {
    if (!state || !offenseTeamId) return;
    setRunnerAction(null);

    const runnersAfter: RunnerState = { ...state.runners };
    runnersAfter[fromBase] = null;

    const isSB = type === 'sb';
    const scored = isSB && toBase === 'H';
    if (isSB && toBase !== 'H') runnersAfter[toBase] = runnerId;

    const baseLabel = toBase === '2' ? '2nd' : toBase === '3' ? '3rd' : 'home';
    const playType = isSB ? 'mid_pa_sb' : 'mid_pa_cs';
    const resultCode = isSB
      ? `SB:${toBase}:${runnerId}`
      : `CS:${toBase}:${runnerId}:`;
    const dispText = isSB ? `SB (${baseLabel})` : `CS (${baseLabel})`;

    const outsOnEvent = isSB ? 0 : 1;
    const newTotalOuts = state.outs + outsOnEvent;
    const isInningEnd = newTotalOuts >= 3;

    addPlay.mutate({
      play_type: playType,
      pitcher_id: state.current_pitcher_id,
      result_code: resultCode,
      runners_before: state.runners,
      runners_after: runnersAfter,
      outs_before: state.outs,
      outs_on_play: outsOnEvent,
      runs_on_play: scored ? 1 : 0,
      scored_runner_ids: scored ? [runnerId] : [],
      inning: state.inning,
      half: state.half,
      offense_team_id: offenseTeamId,
      display_text: dispText,
      rbi: 0,
      earned: 1,
    }, {
      onSuccess: async ({ state: newState }) => {
        const gameInnings = gameInfo?.innings ?? 9;

        // Walk-off: home team scores to take the lead in bottom of inning >= scheduled innings
        if (isWalkOff(state.half, state.inning, newState.home_score, newState.away_score, gameInnings)) {
          endGame.mutate();
          return;
        }

        if (isInningEnd && newState.outs >= 3) {
          await gamesApi.addPlay(gameId, {
            play_type: 'inning_end',
            pitcher_id: state.current_pitcher_id,
            runners_before: runnersAfter,
            runners_after: {},
            outs_before: newTotalOuts,
            outs_on_play: 0,
            runs_on_play: 0,
            scored_runner_ids: [],
            inning: state.inning,
            half: state.half,
            offense_team_id: offenseTeamId,
            earned: 1,
          });

          if (shouldEndAfterInning(state.inning, state.half, newState.home_score, newState.away_score, gameInnings)) {
            endGame.mutate();
            return;
          }

          invalidate();
        }
      },
    });
  }

  function submitRunnerAdvance(
    type: 'bk' | 'wp' | 'pb' | 'e',
    fromBase: string,
    toBase: string,
    runnerId: number,
  ) {
    if (!state || !offenseTeamId) return;
    setRunnerAction(null);

    const runnersAfter: RunnerState = { ...state.runners };
    runnersAfter[fromBase] = null;
    const scored = toBase === 'H';
    if (!scored) runnersAfter[toBase] = runnerId;

    const playTypeMap = { bk: 'mid_pa_bk', wp: 'mid_pa_wp', pb: 'mid_pa_pb', e: 'mid_pa_e' } as const;
    const codeMap = { bk: 'BK', wp: 'WP', pb: 'PB', e: 'E' };
    const labelMap = { bk: 'Balk', wp: 'Wild Pitch', pb: 'Passed Ball', e: 'Error' };
    const destLabel = toBase === 'H' ? 'home' : toBase === '2' ? '2nd' : toBase === '3' ? '3rd' : '1st';

    addPlay.mutate({
      play_type: playTypeMap[type],
      pitcher_id: state.current_pitcher_id,
      result_code: `${codeMap[type]}:${runnerId}:${fromBase}:${toBase}`,
      runners_before: state.runners,
      runners_after: runnersAfter,
      outs_before: state.outs,
      outs_on_play: 0,
      runs_on_play: scored ? 1 : 0,
      scored_runner_ids: scored ? [runnerId] : [],
      inning: state.inning,
      half: state.half,
      offense_team_id: offenseTeamId,
      display_text: `${labelMap[type]} (runner →${destLabel})`,
      rbi: 0,
      earned: type === 'e' ? 0 : 1,
    }, {
      onSuccess: async ({ state: newState }) => {
        const gameInnings = gameInfo?.innings ?? 9;
        if (isWalkOff(state.half, state.inning, newState.home_score, newState.away_score, gameInnings)) {
          endGame.mutate();
        }
      },
    });
  }

  const recentPlays = (plays as Play[]).slice(-8).reverse();
  const allPlayers = [...state.away_lineup, ...state.home_lineup];

  // Which sidebar is fielding this half?
  const awayIsFielding = state.half === 'bottom';
  const homeIsFielding = state.half === 'top';

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 3.5rem)' }}>
      <Scoreboard state={state} gameInfo={gameInfo} />

      {gameInfo?.status === 'scheduled' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-slate-400">Set lineups and start the game.</div>
          <button className="btn-success px-10 py-3 text-base" onClick={() => startGame.mutate()}>
            ▶ Start Game
          </button>
        </div>
      )}

      {gameInfo?.status === 'final' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-2xl font-black text-white">Game Final</div>
          <Link to={`/games/${gameId}/boxscore`} className="btn-primary px-10 py-3 text-base">
            View Box Score →
          </Link>
        </div>
      )}

      {gameInfo?.status === 'in_progress' && (
        <div className="flex-1 grid grid-cols-[220px_1fr_220px] gap-4 max-w-6xl mx-auto w-full p-4">

          {/* Away sidebar */}
          <LineupSidebar
            lineup={state.away_lineup}
            label={gameInfo?.away_team_name ?? 'Away'}
            abbr={gameInfo?.away_abbr ?? 'AWY'}
            currentBatterId={state.half === 'top' ? state.current_batter_id : null}
            currentPitcherId={state.half === 'bottom' ? state.current_pitcher_id : null}
            isFielding={awayIsFielding}
          />

          {/* Center scoring panel */}
          <div className="flex flex-col gap-4">
            {/* Field view */}
            <div className="card p-2">
              <FieldView
                runners={state.runners}
                battingLineup={currentLineup}
                fieldingLineup={pitchingLineup}
                currentBatterId={state.current_batter_id}
                onRunnerClick={handleRunnerClick}
              />
              {(['3', '2', '1'] as const).some(b => state.runners[b]) && (
                <div className="flex gap-3 pt-1.5 px-1 flex-wrap">
                  {(['3', '2', '1'] as const).map(base => {
                    const runnerId = state.runners[base];
                    if (!runnerId) return null;
                    const runner = allPlayers.find(e => e.player_id === runnerId);
                    const baseLabel = base === '1' ? '1st' : base === '2' ? '2nd' : '3rd';
                    return (
                      <div key={base} className="flex items-center gap-1.5 text-[10px] font-mono leading-none">
                        <span className="text-slate-500">{baseLabel}</span>
                        <span className="text-yellow-300/90 truncate max-w-[70px]">{runner?.player_name ?? `#${runnerId}`}</span>
                        {runner?.stealing && <span className="text-sky-400">SB:{runner.stealing}</span>}
                        {runner?.running && <span className="text-emerald-400">SPD:{runner.running}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Earned + undo row */}
            <div className="flex gap-4 items-center">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-blue-500 rounded"
                  checked={earnedInput}
                  onChange={e => setEarnedInput(e.target.checked)}
                />
                <span className="text-slate-300 font-medium">Earned run</span>
              </label>
              <div className="flex-1" />
              <button
                className="btn-secondary text-xs"
                onClick={() => undoPlay.mutate()}
                disabled={undoPlay.isPending || (plays as Play[]).length === 0}
              >
                ↩ Undo
              </button>
            </div>

            {/* Result picker */}
            <div className="card">
              <ResultPicker
                onSelect={handleResultSelect}
                onFielderPlay={handleFielderPlay}
                disabled={addPlay.isPending}
              />
            </div>

            {/* Mid-PA / Sub / End */}
            <div className="flex gap-2 flex-wrap">
              <button
                className={`btn-secondary text-xs ${showMidPA ? 'border-blue-600 text-blue-300' : ''}`}
                onClick={() => setShowMidPA(v => !v)}
              >
                ⚡ Mid-PA Events
              </button>
              <button className="btn-secondary text-xs" onClick={() => setShowSub(true)}>
                ↕ Substitution
              </button>
              <div className="flex-1" />
              <button
                className="btn-danger text-xs"
                onClick={() => { if (confirm('End the game and go to box score?')) endGame.mutate(); }}
              >
                End Game
              </button>
            </div>

            {showMidPA && (
              <MidPAPanel
                runners={state.runners}
                lineup={allPlayers}
                onSubmit={submitMidPA}
              />
            )}

            {/* Recent plays */}
            <div className="card">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Recent Plays</div>
              {recentPlays.length === 0 ? (
                <div className="text-xs text-slate-600 py-2">No plays recorded yet.</div>
              ) : (
                <div className="space-y-0.5">
                  {recentPlays.map((p, i) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 text-xs py-1.5 border-b border-navy-700/40 last:border-0 ${
                        i === 0 ? 'text-white' : 'text-slate-500'
                      }`}
                    >
                      <span className="font-mono text-slate-600 w-5">{p.play_index}</span>
                      <span className="font-mono w-10 text-slate-500">
                        {p.inning}{p.half === 'top' ? '▲' : '▼'}
                      </span>
                      <span className="flex-1 font-medium">
                        {p.play_type === 'at_bat'
                          ? displayText(p.result_code ?? '')
                          : p.display_text ?? p.play_type.replace('mid_pa_', '').toUpperCase()}
                      </span>
                      {p.rbi > 0 && (
                        <span className="text-yellow-400 font-bold">{p.rbi} RBI</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Home sidebar */}
          <LineupSidebar
            lineup={state.home_lineup}
            label={gameInfo?.home_team_name ?? 'Home'}
            abbr={gameInfo?.home_abbr ?? 'HME'}
            currentBatterId={state.half === 'bottom' ? state.current_batter_id : null}
            currentPitcherId={state.half === 'top' ? state.current_pitcher_id : null}
            isFielding={homeIsFielding}
            alignRight
          />
        </div>
      )}

      {/* Modals */}

      {showSub && state && gameInfo && (
        <SubstitutionModal
          state={state}
          gameInfo={gameInfo}
          onSubmit={(playData) => { addPlay.mutate(playData); setShowSub(false); }}
          onClose={() => setShowSub(false)}
        />
      )}

      {pendingResult && state && (
        <RunnerAdvancementModal
          resultCode={pendingResult.resultCode}
          dispText={pendingResult.dispText}
          batterId={state.current_batter_id}
          batterName={allPlayers.find(e => e.player_id === state.current_batter_id)?.player_name ?? '—'}
          runnersBefore={state.runners}
          allPlayers={allPlayers}
          onConfirm={(runnersAfter, runsOnPlay, scoredRunnerIds) => {
            setPendingResult(null);
            submitAtBat(pendingResult.resultCode, pendingResult.dispText, runnersAfter, runsOnPlay, scoredRunnerIds);
          }}
          onClose={() => setPendingResult(null)}
        />
      )}

      {pendingFielderPlay && state && (
        <FielderPickerModal
          playType={pendingFielderPlay as Parameters<typeof FielderPickerModal>[0]['playType']}
          fieldingLineup={pitchingLineup}
          onSelect={handleFielderConfirm}
          onClose={() => setPendingFielderPlay(null)}
        />
      )}

      {runnerAction && state && (
        <RunnerActionPanel
          base={runnerAction.base}
          runnerId={runnerAction.runnerId}
          runnerName={allPlayers.find(e => e.player_id === runnerAction.runnerId)?.player_name}
          onSubmit={submitRunnerEvent}
          onAdvance={submitRunnerAdvance}
          onClose={() => setRunnerAction(null)}
        />
      )}
    </div>
  );
}

// ── Runner Action Panel (SB / CS / Advance) ──────────────────────────────────

function RunnerActionPanel({
  base, runnerId, runnerName, onSubmit, onAdvance, onClose,
}: {
  base: string;
  runnerId: number;
  runnerName?: string;
  onSubmit: (type: 'sb' | 'cs', fromBase: string, toBase: string, runnerId: number) => void;
  onAdvance: (type: 'bk' | 'wp' | 'pb' | 'e', fromBase: string, toBase: string, runnerId: number) => void;
  onClose: () => void;
}) {
  const [advType, setAdvType] = useState<'bk' | 'wp' | 'pb' | 'e' | null>(null);

  const baseName = base === '1' ? 'first' : base === '2' ? 'second' : 'third';

  // Bases for SB/CS (next 1–2 bases ahead, no skipping to home from 1st)
  const sbcsBases: { base: string; label: string }[] = [];
  if (base === '1') sbcsBases.push({ base: '2', label: '2nd' }, { base: '3', label: '3rd' });
  if (base === '2') sbcsBases.push({ base: '3', label: '3rd' }, { base: 'H', label: 'Home' });
  if (base === '3') sbcsBases.push({ base: 'H', label: 'Home' });

  // All forward bases (for BK/WP/PB/Error — can skip bases)
  const advBases: { base: string; label: string }[] = [];
  if (base === '1') advBases.push({ base: '2', label: '2nd' }, { base: '3', label: '3rd' }, { base: 'H', label: 'Home' });
  if (base === '2') advBases.push({ base: '3', label: '3rd' }, { base: 'H', label: 'Home' });
  if (base === '3') advBases.push({ base: 'H', label: 'Home' });

  const ADV_TYPES = [
    { type: 'bk' as const, label: 'Balk' },
    { type: 'wp' as const, label: 'Wild Pitch' },
    { type: 'pb' as const, label: 'Passed Ball' },
    { type: 'e' as const, label: 'Error' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card w-full max-w-xs shadow-2xl border border-navy-600">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Runner Event</div>
            <div className="text-base font-bold text-yellow-300">
              {runnerName ?? `Runner #${runnerId}`}
            </div>
            <div className="text-xs text-slate-500">on {baseName} base</div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-lg p-1">✕</button>
        </div>

        <div className="space-y-3">
          {/* Stolen Base */}
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Stolen Base</div>
            <div className="flex gap-2">
              {sbcsBases.map(({ base: toBase, label }) => (
                <button key={toBase} className="btn-result flex-1 text-sm font-bold"
                  onClick={() => onSubmit('sb', base, toBase, runnerId)}>
                  SB {label}
                </button>
              ))}
            </div>
          </div>

          {/* Caught Stealing */}
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Caught Stealing</div>
            <div className="flex gap-2">
              {sbcsBases.map(({ base: toBase, label }) => (
                <button key={toBase} className="btn-result-out flex-1 text-sm font-bold"
                  onClick={() => onSubmit('cs', base, toBase, runnerId)}>
                  CS {label}
                </button>
              ))}
            </div>
          </div>

          {/* Advance Runner (BK / WP / PB / Error) */}
          <div className="border-t border-navy-700 pt-3">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Advance Runner</div>
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {ADV_TYPES.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => setAdvType(advType === type ? null : type)}
                  className={`py-1.5 rounded text-xs font-bold border transition-colors ${
                    advType === type
                      ? 'bg-amber-500/25 border-amber-400 text-amber-300'
                      : 'bg-transparent border-navy-600 text-slate-500 hover:border-slate-400 hover:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {advType && (
              <div>
                <div className="text-xs text-slate-500 mb-2">Advance to:</div>
                <div className="flex gap-2">
                  {advBases.map(({ base: toBase, label }) => (
                    <button
                      key={toBase}
                      className="btn-result flex-1 text-sm font-bold"
                      onClick={() => onAdvance(advType, base, toBase, runnerId)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <button className="btn-secondary text-sm w-full mt-4" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ── Lineup Sidebar ────────────────────────────────────────────────────────────

const POS_ORDER: Record<string, number> = {
  P: 1, C: 2, '1B': 3, '2B': 4, '3B': 5, SS: 6, LF: 7, CF: 8, RF: 9, DH: 10,
};

function LineupSidebar({
  lineup, label, abbr, currentBatterId, currentPitcherId, isFielding = false, alignRight = false,
}: {
  lineup: LineupEntry[];
  label: string;
  abbr: string;
  currentBatterId: number | null;
  currentPitcherId: number | null;
  isFielding?: boolean;
  alignRight?: boolean;
}) {
  const [tab, setTab] = useState<'order' | 'field'>('order');

  const fieldView = [...lineup]
    .filter(e => POS_ORDER[e.position] !== undefined)
    .sort((a, b) => (POS_ORDER[a.position] ?? 99) - (POS_ORDER[b.position] ?? 99));

  return (
    <div className="card text-xs flex flex-col gap-0 self-start">
      {/* Header */}
      <div className={`flex items-center gap-2 mb-2 pb-2 border-b border-navy-600 ${alignRight ? 'flex-row-reverse' : ''}`}>
        <span className="font-black font-mono text-base text-white tracking-widest">{abbr}</span>
        <span className="text-slate-500 text-xs truncate flex-1">{label}</span>
        {isFielding && (
          <div className="flex gap-0.5 ml-auto">
            <button
              onClick={() => setTab('order')}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${tab === 'order' ? 'bg-navy-600 text-white' : 'text-slate-600 hover:text-slate-400'}`}
            >
              BAT
            </button>
            <button
              onClick={() => setTab('field')}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${tab === 'field' ? 'bg-navy-600 text-white' : 'text-slate-600 hover:text-slate-400'}`}
            >
              DEF
            </button>
          </div>
        )}
      </div>

      {/* Batting order view */}
      {tab === 'order' && lineup.map(entry => {
        const isBatter = entry.player_id === currentBatterId;
        const isPitcher = entry.player_id === currentPitcherId;
        return (
          <div
            key={entry.id ?? entry.player_id}
            className={`flex items-center gap-1.5 py-1 rounded px-1 transition-colors ${
              isBatter ? 'bg-yellow-400/10' : isPitcher ? 'bg-blue-400/10' : ''
            } ${alignRight ? 'flex-row-reverse' : ''}`}
          >
            <span className="text-slate-600 w-4 font-mono">{entry.batting_order}.</span>
            <span className={`flex-1 truncate ${isBatter ? 'text-yellow-300 font-bold' : isPitcher ? 'text-blue-300' : 'text-slate-400'}`}>
              {entry.player_name ?? `P${entry.player_id}`}
            </span>
            <span className={`font-mono font-bold text-[10px] w-6 ${alignRight ? 'text-left' : 'text-right'} ${
              entry.position === 'P' ? 'text-blue-400' : 'text-slate-600'
            }`}>
              {entry.position}
            </span>
            {isBatter && <span className="text-yellow-400 text-[10px]">●</span>}
          </div>
        );
      })}

      {/* Defense / field view */}
      {tab === 'field' && (
        <div className="space-y-0">
          {fieldView.length === 0 ? (
            <div className="text-slate-600 text-[10px] py-2">No positions set</div>
          ) : fieldView.map(entry => (
            <div
              key={entry.id ?? entry.player_id}
              className={`flex items-center gap-2 py-1 px-1 ${alignRight ? 'flex-row-reverse' : ''}`}
            >
              <span className={`font-mono font-bold text-[10px] w-6 ${alignRight ? 'text-left' : 'text-right'} ${
                entry.position === 'P' ? 'text-blue-400' : 'text-slate-500'
              }`}>
                {entry.position}
              </span>
              <span className={`flex-1 truncate text-slate-300 ${entry.position === 'P' ? 'text-blue-300 font-bold' : ''}`}>
                {entry.player_name ?? `P${entry.player_id}`}
              </span>
              {entry.defensive_rating && (
                <span className="font-mono font-bold text-[10px] text-emerald-400 shrink-0">
                  {entry.defensive_rating}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Game-end helpers ─────────────────────────────────────────────────────────

/** True if the game should end after an inning_end play. */
function shouldEndAfterInning(
  endedInning: number,
  endedHalf: 'top' | 'bottom',
  homeScore: number,
  awayScore: number,
  gameInnings: number,
): boolean {
  // Bottom of the last scheduled inning ends with a non-tied score
  if (endedInning === gameInnings && endedHalf === 'bottom' && homeScore !== awayScore) return true;
  // Top of the last scheduled inning ends with the home team already winning
  if (endedInning === gameInnings && endedHalf === 'top' && homeScore > awayScore) return true;
  // Extra inning bottom half ends with a non-tied score
  if (endedInning > gameInnings && endedHalf === 'bottom' && homeScore !== awayScore) return true;
  return false;
}

/** True if the home team just scored a walk-off run. */
function isWalkOff(
  half: 'top' | 'bottom',
  inning: number,
  homeScore: number,
  awayScore: number,
  gameInnings: number,
): boolean {
  return half === 'bottom' && inning >= gameInnings && homeScore > awayScore;
}

// ── Runner advancement computation (no-runners fast path) ────────────────────

function computeAtBatOutcome(
  resultCode: string,
  runnersBefore: Record<string, number | null>,
  batterId: number | null,
): { runners_after: Record<string, number | null>; runs_on_play: number; scored_runner_ids: number[] } {
  const r1 = runnersBefore['1'] ?? null;
  const r2 = runnersBefore['2'] ?? null;
  const r3 = runnersBefore['3'] ?? null;
  const ids = (...vs: (number | null)[]): number[] => vs.filter((v): v is number => v !== null);

  if (resultCode === 'HR') {
    const scored = ids(r1, r2, r3, batterId);
    return { runners_after: { '1': null, '2': null, '3': null }, runs_on_play: scored.length, scored_runner_ids: scored };
  }
  if (resultCode === '3B') {
    const scored = ids(r1, r2, r3);
    return { runners_after: { '1': null, '2': null, '3': batterId }, runs_on_play: scored.length, scored_runner_ids: scored };
  }
  if (resultCode === '2B') {
    const scored = ids(r2, r3);
    return { runners_after: { '1': null, '2': batterId, '3': r1 }, runs_on_play: scored.length, scored_runner_ids: scored };
  }
  if (resultCode === '1B' || resultCode.startsWith('E')) {
    const scored = ids(r3);
    return { runners_after: { '1': batterId, '2': r1, '3': r2 }, runs_on_play: scored.length, scored_runner_ids: scored };
  }
  if (['BB', 'IBB', 'HBP'].includes(resultCode)) {
    if (!r1) return { runners_after: { '1': batterId, '2': r2, '3': r3 }, runs_on_play: 0, scored_runner_ids: [] };
    if (!r2) return { runners_after: { '1': batterId, '2': r1, '3': r3 }, runs_on_play: 0, scored_runner_ids: [] };
    if (!r3) return { runners_after: { '1': batterId, '2': r1, '3': r2 }, runs_on_play: 0, scored_runner_ids: [] };
    const scored = ids(r3);
    return { runners_after: { '1': batterId, '2': r1, '3': r2 }, runs_on_play: scored.length, scored_runner_ids: scored };
  }
  if (resultCode.startsWith('SF') || resultCode === 'SF') {
    const scored = ids(r3);
    return { runners_after: { '1': r1, '2': r2, '3': null }, runs_on_play: scored.length, scored_runner_ids: scored };
  }
  if (resultCode === 'SAC') {
    const scored = ids(r3);
    return { runners_after: { '1': null, '2': r1, '3': r2 }, runs_on_play: scored.length, scored_runner_ids: scored };
  }
  if (resultCode.startsWith('FC:') || resultCode === 'FC') {
    const scored = ids(r3);
    return { runners_after: { '1': batterId, '2': null, '3': r2 }, runs_on_play: scored.length, scored_runner_ids: scored };
  }
  if (resultCode.startsWith('GDP:') || resultCode.startsWith('LDP:')) {
    return { runners_after: { '1': null, '2': r2, '3': r3 }, runs_on_play: 0, scored_runner_ids: [] };
  }
  return { runners_after: { ...runnersBefore }, runs_on_play: 0, scored_runner_ids: [] };
}
