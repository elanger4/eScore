import { useState } from 'react';
import { RunnerState, LineupEntry } from '../../types';

type SafeBase = '1' | '2' | '3' | 'H';
type Dest = SafeBase | 'out' | 'out:1' | 'out:2' | 'out:3' | 'out:H';

function isOutDest(d: Dest): boolean {
  return d === 'out' || d === 'out:1' || d === 'out:2' || d === 'out:3' || d === 'out:H';
}


interface RunnerRow {
  playerId: number;
  playerName: string;
  jerseyNumber: string;
  fromBase: '1' | '2' | '3';
  defaultDest: Dest;
}

interface Props {
  resultCode: string;
  dispText: string;
  batterId: number | null;
  batterName: string;
  runnersBefore: RunnerState;
  allPlayers: LineupEntry[];
  onConfirm: (runnersAfter: RunnerState, runsOnPlay: number, scoredRunnerIds: number[]) => void;
  onClose: () => void;
}

function getBatterDest(resultCode: string): Dest | null {
  if (resultCode === 'HR') return 'H';
  if (resultCode === '3B') return '3';
  if (resultCode === '2B') return '2';
  if (resultCode === '1B') return '1';
  if (['BB', 'IBB', 'HBP'].includes(resultCode)) return '1';
  if (resultCode.startsWith('E')) return '1';
  if (resultCode.startsWith('FC')) return '1';
  return null;
}

function getDefaultDest(
  resultCode: string,
  fromBase: '1' | '2' | '3',
  r1Present: boolean,
  r2Present: boolean,
): Dest {
  if (resultCode === 'HR' || resultCode === '3B') return 'H';
  if (resultCode === '2B') return fromBase === '1' ? '3' : 'H';
  if (resultCode === '1B' || resultCode.startsWith('E')) {
    if (fromBase === '3') return 'H';
    if (fromBase === '2') return '3';
    return '2';
  }
  if (['BB', 'IBB', 'HBP'].includes(resultCode)) {
    if (fromBase === '3') return (r1Present && r2Present) ? 'H' : '3';
    if (fromBase === '2') return r1Present ? '3' : '2';
    return '2'; // r1 always forced (batter coming to 1st)
  }
  if (resultCode.startsWith('SF') || resultCode === 'SF') return fromBase === '3' ? 'H' : fromBase;
  if (resultCode === 'SAC') {
    if (fromBase === '3') return 'H';
    if (fromBase === '2') return '3';
    return '2';
  }
  if (resultCode.startsWith('FC') || resultCode === 'FC') {
    if (fromBase === '1') return 'out';
    if (fromBase === '3') return 'H';
    return '3';
  }
  if (resultCode.startsWith('GDP:') || resultCode.startsWith('LDP:')) {
    return fromBase === '1' ? 'out' : fromBase;
  }
  return fromBase; // K, GO, FO, LO — stay
}

function resultTitle(resultCode: string, dispText: string): string {
  if (resultCode === 'HR') return 'Home Run';
  if (resultCode === '3B') return 'Triple';
  if (resultCode === '2B') return 'Double';
  if (resultCode === '1B') return 'Single';
  if (resultCode === 'BB') return 'Walk';
  if (resultCode === 'IBB') return 'Int. Walk';
  if (resultCode === 'HBP') return 'Hit by Pitch';
  if (resultCode === 'K' || resultCode === 'KL') return 'Strikeout';
  if (resultCode === 'SAC') return 'Sac Bunt';
  if (resultCode.startsWith('SF')) return 'Sac Fly';
  if (resultCode.startsWith('GDP')) return 'Double Play';
  if (resultCode.startsWith('LDP')) return 'Line DP';
  if (resultCode.startsWith('FC')) return "Fielder's Choice";
  return dispText;
}

function fromBaseLabel(b: '1' | '2' | '3'): string {
  return b === '1' ? 'first' : b === '2' ? 'second' : 'third';
}

function baseLabel(b: '1' | '2' | '3' | 'H'): string {
  return b === 'H' ? 'Scores' : b === '1' ? '1st' : b === '2' ? '2nd' : '3rd';
}

