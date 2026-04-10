import { LineupEntry, RunnerState } from '../../types';

interface Props {
  runners: RunnerState;
  battingLineup: LineupEntry[];
  fieldingLineup: LineupEntry[];
  currentBatterId: number | null;
  onRunnerClick?: (base: string, runnerId: number) => void;
}

function lastName(name: string | undefined | null, max = 9): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  const n = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  return n.length > max ? n.slice(0, max - 1) + '…' : n;
}

export default function FieldView({
  runners, battingLineup, fieldingLineup, currentBatterId, onRunnerClick,
}: Props) {
  const fEntry = (pos: string) => fieldingLineup.find(e => e.position === pos);
  const isOn = (base: string) => !!runners[base];
  const rId = (base: string) => runners[base] as number | null;
  const rName = (base: string) => {
    const id = runners[base];
    return id ? battingLineup.find(e => e.player_id === id)?.player_name ?? null : null;
  };
  const batter = battingLineup.find(e => e.player_id === currentBatterId);

  // Field coordinates
  const HX = 170, HY = 262; // home plate
  const B1X = 253, B1Y = 178; // 1B bag
  const B2X = 170, B2Y = 90;  // 2B bag
  const B3X = 87,  B3Y = 178; // 3B bag

  const on1 = isOn('1'), on2 = isOn('2'), on3 = isOn('3');
  const anyRunner = on1 || on2 || on3;

  // Fielder marker: dot with position label inside + player name nearby
  function fielder(
    pos: string,
    cx: number, cy: number,
    nameX: number, nameY: number,
    nameAnchor: 'middle' | 'start' | 'end' = 'middle',
  ) {
    const entry = fEntry(pos);
    const name = lastName(entry?.player_name);
    const rating = entry?.defensive_rating;
    return (
      <g key={pos}>
        <circle cx={cx} cy={cy} r="5" fill="#0f1e35" stroke="#1e3a5f" strokeWidth="1.5" />
        <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize="5.5"
          fill="#4a6080" fontFamily="monospace" fontWeight="bold">{pos}</text>
        <text x={nameX} y={nameY} textAnchor={nameAnchor} fontSize="7.5"
          fill="#94a3b8" fontFamily="system-ui, sans-serif">{name}</text>
        {rating && (
          <text x={nameX} y={nameY + 9} textAnchor={nameAnchor} fontSize="6"
            fill="#475569" fontFamily="monospace">{rating}</text>
        )}
      </g>
    );
  }

  // Runner name badge near a base (clickable)
  function runnerLabel(base: string, tx: number, ty: number) {
    const id = rId(base);
    if (!id) return null;
    const name = lastName(rName(base));
    return (
      <g key={`runner-${base}`}
        onClick={onRunnerClick ? () => onRunnerClick(base, id) : undefined}
        style={onRunnerClick ? { cursor: 'pointer' } : undefined}>
        <rect x={tx - 19} y={ty - 9} width="38" height="13" rx="2"
          fill="#78350f" stroke="#fbbf24" strokeWidth="0.75" />
        <text x={tx} y={ty} textAnchor="middle" fontSize="7.5"
          fill="#fde68a" fontFamily="system-ui, sans-serif" fontWeight="bold">{name}</text>
      </g>
    );
  }

  return (
    <div className="select-none w-full">
      <svg viewBox="0 0 340 310" width="100%" preserveAspectRatio="xMidYMid meet">

        {/* ── BACKGROUND ── */}
        <rect width="340" height="310" fill="#0d1b30" />
        {/* Fair territory green tint */}
        <path d={`M ${HX} ${HY} L 337 94 Q 170 5 3 94 Z`} fill="rgba(20, 55, 20, 0.3)" />

        {/* ── FIELD LINES ── */}
        {/* Outfield fence */}
        <path d="M 3 94 Q 170 5 337 94" fill="none" stroke="#1e3a5f" strokeWidth="2" />
        {/* Foul lines */}
        <line x1={HX} y1={HY} x2="3" y2="94" stroke="#1e3a5f" strokeWidth="1" />
        <line x1={HX} y1={HY} x2="337" y2="94" stroke="#1e3a5f" strokeWidth="1" />

        {/* ── INFIELD DIRT ── */}
        <circle cx="170" cy="178" r="68" fill="rgba(55, 30, 8, 0.22)" />

        {/* ── BASE PATHS ── */}
        <line x1={HX} y1={HY} x2={B1X} y2={B1Y} stroke="#24446a" strokeWidth="1.5" />
        <line x1={B1X} y1={B1Y} x2={B2X} y2={B2Y} stroke="#24446a" strokeWidth="1.5" />
        <line x1={B2X} y1={B2Y} x2={B3X} y2={B3Y} stroke="#24446a" strokeWidth="1.5" />
        <line x1={B3X} y1={B3Y} x2={HX} y2={HY} stroke="#24446a" strokeWidth="1.5" />

        {/* ── FIELDERS (drawn before bases so bases appear on top) ── */}
        {fielder('CF', 170, 42,  170,  57)}
        {fielder('LF',  68, 73,   68,  88)}
        {fielder('RF', 272, 73,  272,  88)}
        {fielder('SS', 118, 140, 107, 133, 'end')}
        {fielder('2B', 222, 140, 233, 133, 'start')}
        {fielder('3B',  76, 175,  63, 170, 'end')}
        {fielder('1B', 264, 175, 277, 170, 'start')}
        {fielder('P',  170, 178, 170, 197)}
        {fielder('C',  170, 244, 170, 236)}

        {/* ── BASES ── */}
        {/* 2B */}
        <rect x={B2X - 7} y={B2Y - 7} width="14" height="14"
          transform={`rotate(45 ${B2X} ${B2Y})`}
          fill={on2 ? '#facc15' : '#1e3a5f'} stroke={on2 ? '#fbbf24' : '#2d4f70'} strokeWidth="1.5" />
        {/* 3B */}
        <rect x={B3X - 7} y={B3Y - 7} width="14" height="14"
          transform={`rotate(45 ${B3X} ${B3Y})`}
          fill={on3 ? '#facc15' : '#1e3a5f'} stroke={on3 ? '#fbbf24' : '#2d4f70'} strokeWidth="1.5" />
        {/* 1B */}
        <rect x={B1X - 7} y={B1Y - 7} width="14" height="14"
          transform={`rotate(45 ${B1X} ${B1Y})`}
          fill={on1 ? '#facc15' : '#1e3a5f'} stroke={on1 ? '#fbbf24' : '#2d4f70'} strokeWidth="1.5" />

        {/* Home plate */}
        <polygon
          points={`${HX},${HY} ${HX-8},${HY+8} ${HX-8},${HY+16} ${HX+8},${HY+16} ${HX+8},${HY+8}`}
          fill="#162840" stroke="#2d4f70" strokeWidth="1" />

        {/* ── RUNNER NAME BADGES (on top of bases) ── */}
        {runnerLabel('1', B1X + 19, B1Y - 18)}
        {runnerLabel('2', B2X,      B2Y - 17)}
        {runnerLabel('3', B3X - 19, B3Y - 18)}

        {/* ── BATTER ── */}
        {batter && (
          <g>
            {/* Batter circle in the batter's box (left side) */}
            <circle cx={HX - 14} cy={HY + 7} r="4.5"
              fill="#2563eb" stroke="#60a5fa" strokeWidth="1" />
            {/* Batter name badge below home plate */}
            <rect x={HX - 34} y={HY + 19} width="68" height="13" rx="2"
              fill="#1e3a8a" stroke="#3b82f6" strokeWidth="0.75" />
            <text x={HX} y={HY + 29} textAnchor="middle" fontSize="8"
              fill="#93c5fd" fontFamily="system-ui, sans-serif" fontWeight="bold">
              {lastName(batter.player_name)}
            </text>
          </g>
        )}

        {/* Hint for clickable runners */}
        {onRunnerClick && anyRunner && (
          <text x="170" y="307" textAnchor="middle" fontSize="6"
            fill="#334155" fontFamily="system-ui, sans-serif">
            tap runner • SB / CS
          </text>
        )}

      </svg>
    </div>
  );
}
