import { useState } from 'react';
import { LineupEntry } from '../../types';

type FieldedPlayType = 'GO' | 'FO' | 'LO' | 'GDP' | 'LDP' | 'FC' | 'SF' | 'E';

interface Props {
  playType: FieldedPlayType;
  fieldingLineup: LineupEntry[];
  onSelect: (code: string, text: string) => void;
  onClose: () => void;
}

// How many fielder selections allowed
const MAX_FIELDERS: Record<FieldedPlayType, number> = {
  FO: 1, LO: 1, SF: 1, E: 1,
  GO: 2, FC: 2,
  GDP: 3, LDP: 3,
};

const AUTO_CONFIRM: Record<FieldedPlayType, boolean> = {
  FO: true, LO: true, SF: true, E: true,
  GO: false, FC: false, GDP: false, LDP: false,
};

const TYPE_LABELS: Record<FieldedPlayType, string> = {
  GO: 'Groundout', FO: 'Flyout', LO: 'Lineout',
  GDP: 'Ground Double Play', LDP: 'Line Double Play',
  FC: "Fielder's Choice", SF: 'Sacrifice Fly', E: 'Error',
};

// Position number → abbreviation + field coordinates (in a 300×270 SVG)
// Field oriented with home plate at bottom center
const FIELD_POSITIONS = [
  { num: 8, abbr: 'CF', x: 150, y:  34 },
  { num: 7, abbr: 'LF', x:  50, y:  72 },
  { num: 9, abbr: 'RF', x: 250, y:  72 },
  { num: 6, abbr: 'SS', x: 106, y: 122 },
  { num: 4, abbr: '2B', x: 194, y: 122 },
  { num: 5, abbr: '3B', x:  68, y: 166 },
  { num: 3, abbr: '1B', x: 232, y: 166 },
  { num: 1, abbr: 'P',  x: 150, y: 174 },
  { num: 2, abbr: 'C',  x: 150, y: 232 },
] as const;

const POS_ABBR_TO_NUM: Record<string, number> = {
  P: 1, C: 2, '1B': 3, '2B': 4, '3B': 5, SS: 6, LF: 7, CF: 8, RF: 9,
};

function buildCode(playType: FieldedPlayType, nums: number[]): string {
  if (playType === 'E') return `E${nums[0]}`;
  return `${playType}:${nums.join('-')}`;
}

function buildDisplay(playType: FieldedPlayType, nums: number[]): string {
  const seq = nums.join('-');
  if (playType === 'FO') return `F${seq}`;
  if (playType === 'LO') return `L${seq}`;
  if (playType === 'GDP') return `${seq} DP`;
  if (playType === 'LDP') return `${seq} LDP`;
  if (playType === 'FC') return `FC (${seq})`;
  if (playType === 'SF') return `SF (${seq})`;
  if (playType === 'E') return `E${seq}`;
  return seq;
}