export default function RunnerAdvancementModal({
  resultCode, dispText, batterId, batterName, runnersBefore, allPlayers, onConfirm, onClose,
}: Props) {
  const r1 = runnersBefore['1'] ?? null;
  const r2 = runnersBefore['2'] ?? null;
  const r3 = runnersBefore['3'] ?? null;

  // Process 3rd → 2nd → 1st
  const runners: RunnerRow[] = (['3', '2', '1'] as const)
    .filter(base => (runnersBefore[base] ?? null) !== null)
    .map(base => {
      const playerId = runnersBefore[base] as number;
      const entry = allPlayers.find(e => e.player_id === playerId);
      return {
        playerId,
        playerName: entry?.player_name ?? `Player ${playerId}`,
        jerseyNumber: entry?.jersey_number ?? '',
        fromBase: base,
        defaultDest: getDefaultDest(resultCode, base, r1 !== null, r2 !== null),
      };
    });

  const [idx, setIdx] = useState(0);
  const [outcomes, setOutcomes] = useState<Map<number, Dest>>(
    new Map(runners.map(r => [r.playerId, r.defaultDest]))
  );

  const current = runners[idx];
  const dest = outcomes.get(current.playerId) ?? current.defaultDest;
  const isOut = isOutDest(dest);

  const setDest = (d: Dest) =>
    setOutcomes(prev => new Map(prev).set(current.playerId, d));

  const batterDest = getBatterDest(resultCode);
  const isLast = idx === runners.length - 1;

  const handleConfirm = () => {
    const runnersAfter: RunnerState = { '1': null, '2': null, '3': null };
    const scored: number[] = [];

    if (batterDest === 'H' && batterId !== null) {
      scored.push(batterId);
    } else if (batterDest && batterId !== null) {
      runnersAfter[batterDest] = batterId;
    }

    for (const runner of runners) {
      const d = outcomes.get(runner.playerId) ?? runner.defaultDest;
      if (d === 'H') scored.push(runner.playerId);
      else if (!isOutDest(d)) runnersAfter[d] = runner.playerId;
    }

    onConfirm(runnersAfter, scored.length, scored);
  };

  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card w-full max-w-sm shadow-2xl border border-navy-600">

        {/* Header — result + batter outcome */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              {resultTitle(resultCode, dispText)} · {dispText}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Batter</span>
              <span className="text-sm font-bold text-yellow-300">{batterName}</span>
              <span className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded ${
                batterDest === 'H' ? 'bg-green-500/20 text-green-300' :
                batterDest ? 'bg-blue-500/20 text-blue-300' :
                'bg-red-500/20 text-red-400'
              }`}>
                {!batterDest ? 'Out' : batterDest === 'H' ? 'Scores' : `${baseLabel(batterDest as '1' | '2' | '3')} base`}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none p-1">✕</button>
        </div>

        {/* Divider */}
        <div className="border-t border-navy-700 mb-4" />

        {/* Runner question */}
        <div className="mb-4">
          <p className="text-base font-bold text-white leading-snug">
            What happened to the runner on {fromBaseLabel(current.fromBase)},{' '}
            {current.jerseyNumber ? `#${current.jerseyNumber} ` : ''}
            {current.playerName}?
          </p>
        </div>

        {/* Out / Safe tabs */}
        <div className="flex gap-2 mb-4">
          <button
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold border transition-colors ${
              isOut
                ? 'bg-red-500/25 border-red-500 text-red-300'
                : 'bg-transparent border-navy-600 text-slate-500 hover:border-slate-400 hover:text-slate-300'
            }`}
            onClick={() => setDest('out')}
          >
            Out
          </button>
          <button
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold border transition-colors ${
              !isOut
                ? 'bg-blue-500/25 border-blue-500 text-blue-300'
                : 'bg-transparent border-navy-600 text-slate-500 hover:border-slate-400 hover:text-slate-300'
            }`}
            onClick={() => {
              if (isOut) setDest(current.defaultDest === 'out' ? current.fromBase : current.defaultDest as SafeBase);
            }}
          >
            Safe
          </button>
        </div>

        {/* Out: which base was the tag? */}
        {isOut && (
          <div className="mb-5">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Out at…</div>
            <div className="grid grid-cols-4 gap-2">
              {(['1', '2', '3', 'H'] as const).map(base => {
                const outDest: Dest = `out:${base}`;
                const selected = dest === outDest;
                return (
                  <button
                    key={base}
                    onClick={() => setDest(selected ? 'out' : outDest)}
                    className={`py-2.5 rounded-lg text-sm font-bold border transition-colors ${
                      selected
                        ? 'bg-red-500/30 border-red-400 text-red-300'
                        : 'bg-transparent border-navy-600 text-slate-500 hover:border-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {base === 'H' ? 'Home' : baseLabel(base)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Base buttons (only when Safe) */}
        {!isOut && (
          <div className="grid grid-cols-4 gap-2 mb-5">
            {(['1', '2', '3', 'H'] as const).map(base => (
              <button
                key={base}
                onClick={() => setDest(base)}
                className={`py-2.5 rounded-lg text-sm font-bold border transition-colors ${
                  dest === base
                    ? base === 'H'
                      ? 'bg-green-500/30 border-green-400 text-green-300'
                      : 'bg-blue-500/30 border-blue-400 text-blue-300'
                    : 'bg-transparent border-navy-600 text-slate-500 hover:border-slate-400 hover:text-slate-300'
                }`}
              >
                {baseLabel(base)}
              </button>
            ))}
          </div>
        )}

        {/* Progress + actions */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {runners.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === idx ? 'bg-blue-400' : i < idx ? 'bg-slate-500' : 'bg-navy-600'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-slate-600 font-mono ml-1">
            {idx + 1} / {runners.length}
          </span>
          <div className="flex-1" />
          <button className="btn-secondary text-sm px-4" onClick={onClose}>Cancel</button>
          {isLast ? (
            <button className="btn-primary text-sm px-6 font-bold" onClick={handleConfirm}>
              Confirm →
            </button>
          ) : (
            <button className="btn-primary text-sm px-6 font-bold" onClick={() => setIdx(i => i + 1)}>
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
