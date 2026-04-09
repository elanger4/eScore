import { useState } from 'react';
import { RunnerState, LineupEntry } from '../../types';

interface Props {
  runners: RunnerState;
  lineup: LineupEntry[];
  onSubmit: (playType: string, resultCode: string, displayText: string, extra?: Record<string, unknown>) => void;
}

const BASE_OPTIONS = ['1', '2', '3', 'H'];

function RunnerSelect({ runners, lineup, value, onChange }: {
  runners: RunnerState;
  lineup: LineupEntry[];
  value: string;
  onChange: (v: string) => void;
}) {
  const runnerEntries = Object.entries(runners).filter(([, pid]) => pid !== null);
  return (
    <select className="select text-sm w-40" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">— runner —</option>
      {runnerEntries.map(([base, pid]) => {
        const name = lineup.find(e => e.player_id === pid)?.player_name ?? `P${pid}`;
        return <option key={base} value={`${base}:${pid}`}>{base}B — {name}</option>;
      })}
    </select>
  );
}

export default function MidPAPanel({ runners, lineup, onSubmit }: Props) {
  const [sbRunner, setSbRunner] = useState('');
  const [sbBase, setSbBase] = useState('2');
  const [csRunner, setCsRunner] = useState('');
  const [csBase, setCsBase] = useState('2');
  const [csFielders, setCsFielders] = useState('2-6');
  const [poRunner, setPoRunner] = useState('');
  const [poBase, setPoBase] = useState('1');
  const [wpRunner, setWpRunner] = useState('');
  const [wpFrom, setWpFrom] = useState('');
  const [wpTo, setWpTo] = useState('');

  const hasRunners = Object.values(runners).some(v => v !== null);

  const submitSB = () => {
    if (!sbRunner) return;
    const [, pid] = sbRunner.split(':');
    const code = `SB:${sbBase}:${pid}`;
    onSubmit('mid_pa_sb', code, `SB (${sbBase}nd)`, {
      scored_runner_ids: sbBase === 'H' ? [parseInt(pid)] : [],
      runs_on_play: sbBase === 'H' ? 1 : 0,
      runners_after: advanceRunner(runners, sbRunner.split(':')[0], sbBase, parseInt(pid)),
    });
  };

  const submitCS = () => {
    if (!csRunner) return;
    const [, pid] = csRunner.split(':');
    const code = `CS:${csBase}:${pid}:${csFielders}`;
    onSubmit('mid_pa_cs', code, `CS (${csBase}B) ${csFielders}`, {
      outs_on_play: 1,
      runners_after: removeRunner(runners, csRunner.split(':')[0]),
    });
  };

  const submitPO = () => {
    if (!poRunner) return;
    const [base, pid] = poRunner.split(':');
    const code = `PO:${base}:${pid}`;
    onSubmit('mid_pa_po', code, `PO (${base}B)`, {
      outs_on_play: 1,
      runners_after: removeRunner(runners, base),
    });
  };

  const submitWP = (type: 'mid_pa_wp' | 'mid_pa_pb', label: string) => {
    if (!wpRunner) return;
    const [, pid] = wpRunner.split(':');
    const code = `${type === 'mid_pa_wp' ? 'WP' : 'PB'}:${pid}:${wpFrom}:${wpTo}`;
    onSubmit(type, code, `${label} (runner ${wpFrom}→${wpTo})`, {
      runs_on_play: wpTo === 'H' ? 1 : 0,
      scored_runner_ids: wpTo === 'H' ? [parseInt(pid)] : [],
      runners_after: advanceRunner(runners, wpFrom, wpTo, parseInt(pid)),
    });
  };

  const submitBalk = () => {
    // Balk: all runners advance one base
    const newRunners: RunnerState = { '1': null, '2': null, '3': null };
    const scored: number[] = [];
    if (runners['3']) { scored.push(runners['3']!); }
    if (runners['2']) { newRunners['3'] = runners['2']; }
    if (runners['1']) { newRunners['2'] = runners['1']; }
    onSubmit('mid_pa_bk', 'BK', 'Balk', {
      runs_on_play: scored.length,
      scored_runner_ids: scored,
      runners_after: newRunners,
    });
  };

  return (
    <div className="mt-3 card bg-gray-800">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">Mid-PA Events</h3>
      {!hasRunners && <p className="text-xs text-gray-500">No runners on base.</p>}

      {hasRunners && (
        <div className="space-y-4">
          {/* Stolen base */}
          <div>
            <div className="text-xs text-gray-400 font-medium mb-1">Stolen Base</div>
            <div className="flex gap-2 items-center flex-wrap">
              <RunnerSelect runners={runners} lineup={lineup} value={sbRunner} onChange={setSbRunner} />
              <span className="text-xs text-gray-400">→</span>
              <select className="select text-sm w-20" value={sbBase} onChange={e => setSbBase(e.target.value)}>
                {BASE_OPTIONS.filter(b => b !== '1').map(b => <option key={b} value={b}>{b === 'H' ? 'Home' : `${b}B`}</option>)}
              </select>
              <button className="btn-success text-xs" onClick={submitSB} disabled={!sbRunner}>SB</button>
            </div>
          </div>

          {/* Caught stealing */}
          <div>
            <div className="text-xs text-gray-400 font-medium mb-1">Caught Stealing</div>
            <div className="flex gap-2 items-center flex-wrap">
              <RunnerSelect runners={runners} lineup={lineup} value={csRunner} onChange={setCsRunner} />
              <span className="text-xs text-gray-400">→</span>
              <select className="select text-sm w-20" value={csBase} onChange={e => setCsBase(e.target.value)}>
                {BASE_OPTIONS.filter(b => b !== '1').map(b => <option key={b} value={b}>{b === 'H' ? 'Home' : `${b}B`}</option>)}
              </select>
              <input className="input w-20 font-mono text-sm" placeholder="2-6" value={csFielders} onChange={e => setCsFielders(e.target.value)} />
              <button className="btn-danger text-xs" onClick={submitCS} disabled={!csRunner}>CS</button>
            </div>
          </div>

          {/* Pickoff */}
          <div>
            <div className="text-xs text-gray-400 font-medium mb-1">Pickoff</div>
            <div className="flex gap-2 items-center flex-wrap">
              <RunnerSelect runners={runners} lineup={lineup} value={poRunner} onChange={setPoRunner} />
              <button className="btn-danger text-xs" onClick={submitPO} disabled={!poRunner}>PO (out)</button>
            </div>
          </div>

          {/* Wild pitch / Passed ball */}
          <div>
            <div className="text-xs text-gray-400 font-medium mb-1">Wild Pitch / Passed Ball — Runner Advances</div>
            <div className="flex gap-2 items-center flex-wrap">
              <RunnerSelect runners={runners} lineup={lineup} value={wpRunner} onChange={setWpRunner} />
              <span className="text-xs text-gray-400">from</span>
              <select className="select text-sm w-16" value={wpFrom} onChange={e => setWpFrom(e.target.value)}>
                <option value="">Base</option>
                {BASE_OPTIONS.filter(b => b !== 'H').map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <span className="text-xs text-gray-400">to</span>
              <select className="select text-sm w-16" value={wpTo} onChange={e => setWpTo(e.target.value)}>
                <option value="">Base</option>
                {BASE_OPTIONS.filter(b => b !== '1').map(b => <option key={b} value={b}>{b === 'H' ? 'H' : b}</option>)}
              </select>
              <button className="btn-secondary text-xs" onClick={() => submitWP('mid_pa_wp', 'WP')} disabled={!wpRunner}>WP</button>
              <button className="btn-secondary text-xs" onClick={() => submitWP('mid_pa_pb', 'PB')} disabled={!wpRunner}>PB</button>
            </div>
          </div>

          {/* Balk */}
          <div>
            <button className="btn-secondary text-xs" onClick={submitBalk}>Balk (all runners +1)</button>
          </div>
        </div>
      )}
    </div>
  );
}

function advanceRunner(runners: RunnerState, fromBase: string, toBase: string, playerId: number): RunnerState {
  const after = { ...runners };
  after[fromBase] = null;
  if (toBase !== 'H') after[toBase] = playerId;
  return after;
}

function removeRunner(runners: RunnerState, base: string): RunnerState {
  const after = { ...runners };
  after[base] = null;
  return after;
}
