import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { teamsApi } from '../api/teams';
import { gamesApi } from '../api/games';
import { Team, Player } from '../types';

const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

interface LineupSlot {
  player_id: number;
  player_name: string;
  position: string;
  batting_order: number;
}

function SortableRow({
  slot, onRemove, onPositionChange,
}: {
  slot: LineupSlot;
  onRemove: () => void;
  onPositionChange: (pos: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot.player_id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`flex items-center gap-2 py-1.5 border-b border-navy-700/60 group ${isDragging ? 'bg-navy-700 rounded' : ''}`}
    >
      <button {...attributes} {...listeners} className="text-slate-600 hover:text-slate-300 cursor-grab px-1 touch-none text-lg leading-none">⠿</button>
      <span className="text-slate-600 w-5 text-xs font-mono">{slot.batting_order}.</span>
      <span className="flex-1 text-sm text-slate-200">{slot.player_name}</span>
      <select
        className="select w-20 text-xs py-1"
        value={slot.position}
        onChange={e => onPositionChange(e.target.value)}
      >
        <option value="">Pos</option>
        {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <button className="text-slate-600 hover:text-red-400 text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={onRemove}>✕</button>
    </div>
  );
}

function LineupBuilder({
  team, lineup, onChange, pitcherId, onPitcherChange,
}: {
  team: Team;
  lineup: LineupSlot[];
  onChange: (lineup: LineupSlot[]) => void;
  pitcherId: number | null;
  onPitcherChange: (id: number | null) => void;
}) {
  const { data: players = [] } = useQuery({
    queryKey: ['team', team.id],
    queryFn: () => teamsApi.get(team.id),
    select: d => d.players,
  });

  // Auto-populate when team changes or players first load for this team
  const lastAutoTeamId = useRef<number | null>(null);
  useEffect(() => {
    const typed = players as Player[];
    if (typed.length === 0 || lastAutoTeamId.current === team.id) return;
    lastAutoTeamId.current = team.id;

    // Players with a saved order come first; fill remainder with non-pitchers alphabetically
    const ordered = typed
      .filter(p => p.default_batting_order > 0)
      .sort((a, b) => a.default_batting_order - b.default_batting_order);
    const unordered = typed
      .filter(p => !p.default_batting_order && !p.positions.includes('P'))
      .sort((a, b) => a.name.localeCompare(b.name));

    const all = [...ordered, ...unordered].slice(0, 9);
    onChange(all.map((p, i) => ({
      player_id: p.id,
      player_name: p.name,
      position: p.default_position || p.positions.find(pos => pos !== 'P') || p.positions[0] || '',
      batting_order: i + 1,
    })));
  }, [players, team.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const availablePlayers = (players as Player[]).filter(p => !lineup.some(s => s.player_id === p.id));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = lineup.findIndex(s => s.player_id === active.id);
    const newIdx = lineup.findIndex(s => s.player_id === over.id);
    const reordered = arrayMove(lineup, oldIdx, newIdx).map((s, i) => ({ ...s, batting_order: i + 1 }));
    onChange(reordered);
  };

  const addPlayer = (player: Player) => {
    const defaultPos = player.positions[0] ?? '';
    onChange([...lineup, {
      player_id: player.id,
      player_name: player.name,
      position: defaultPos,
      batting_order: lineup.length + 1,
    }]);
  };

  const removeSlot = (playerId: number) => {
    onChange(lineup.filter(s => s.player_id !== playerId).map((s, i) => ({ ...s, batting_order: i + 1 })));
  };

  const updatePosition = (playerId: number, pos: string) => {
    onChange(lineup.map(s => s.player_id === playerId ? { ...s, position: pos } : s));
  };

  return (
    <div className="card flex-1">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-black font-mono text-base text-white tracking-widest">{team.abbreviation}</span>
        <span className="text-slate-400 text-sm">{team.name}</span>
      </div>
      <p className="text-xs text-slate-500 mb-3">Drag rows to set batting order</p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={lineup.map(s => s.player_id)} strategy={verticalListSortingStrategy}>
          {lineup.map(slot => (
            <SortableRow
              key={slot.player_id}
              slot={slot}
              onRemove={() => removeSlot(slot.player_id)}
              onPositionChange={pos => updatePosition(slot.player_id, pos)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {lineup.length < 9 && (
        <div className="mt-3">
          <label className="label">Add batter</label>
          <select
            className="select text-sm"
            value=""
            onChange={e => {
              const p = (players as Player[]).find(pl => pl.id === parseInt(e.target.value));
              if (p) addPlayer(p);
            }}
          >
            <option value="">— select player —</option>
            {availablePlayers.map(p => (
              <option key={p.id} value={p.id}>#{p.jersey_number} {p.name} ({p.positions.join('/')})</option>
            ))}
          </select>
        </div>
      )}
      <div className="mt-2 text-xs text-slate-600 font-mono">{lineup.length} / 9 batters</div>

      <div className="mt-4 pt-3 border-t border-navy-700">
        <label className="label">Starting Pitcher</label>
        <select
          className="select text-sm"
          value={pitcherId ?? ''}
          onChange={e => onPitcherChange(e.target.value ? parseInt(e.target.value) : null)}
        >
          <option value="">— select pitcher —</option>
          {(players as Player[]).map(p => (
            <option key={p.id} value={p.id}>#{p.jersey_number} {p.name} ({p.positions.join('/')})</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function GameSetupPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: teamsApi.list });

  const [homeId, setHomeId] = useState('');
  const [awayId, setAwayId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [innings, setInnings] = useState(9);
  const [homeLineup, setHomeLineup] = useState<LineupSlot[]>([]);
  const [awayLineup, setAwayLineup] = useState<LineupSlot[]>([]);
  const [homePitcherId, setHomePitcherId] = useState<number | null>(null);
  const [awayPitcherId, setAwayPitcherId] = useState<number | null>(null);

  const homeTeam = (teams as Team[]).find(t => t.id === parseInt(homeId));
  const awayTeam = (teams as Team[]).find(t => t.id === parseInt(awayId));

  // Reset lineups and pitcher when teams change
  useEffect(() => { setHomeLineup([]); setHomePitcherId(null); }, [homeId]);
  useEffect(() => { setAwayLineup([]); setAwayPitcherId(null); }, [awayId]);

  // Build the full lineup entries for a team, appending the starting pitcher as a
  // non-batting entry (batting_order=0) if they aren't already in the batting lineup.
  const buildLineupEntries = (lineup: LineupSlot[], pitcherId: number | null) => {
    const entries = lineup.map(s => ({
      batting_order: s.batting_order,
      player_id: s.player_id,
      position: s.position,
    }));
    if (pitcherId !== null && !lineup.some(s => s.player_id === pitcherId)) {
      entries.push({ batting_order: 0, player_id: pitcherId, position: 'P' });
    }
    return entries;
  };

  const createGame = useMutation({
    mutationFn: async () => {
      const game = await gamesApi.create({
        home_team_id: parseInt(homeId),
        away_team_id: parseInt(awayId),
        game_date: date,
        innings,
      });
      const awayEntries = buildLineupEntries(awayLineup, awayPitcherId);
      if (awayEntries.length > 0) {
        await gamesApi.setLineup(game.id, parseInt(awayId), awayEntries);
      }
      const homeEntries = buildLineupEntries(homeLineup, homePitcherId);
      if (homeEntries.length > 0) {
        await gamesApi.setLineup(game.id, parseInt(homeId), homeEntries);
      }
      return game;
    },
    onSuccess: game => {
      qc.invalidateQueries({ queryKey: ['games'] });
      navigate(`/games/${game.id}/score`);
    },
  });

  const canCreate = homeId && awayId && homeId !== awayId && date;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <Link to="/games" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-6 transition-colors">
        ← Games
      </Link>
      <h1 className="text-3xl font-black text-white tracking-tight mb-6">New Game</h1>

      <div className="card mb-6">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Game Details</div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Away Team</label>
            <select className="select" value={awayId} onChange={e => setAwayId(e.target.value)}>
              <option value="">— select —</option>
              {(teams as Team[]).filter(t => t.id.toString() !== homeId).map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.abbreviation})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Home Team</label>
            <select className="select" value={homeId} onChange={e => setHomeId(e.target.value)}>
              <option value="">— select —</option>
              {(teams as Team[]).filter(t => t.id.toString() !== awayId).map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.abbreviation})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Innings</label>
              <input type="number" className="input" value={innings} min={1} max={21} onChange={e => setInnings(parseInt(e.target.value))} />
            </div>
          </div>
        </div>
      </div>

      {homeTeam && awayTeam && (
        <div className="flex gap-4 mb-6">
          <LineupBuilder team={awayTeam} lineup={awayLineup} onChange={setAwayLineup} pitcherId={awayPitcherId} onPitcherChange={setAwayPitcherId} />
          <LineupBuilder team={homeTeam} lineup={homeLineup} onChange={setHomeLineup} pitcherId={homePitcherId} onPitcherChange={setHomePitcherId} />
        </div>
      )}

      <button
        className="btn-primary px-6 py-2"
        onClick={() => createGame.mutate()}
        disabled={!canCreate || createGame.isPending}
      >
        {createGame.isPending ? 'Creating…' : 'Create Game'}
      </button>
      {createGame.isError && (
        <p className="text-red-400 text-sm mt-2">{(createGame.error as Error).message}</p>
      )}
    </div>
  );
}