export default function FielderPickerModal({ playType, fieldingLineup, onSelect, onClose }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const maxFielders = MAX_FIELDERS[playType];
  const autoConfirm = AUTO_CONFIRM[playType];

  const playerAtNum = (num: number): string => {
    const entry = fieldingLineup.find(e => POS_ABBR_TO_NUM[e.position] === num);
    if (!entry?.player_name) return '';
    // Show last name only for space
    const parts = entry.player_name.trim().split(' ');
    return parts[parts.length - 1];
  };

  const handleFielderClick = (num: number) => {
    if (selected.length >= maxFielders) return;
    const next = [...selected, num];
    setSelected(next);
    if (autoConfirm || next.length === maxFielders) {
      onSelect(buildCode(playType, next), buildDisplay(playType, next));
    }
  };

  const seqDisplay = selected.length > 0
    ? selected.join('-')
    : null;

  // Hint text under the sequence
  const hint = (() => {
    const left = maxFielders - selected.length;
    if (left === 0) return null;
    if (autoConfirm) return 'Tap a fielder';
    if (selected.length === 0) return `Tap ${maxFielders === 2 ? 'up to 2 fielders' : 'up to 3 fielders'} in order`;
    return `${left} more — or Record`;
  })();

  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card w-full max-w-sm shadow-2xl border border-navy-600 p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Fielded Play</div>
            <div className="text-xl font-black text-white">{TYPE_LABELS[playType]}</div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-lg p-1 leading-none">✕</button>
        </div>

        {/* Sequence + hint */}
        <div className="flex items-baseline gap-3 mb-2 min-h-[1.75rem]">
          {seqDisplay ? (
            <>
              <span className="text-3xl font-black font-mono text-white tracking-widest">{seqDisplay}</span>
              <button
                className="text-xs text-slate-500 hover:text-red-400"
                onClick={() => setSelected(prev => prev.slice(0, -1))}
              >
                ← undo
              </button>
            </>
          ) : (
            <span className="text-sm text-slate-600 italic">{hint}</span>
          )}
        </div>

        {/* Baseball field SVG */}
        <div className="rounded-lg overflow-hidden border border-navy-700 mb-3">
          <svg
            viewBox="0 0 300 270"
            width="100%"
            style={{ display: 'block', backgroundColor: '#1a3d1a' }}
          >
            {/* Outfield grass */}
            <rect width="300" height="270" fill="#1a3d1a" />

            {/* Foul lines from home to corners */}
            <line x1="150" y1="252" x2="-10" y2="55"  stroke="#2d5e2d" strokeWidth="1.5" />
            <line x1="150" y1="252" x2="310" y2="55"  stroke="#2d5e2d" strokeWidth="1.5" />

            {/* Warning track arc */}
            <path d="M 22 105 Q 150 8 278 105" stroke="#6b5533" strokeWidth="11" fill="none" />

            {/* Infield dirt (circle around the mound/diamond area) */}
            <circle cx="150" cy="183" r="80" fill="#8c6840" />

            {/* Infield grass (smaller inner circle — the actual "grass" inside the dirt) */}
            {/* Actually standard fields have dirt all around the diamond. Let's keep it simple. */}

            {/* Base paths */}
            <line x1="150" y1="102" x2="228" y2="177" stroke="#5a3e22" strokeWidth="2" />
            <line x1="228" y1="177" x2="150" y2="252" stroke="#5a3e22" strokeWidth="2" />
            <line x1="150" y1="252" x2="72"  y2="177" stroke="#5a3e22" strokeWidth="2" />
            <line x1="72"  y1="177" x2="150" y2="102" stroke="#5a3e22" strokeWidth="2" />

            {/* Pitcher's mound */}
            <circle cx="150" cy="181" r="9" fill="#9e7348" stroke="#7a5530" strokeWidth="1" />

            {/* Bases (small rotated squares) */}
            {/* 2nd */}
            <rect x="144" y="96" width="12" height="12" fill="white" transform="rotate(45 150 102)" />
            {/* 1st */}
            <rect x="222" y="171" width="12" height="12" fill="white" transform="rotate(45 228 177)" />
            {/* 3rd */}
            <rect x="66"  y="171" width="12" height="12" fill="white" transform="rotate(45 72 177)" />
            {/* Home plate */}
            <polygon points="150,252 143,245 143,237 157,237 157,245" fill="white" />

            {/* ── Fielder buttons ── */}
            {FIELD_POSITIONS.map(({ num, abbr, x, y }) => {
              const selIdx = selected.indexOf(num);
              const isSelected = selIdx !== -1;
              const isDisabled = selected.length >= maxFielders && !isSelected;
              const name = playerAtNum(num);

              return (
                <g
                  key={num}
                  onClick={() => !isDisabled && handleFielderClick(num)}
                  style={{ cursor: isDisabled ? 'default' : 'pointer' }}
                >
                  {/* Outer ring (selection indicator) */}
                  <circle
                    cx={x} cy={y} r="21"
                    fill={isSelected ? '#1d4ed8' : 'rgba(0,0,0,0.55)'}
                    stroke={isSelected ? '#60a5fa' : isDisabled ? '#2a3a4a' : '#4a7a9b'}
                    strokeWidth={isSelected ? 2 : 1.5}
                    opacity={isDisabled ? 0.35 : 1}
                  />

                  {/* Fielder number */}
                  <text
                    x={x} y={y - (name ? 3 : 1)}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize="13" fontWeight="900" fontFamily="monospace"
                    fill={isSelected ? 'white' : isDisabled ? '#3a5a6a' : '#e2e8f0'}
                  >
                    {num}
                    {isSelected && selIdx >= 0 && (
                      <tspan fontSize="7" baselineShift="super" fill="#93c5fd">
                        {selIdx + 1}
                      </tspan>
                    )}
                  </text>

                  {/* Position abbreviation */}
                  <text
                    x={x} y={y + 8}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize="7" fontWeight="700" fontFamily="sans-serif"
                    fill={isSelected ? '#93c5fd' : isDisabled ? '#2a4a5a' : '#64748b'}
                    letterSpacing="0.5"
                  >
                    {abbr}
                  </text>

                  {/* Player last name */}
                  {name && (
                    <text
                      x={x} y={y + 17}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize="6.5" fontFamily="sans-serif"
                      fill={isSelected ? '#bfdbfe' : isDisabled ? '#1e3a4a' : '#475569'}
                    >
                      {name}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Footer */}
        {!autoConfirm && (
          <div className="flex gap-2">
            <button className="btn-secondary text-sm flex-1" onClick={onClose}>Cancel</button>
            <button
              className="btn-primary text-sm flex-1 font-bold"
              disabled={selected.length === 0}
              onClick={() => onSelect(buildCode(playType, selected), buildDisplay(playType, selected))}
            >
              Record →
            </button>
          </div>
        )}
        {autoConfirm && (
          <button className="btn-secondary text-sm w-full" onClick={onClose}>Cancel</button>
        )}
      </div>
    </div>
  );
}
