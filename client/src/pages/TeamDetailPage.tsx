import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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
import { playersApi } from '../api/players';
import { Player } from '../types';

const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH', 'IF', 'OF'];

const BATS_LABEL: Record<string, string> = { L: 'L', R: 'R', S: 'S' };

function PlayerForm({ teamId, onDone }: { teamId: number; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '', jersey_number: '', positions: [] as string[],
    bats: 'R' as 'L' | 'R' | 'S', throws: 'R' as 'L' | 'R',
    defensive_rating: '', stealing: '', running: '',
  });

  const isPitcherOnly = form.positions.length === 1 && form.positions[0] === 'P';

  const create = useMutation({
    mutationFn: () => teamsApi.createPlayer(teamId, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team', teamId] }); onDone(); },
  });

  const togglePos = (pos: string) =>
    setForm(f => ({
      ...f,
      positions: f.positions.includes(pos)
        ? f.positions.filter(p => p !== pos)
        : [...f.positions, pos],
    }));

  return (
    <div className="card border-blue-800/60 mb-5">
      <h3 className="font-bold text-white mb-4">Add Player</h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="label">Name *</label>
          <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="First Last" />
        </div>
        <div>
          <label className="label">Jersey #</label>
          <input className="input font-mono" value={form.jersey_number} onChange={e => setForm(f => ({ ...f, jersey_number: e.target.value }))} placeholder="00" />
        </div>
      </div>

      <div className="mb-4">
        <label className="label">Positions</label>
        <div className="flex flex-wrap gap-1.5">
          {POSITIONS.map(pos => (
            <button
              key={pos}
              type="button"
              onClick={() => togglePos(pos)}
              className={`px-2.5 py-1 rounded text-xs font-bold font-mono border transition-all ${
                form.positions.includes(pos)
                  ? 'bg-blue-600 border-blue-500 text-white shadow-glow-blue'
                  : 'bg-navy-700 border-navy-500 text-slate-400 hover:border-slate-400 hover:text-slate-200'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="label">Bats</label>
          <select className="select" value={form.bats} onChange={e => setForm(f => ({ ...f, bats: e.target.value as 'L' | 'R' | 'S' }))}>
            <option value="R">R — Right</option>
            <option value="L">L — Left</option>
            <option value="S">S — Switch</option>
          </select>
        </div>
        <div>
          <label className="label">Throws</label>
          <select className="select" value={form.throws} onChange={e => setForm(f => ({ ...f, throws: e.target.value as 'L' | 'R' }))}>
            <option value="R">R — Right</option>
            <option value="L">L — Left</option>
          </select>
        </div>
      </div>

      {!isPitcherOnly && (
        <div className="mb-5">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Ratings</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Defense</label>
              <input className="input font-mono" value={form.defensive_rating} onChange={e => setForm(f => ({ ...f, defensive_rating: e.target.value }))} placeholder="A+" />
            </div>
            <div>
              <label className="label">Stealing</label>
              <input className="input font-mono" value={form.stealing} onChange={e => setForm(f => ({ ...f, stealing: e.target.value }))} placeholder="A+" />
            </div>
            <div>
              <label className="label">Running</label>
              <input className="input font-mono" value={form.running} onChange={e => setForm(f => ({ ...f, running: e.target.value }))} placeholder="A+" />
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button className="btn-primary" onClick={() => create.mutate()} disabled={!form.name || create.isPending}>
          Add Player
        </button>
        <button className="btn-secondary" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

function PlayerRow({ player, teamId }: { player: Player; teamId: number }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: player.name,
    jersey_number: player.jersey_number,
    positions: player.positions,
    bats: player.bats,
    throws: player.throws,
    defensive_rating: player.defensive_rating ?? '',
    stealing: player.stealing ?? '',
    running: player.running ?? '',
  });

  const update = useMutation({
    mutationFn: () => playersApi.update(player.id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team', teamId] }); setEditing(false); },
  });

  const remove = useMutation({
    mutationFn: () => playersApi.delete(player.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team', teamId] }),
  });

  const togglePos = (pos: string) =>
    setForm(f => ({
      ...f,
      positions: f.positions.includes(pos)
        ? f.positions.filter(p => p !== pos)
        : [...f.positions, pos],
    }));

  const isPitcherOnly = form.positions.length === 1 && form.positions[0] === 'P';

  if (editing) {
    return (
      <div className="card mb-2 border-slate-600">
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Jersey #</label>
            <input className="input font-mono" value={form.jersey_number} onChange={e => setForm(f => ({ ...f, jersey_number: e.target.value }))} />
          </div>
        </div>
        <div className="mb-3">
          <label className="label">Positions</label>
          <div className="flex flex-wrap gap-1.5">
            {POSITIONS.map(pos => (
              <button key={pos} type="button" onClick={() => togglePos(pos)}
                className={`px-2.5 py-1 rounded text-xs font-bold font-mono border transition-all ${
                  form.positions.includes(pos)
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-navy-700 border-navy-500 text-slate-400 hover:border-slate-400'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="label">Bats</label>
            <select className="select" value={form.bats} onChange={e => setForm(f => ({ ...f, bats: e.target.value as 'L' | 'R' | 'S' }))}>
              <option value="R">R</option><option value="L">L</option><option value="S">S</option>
            </select>
          </div>
          <div>
            <label className="label">Throws</label>
            <select className="select" value={form.throws} onChange={e => setForm(f => ({ ...f, throws: e.target.value as 'L' | 'R' }))}>
              <option value="R">R</option><option value="L">L</option>
            </select>
          </div>
        </div>
        {!isPitcherOnly && (
          <div className="mb-4">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Ratings</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Defense</label>
                <input className="input font-mono" value={form.defensive_rating} onChange={e => setForm(f => ({ ...f, defensive_rating: e.target.value }))} placeholder="A+" />
              </div>
              <div>
                <label className="label">Stealing</label>
                <input className="input font-mono" value={form.stealing} onChange={e => setForm(f => ({ ...f, stealing: e.target.value }))} placeholder="A+" />
              </div>
              <div>
                <label className="label">Running</label>
                <input className="input font-mono" value={form.running} onChange={e => setForm(f => ({ ...f, running: e.target.value }))} placeholder="A+" />
              </div>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button className="btn-primary text-xs" onClick={() => update.mutate()}>Save</button>
          <button className="btn-secondary text-xs" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-navy-700/60 group">
      {/* Jersey number */}
      <div className="w-9 text-center font-mono font-bold text-slate-500 text-sm">
        {player.jersey_number ? `#${player.jersey_number}` : '—'}
      </div>

      {/* Name */}
      <div className="flex-1 font-semibold text-slate-200">{player.name}</div>

      {/* Positions */}
      <div className="flex gap-1">
        {player.positions.map(pos => (
          <span key={pos} className="position-badge">{pos}</span>
        ))}
        {player.positions.length === 0 && <span className="text-slate-600 text-xs">—</span>}
      </div>

      {/* Handedness */}
      <div className="text-xs text-slate-500 font-mono w-16 text-right">
        B:{BATS_LABEL[player.bats]} T:{player.throws}
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="btn-secondary text-xs py-1 px-2" onClick={() => setEditing(true)}>Edit</button>
        <button
          className="btn-danger text-xs py-1 px-2"
          onClick={() => { if (confirm(`Remove ${player.name}?`)) remove.mutate(); }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// ── Default Lineup Editor ──────────────────────────────────────────────────

interface LineupSlot {
  player_id: number;
  player_name: string;
  position: string;
  batting_order: number;
}

function SortableLineupRow({
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
      <span className="text-slate-500 w-5 text-xs font-mono font-bold">{slot.batting_order}.</span>
      <span className="flex-1 text-sm text-slate-200">{slot.player_name}</span>
      <select
        className="select w-20 text-xs py-1"
        value={slot.position}
        onChange={e => onPositionChange(e.target.value)}
      >
        <option value="">Pos</option>
        {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <button
        className="text-slate-600 hover:text-red-400 text-xs px-1 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onRemove}
        title="Remove from lineup"
      >
        ✕
      </button>
    </div>
  );
}

function DefaultLineupEditor({ players, teamId }: { players: Player[]; teamId: number }) {
  const qc = useQueryClient();

  // Build initial slots from saved default order
  const [slots, setSlots] = useState<LineupSlot[]>(() => {
    const inLineup = players
      .filter(p => p.default_batting_order > 0)
      .sort((a, b) => a.default_batting_order - b.default_batting_order)
      .map((p, i) => ({
        player_id: p.id,
        player_name: p.name,
        position: p.default_position || p.positions[0] || '',
        batting_order: i + 1,
      }));
    return inLineup;
  });

  const availablePlayers = players.filter(p => !slots.some(s => s.player_id === p.id));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = slots.findIndex(s => s.player_id === active.id);
    const newIdx = slots.findIndex(s => s.player_id === over.id);
    setSlots(arrayMove(slots, oldIdx, newIdx).map((s, i) => ({ ...s, batting_order: i + 1 })));
  };

  const addPlayer = (player: Player) => {
    setSlots(prev => [...prev, {
      player_id: player.id,
      player_name: player.name,
      position: player.default_position || player.positions[0] || '',
      batting_order: prev.length + 1,
    }]);
  };

  const removeSlot = (playerId: number) => {
    setSlots(prev => prev.filter(s => s.player_id !== playerId).map((s, i) => ({ ...s, batting_order: i + 1 })));
  };

  const updatePosition = (playerId: number, pos: string) => {
    setSlots(prev => prev.map(s => s.player_id === playerId ? { ...s, position: pos } : s));
  };

  const save = useMutation({
    mutationFn: () => teamsApi.setDefaultLineup(teamId, slots.map(s => ({
      player_id: s.player_id,
      batting_order: s.batting_order,
      position: s.position,
    }))),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team', teamId] }),
  });

  return (
    <div className="card">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slots.map(s => s.player_id)} strategy={verticalListSortingStrategy}>
          {slots.length === 0 && (
            <p className="text-slate-500 text-xs py-2">No players in lineup yet. Add from the list below.</p>
          )}
          {slots.map(slot => (
            <SortableLineupRow
              key={slot.player_id}
              slot={slot}
              onRemove={() => removeSlot(slot.player_id)}
              onPositionChange={pos => updatePosition(slot.player_id, pos)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {availablePlayers.length > 0 && (
        <div className="mt-3 pt-3 border-t border-navy-700">
          <label className="label">Add to lineup</label>
          <select
            className="select text-sm"
            value=""
            onChange={e => {
              const p = players.find(pl => pl.id === parseInt(e.target.value));
              if (p) addPlayer(p);
            }}
          >
            <option value="">— select player —</option>
            {availablePlayers.map(p => (
              <option key={p.id} value={p.id}>
                #{p.jersey_number || '—'} {p.name} ({p.positions.join('/') || 'no pos'})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-navy-700">
        <span className="text-xs text-slate-500 font-mono">{slots.length} batter{slots.length !== 1 ? 's' : ''} in lineup</span>
        <button
          className="btn-success text-xs px-4"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          {save.isPending ? 'Saving…' : save.isSuccess ? '✓ Saved' : 'Save Default Lineup'}
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const teamId = parseInt(id!);
  const qc = useQueryClient();
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameForm, setNameForm] = useState({ name: '', abbreviation: '' });

  const { data: team, isLoading } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => teamsApi.get(teamId),
  });

  const updateTeam = useMutation({
    mutationFn: () => teamsApi.update(teamId, nameForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team', teamId] }); setEditingName(false); },
  });

  if (isLoading) return <div className="p-6 text-slate-400">Loading…</div>;
  if (!team) return <div className="p-6 text-red-400">Team not found.</div>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Link to="/teams" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-6 transition-colors">
        ← Teams
      </Link>

      {/* Team header */}
      <div className="card mb-6" style={{ background: 'linear-gradient(135deg, #0c1930 0%, #0a1628 100%)' }}>
        {editingName ? (
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="label">Team Name</label>
              <input className="input" value={nameForm.name} onChange={e => setNameForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="w-28">
              <label className="label">Abbreviation</label>
              <input className="input font-mono uppercase tracking-widest" value={nameForm.abbreviation}
                onChange={e => setNameForm(f => ({ ...f, abbreviation: e.target.value.toUpperCase().slice(0, 4) }))} maxLength={4} />
            </div>
            <button className="btn-primary" onClick={() => updateTeam.mutate()}>Save</button>
            <button className="btn-secondary" onClick={() => setEditingName(false)}>Cancel</button>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center font-black font-mono text-xl text-white tracking-widest shrink-0"
              style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0c1930 100%)', border: '1px solid #1a3254' }}
            >
              {team.abbreviation}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-white">{team.name}</h1>
              <span className="text-slate-500 text-sm font-mono">{team.players.length} players on roster</span>
            </div>
            <button
              className="btn-secondary text-xs"
              onClick={() => { setNameForm({ name: team.name, abbreviation: team.abbreviation }); setEditingName(true); }}
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Roster */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Roster</h2>
        <button className="btn-primary text-xs" onClick={() => setShowAddPlayer(v => !v)}>
          {showAddPlayer ? '✕ Cancel' : '+ Add Player'}
        </button>
      </div>

      {showAddPlayer && <PlayerForm teamId={teamId} onDone={() => setShowAddPlayer(false)} />}

      {team.players.length === 0 && !showAddPlayer ? (
        <div className="text-center py-8 text-slate-500">No players yet. Add your first player above.</div>
      ) : (
        <div className="card mb-8">
          {/* Column headers */}
          <div className="flex items-center gap-3 pb-2 mb-1 border-b border-navy-600">
            <div className="w-9 text-xs font-bold text-slate-500 text-center">#</div>
            <div className="flex-1 text-xs font-bold text-slate-500">Player</div>
            <div className="text-xs font-bold text-slate-500">Positions</div>
            <div className="w-16 text-xs font-bold text-slate-500 text-right">B/T</div>
            <div className="w-24" />
          </div>
          {team.players.map(p => (
            <PlayerRow key={p.id} player={p} teamId={teamId} />
          ))}
        </div>
      )}

      {/* Default Lineup */}
      {team.players.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-white">Default Lineup</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Set batting order &amp; positions — auto-loaded when you start a new game
              </p>
            </div>
          </div>
          <DefaultLineupEditor players={team.players} teamId={teamId} />
        </>
      )}
    </div>
  );
}
