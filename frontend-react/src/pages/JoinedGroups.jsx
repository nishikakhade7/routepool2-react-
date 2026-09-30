import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Spinner from '../components/Spinner';
import GroupChat from '../components/GroupChat';
import FareBreakup from '../components/FareBreakup';
import { getMyGroups, leaveGroup, setGroupMeeting } from '../api/client';

// Public-transport groups agree a meeting point and mode instead of splitting an auto fare.
const MODES = ['bus', 'train', 'metro', 'walk', 'other'];

function MeetingDetails({ group, saving, onSave }) {
  const [point, setPoint] = useState(group.meetingPoint || '');
  const [mode, setMode] = useState(group.transitMode || '');
  const changed = point !== (group.meetingPoint || '') || mode !== (group.transitMode || '');
  const field = { border: '1.5px solid rgba(33,28,38,.14)', borderRadius: 10, padding: '8px 10px', font: '600 13px Karla,sans-serif', background: '#fff' };

  return (
    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ font: '700 10.5px Karla,sans-serif', letterSpacing: '.1em', textTransform: 'uppercase', color: '#8A2B6B', background: '#F7E3F0', borderRadius: 7, padding: '3px 7px' }}>
        Public transport
      </span>
      <input
        value={point}
        onChange={e => setPoint(e.target.value)}
        placeholder="Meeting point (e.g. Gate 2 bus stop)"
        style={{ ...field, flex: '1 1 220px', minWidth: 0 }}
      />
      <select value={mode} onChange={e => setMode(e.target.value)} style={field}>
        <option value="">Mode…</option>
        {MODES.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      {changed && (
        <button className="btn-ghost" style={{ width: 'auto', padding: '8px 14px' }} disabled={saving} onClick={() => onSave(group, point, mode || undefined)}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      )}
    </div>
  );
}

function fmt(isoStr) {
  return new Date(isoStr).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
}

// Every join lands here as /groups?joined=<id>: confirmation first, then the chat.
export default function JoinedGroups() {
  const [params] = useSearchParams();
  const joinedId = params.get('joined');
  const [groups, setGroups] = useState(null);
  const [error, setError] = useState(null);
  const [chatGroup, setChatGroup] = useState(null);
  const [savingId, setSavingId] = useState(null);

  async function saveMeeting(group, meetingPoint, transitMode) {
    setSavingId(group.id);
    setError(null);
    try {
      const updated = await setGroupMeeting(group.id, { meetingPoint, transitMode });
      setGroups(prev => prev.map(g => (g.id === group.id ? { ...g, meetingPoint: updated.meetingPoint, transitMode: updated.transitMode } : g)));
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  }

  // A rider can only be in one upcoming group; leaving frees them to book another.
  async function handleLeave(g) {
    try {
      await leaveGroup(g.id);
      setGroups(await getMyGroups());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    getMyGroups().then(setGroups).catch(e => setError(e.message));
  }, []);

  const justJoined = groups?.find(g => g.id === joinedId);
  const route = g => `${g.pickupName} → ${g.dropName}`;

  return (
    <div className="animate-screenIn" style={{ minHeight: '100vh' }}>
      <NavBar />
      <main className="screen-pad" style={{ maxWidth: 900 }}>
        <h1 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 32, letterSpacing: '-.03em', margin: '0 0 24px' }}>
          Joined groups
        </h1>

        {justJoined && (
          <div className="card" style={{ marginBottom: 28, border: '1px solid rgba(15,138,95,.35)', background: '#E4F2EC' }}>
            <div style={{ font: '700 20px Familjen Grotesk,sans-serif', color: '#0F6B52', marginBottom: 6 }}>✓ You're in!</div>
            <div style={{ fontWeight: 600, marginBottom: 16 }}>
              {route(justJoined)} · {fmt(justJoined.pickupTime)} · with {justJoined.members.map(m => m.name).join(', ')}
            </div>
            <div style={{ marginBottom: 16 }}>
              {justJoined.kind === 'transit'
                ? <MeetingDetails group={justJoined} saving={savingId === justJoined.id} onSave={saveMeeting} />
                : <FareBreakup fare={justJoined.fare} open />}
            </div>
            <button className="btn-accent" style={{ width: 'auto', padding: '12px 22px' }} onClick={() => setChatGroup(justJoined)}>
              Open group chat
            </button>
          </div>
        )}

        {error && <div className="error-msg-red">{error}</div>}

        {!groups && !error ? (
          <div className="loading-center" style={{ padding: 40 }}><Spinner /></div>
        ) : groups?.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'rgba(33,28,38,.45)', fontWeight: 600 }}>
            You haven't joined any groups yet.
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {groups?.map((g, i) => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', borderBottom: i < groups.length - 1 ? '1px solid rgba(33,28,38,.06)' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '700 15px Familjen Grotesk,sans-serif', letterSpacing: '-.02em', marginBottom: 2 }}>{route(g)}</div>
                  <div style={{ fontSize: 12, color: 'rgba(33,28,38,.5)', fontWeight: 600 }}>
                    {fmt(g.pickupTime)} · {g.status} · {g.members.map(m => m.name).join(', ')}
                  </div>
                  {g.kind === 'transit'
                    ? <MeetingDetails group={g} saving={savingId === g.id} onSave={saveMeeting} />
                    : <FareBreakup fare={g.fare} />}
                </div>
                <button className="btn-primary" style={{ width: 'auto', padding: '10px 18px' }} onClick={() => setChatGroup(g)}>
                  Chat
                </button>
                <button className="btn-ghost" style={{ width: 'auto', padding: '10px 18px' }} onClick={() => handleLeave(g)}>
                  Leave
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {chatGroup && <GroupChat groupId={chatGroup.id} groupName={route(chatGroup)} route={fmt(chatGroup.pickupTime)} onClose={() => setChatGroup(null)} />}
    </div>
  );
}
