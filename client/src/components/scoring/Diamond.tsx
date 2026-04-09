import { RunnerState } from '../../types';

interface Props {
  runners: RunnerState;
  outs: number;
  onRunnerClick?: (base: string, runnerId: number) => void;
}

export default function Diamond({ runners, outs: _, onRunnerClick }: Props) {
  const on1 = !!runners['1'];
  const on2 = !!runners['2'];
  const on3 = !!runners['3'];

  const baseClass = (occupied: boolean) =>
    `transition-all duration-200 ${
      occupied
        ? 'fill-yellow-400 stroke-yellow-300'
        : 'fill-navy-700 stroke-navy-500'
    }`;

  const runnerCircle = (base: string, cx: number, cy: number, occupied: boolean) => {
    if (!occupied) return null;
    const runnerId = runners[base] as number;
    const clickable = !!onRunnerClick;
    return (
      <g
        onClick={clickable ? () => onRunnerClick!(base, runnerId) : undefined}
        style={clickable ? { cursor: 'pointer' } : undefined}
      >
        {/* Larger invisible hit area */}
        {clickable && <circle cx={cx} cy={cy} r="10" fill="transparent" />}
        <circle
          cx={cx} cy={cy} r="5.5"
          className={`fill-yellow-400 ${clickable ? 'opacity-80 hover:opacity-100' : 'opacity-60'}`}
          style={clickable ? { filter: 'drop-shadow(0 0 4px #facc15)' } : undefined}
        />
        {clickable && (
          <circle cx={cx} cy={cy} r="5.5"
            fill="none" stroke="#facc15" strokeWidth="1"
            className="opacity-60"
          />
        )}
      </g>
    );
  };

  return (
    <div className="flex flex-col items-center select-none">
      <svg viewBox="0 0 100 100" width="110" height="110">
        {/* Base paths (faint lines) */}
        <line x1="50" y1="14" x2="82" y2="50" stroke="#1e3a5f" strokeWidth="1" />
        <line x1="82" y1="50" x2="50" y2="86" stroke="#1e3a5f" strokeWidth="1" />
        <line x1="50" y1="86" x2="18" y2="50" stroke="#1e3a5f" strokeWidth="1" />
        <line x1="18" y1="50" x2="50" y2="14" stroke="#1e3a5f" strokeWidth="1" />

        {/* 2nd base */}
        <rect
          x="41" y="5" width="18" height="18" rx="2"
          transform="rotate(45 50 14)"
          className={baseClass(on2)}
          strokeWidth="1.5"
        />
        {/* 3rd base */}
        <rect
          x="9" y="41" width="18" height="18" rx="2"
          transform="rotate(45 18 50)"
          className={baseClass(on3)}
          strokeWidth="1.5"
        />
        {/* 1st base */}
        <rect
          x="73" y="41" width="18" height="18" rx="2"
          transform="rotate(45 82 50)"
          className={baseClass(on1)}
          strokeWidth="1.5"
        />

        {/* Home plate */}
        <polygon
          points="50,82 43,89 43,96 57,96 57,89"
          className="fill-slate-300 stroke-slate-400"
          strokeWidth="1"
        />

        {/* Pitcher's mound dot */}
        <circle cx="50" cy="50" r="3" className="fill-navy-600 stroke-navy-400" strokeWidth="1" />

        {/* Runner indicators (clickable when onRunnerClick provided) */}
        {runnerCircle('2', 50, 14, on2)}
        {runnerCircle('3', 18, 50, on3)}
        {runnerCircle('1', 82, 50, on1)}
      </svg>

      {/* Base labels */}
      <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono mt-1 w-24">
        <span className={on3 ? 'text-yellow-400 font-bold' : 'text-slate-600'}>3rd</span>
        <span className={on2 ? 'text-yellow-400 font-bold' : 'text-slate-600'}>2nd</span>
        <span className={on1 ? 'text-yellow-400 font-bold' : 'text-slate-600'}>1st</span>
      </div>

      {/* Hint when clickable and runners on base */}
      {onRunnerClick && (on1 || on2 || on3) && (
        <div className="text-[9px] text-slate-600 mt-1">tap runner for SB/CS</div>
      )}
    </div>
  );
}
