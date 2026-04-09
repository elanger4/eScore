import { GameState, Game } from '../../types';

interface Props {
  state: GameState;
  gameInfo: Game | undefined;
}

function OutDots({ outs }: { outs: number }) {
  return (
    <div className="flex gap-2 items-center">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
            i < outs
              ? 'bg-yellow-400 border-yellow-400 shadow-glow-gold'
              : 'border-slate-600 bg-transparent'
          }`}
        />
      ))}
    </div>
  );
}

function InningArrow({ half }: { half: 'top' | 'bottom' }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={`w-0 h-0 border-l-[5px] border-r-[5px] border-b-[7px] border-l-transparent border-r-transparent transition-colors ${
        half === 'top' ? 'border-b-yellow-400' : 'border-b-slate-600'
      }`} />
      <div className={`w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent transition-colors ${
        half === 'bottom' ? 'border-t-yellow-400' : 'border-t-slate-600'
      }`} />
    </div>
  );
}

export default function Scoreboard({ state, gameInfo }: Props) {
  return (
    <div
      className="border-b border-navy-700"
      style={{ background: 'linear-gradient(180deg, #0a1628 0%, #06101f 100%)' }}
    >
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-8">

          {/* Away team */}
          <div className="flex items-center gap-4 flex-1">
            <div className="text-right">
              <div className="font-black font-mono text-2xl tracking-widest text-slate-300">
                {gameInfo?.away_abbr ?? 'AWY'}
              </div>
              <div className="text-xs text-slate-500 truncate max-w-[120px]">
                {gameInfo?.away_team_name ?? 'Away'}
              </div>
            </div>
            <div
              className="text-6xl font-black font-mono tabular-nums leading-none"
              style={{ textShadow: '0 0 20px rgba(255,255,255,0.15)', color: '#f1f5f9' }}
            >
              {state.away_score}
            </div>
          </div>

          {/* Center: inning + outs */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <InningArrow half={state.half} />
              <span className="text-3xl font-black text-yellow-400 font-mono tabular-nums leading-none">
                {state.inning}
              </span>
            </div>
            <OutDots outs={state.outs} />
            <div className="text-xs text-slate-500 font-mono">
              {state.outs} {state.outs === 1 ? 'out' : 'outs'}
            </div>
          </div>

          {/* Home team */}
          <div className="flex items-center gap-4 flex-1 justify-end">
            <div
              className="text-6xl font-black font-mono tabular-nums leading-none"
              style={{ textShadow: '0 0 20px rgba(255,255,255,0.15)', color: '#f1f5f9' }}
            >
              {state.home_score}
            </div>
            <div className="text-left">
              <div className="font-black font-mono text-2xl tracking-widest text-slate-300">
                {gameInfo?.home_abbr ?? 'HME'}
              </div>
              <div className="text-xs text-slate-500 truncate max-w-[120px]">
                {gameInfo?.home_team_name ?? 'Home'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
