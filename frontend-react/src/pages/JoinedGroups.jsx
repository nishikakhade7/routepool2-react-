import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Spinner from '../components/Spinner';
import GroupChat from '../components/GroupChat';
import FareBreakup from '../components/FareBreakup';
import { getMyGroups, leaveGroup } from '../api/client';

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
            <div style={{ marginBottom: 16 }}><FareBreakup fare={justJoined.fare} open /></div>
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
                  <FareBreakup fare={g.fare} />
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
