interface Props {
  onSelect: (resultCode: string, displayText: string) => void;
  onFielderPlay: (playType: string) => void;
  disabled?: boolean;
}

const BTN_GROUPS = [
  {
    label: 'Hits',
    buttons: [
      { code: 'HR',  label: 'HR',  cls: 'btn-result-hit text-base' },
      { code: '3B',  label: '3B',  cls: 'btn-result-hit' },
      { code: '2B',  label: '2B',  cls: 'btn-result-hit' },
      { code: '1B',  label: '1B',  cls: 'btn-result-hit' },
    ],
  },
  {
    label: 'Plate Result',
    buttons: [
      { code: 'K',   label: 'K',   cls: 'btn-result-out' },
      { code: 'KL',  label: 'K⊙',  cls: 'btn-result-out' },
      { code: 'BB',  label: 'BB',  cls: 'btn-result' },
      { code: 'HBP', label: 'HBP', cls: 'btn-result' },
      { code: 'IBB', label: 'IBB', cls: 'btn-result' },
      { code: 'SAC', label: 'SAC', cls: 'btn-result' },
    ],
  },
];

const FIELDED_PLAYS = [
  { type: 'GO',  label: 'GO',    cls: 'btn-result-out' },
  { type: 'FO',  label: 'FO',    cls: 'btn-result-out' },
  { type: 'LO',  label: 'LO',    cls: 'btn-result-out' },
  { type: 'GDP', label: 'GDP',   cls: 'btn-result-out' },
  { type: 'LDP', label: 'LDP',   cls: 'btn-result-out' },
  { type: 'FC',  label: 'FC',    cls: 'btn-result' },
  { type: 'SF',  label: 'SF',    cls: 'btn-result' },
  { type: 'E',   label: 'Error', cls: 'btn-result' },
];

export default function ResultPicker({ onSelect, onFielderPlay, disabled }: Props) {
  return (
    <div className="space-y-3">
      {BTN_GROUPS.map(group => (
        <div key={group.label}>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
            {group.label}
          </div>
          <div className="flex gap-2 flex-wrap">
            {group.buttons.map(btn => (
              <button
                key={btn.code}
                className={`${btn.cls} ${disabled ? 'opacity-40' : ''}`}
                disabled={disabled}
                onClick={() => onSelect(btn.code, btn.label)}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div>
        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
          Fielded Plays
        </div>
        <div className="flex gap-2 flex-wrap">
          {FIELDED_PLAYS.map(({ type, label, cls }) => (
            <button
              key={type}
              className={`${cls} ${disabled ? 'opacity-40' : ''}`}
              disabled={disabled}
              onClick={() => onFielderPlay(type)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-slate-600 font-mono pt-1 border-t border-navy-700">
        shortcuts: k=K · K=K⊙ · w=BB · h=HR · 1=1B · 2=2B · 3=3B · b=HBP
      </div>
    </div>
  );
}
