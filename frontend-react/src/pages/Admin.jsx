import { useState, useEffect } from 'react';
import { Navigate, useParams, useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Spinner from '../components/Spinner';
import VehiclesPanel from '../components/VehiclesPanel';
import { useAuth } from '../contexts/AuthContext';
import {
  getMe, getAdminRides, cancelRide, unassignDriver,
  getStudents, setStudentStatus, getSafetyReports, resolveReport,
  getNotices, postNotice, deleteNotice, getAuditLog,
} from '../api/client';

const TABS = [
  { key: 'vehicles', label: 'Vehicles' },
  { key: 'rides', label: 'Rides' },
  { key: 'students', label: 'Students' },
  { key: 'reports', label: 'Reports' },
  { key: 'notices', label: 'Notices' },
  { key: 'audit', label: 'Audit log' },
];

const when = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
const chip = (bg, color) => ({ font: '700 10.5px Karla,sans-serif', letterSpacing: '.08em', textTransform: 'uppercase', background: bg, color, borderRadius: 7, padding: '3px 7px' });
const rowStyle = (last) => ({ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderBottom: last ? 'none' : '1px solid rgba(33,28,38,.06)' });

// Loads once, then re-loads after any action. Every panel below shares it.
function usePanel(loader) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const reload = () => loader().then(setData).catch((e) => setError(e.message));
  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (fn) => {
    setBusy(true);
    setError(null);
    try { await fn(); await reload(); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return { data, error, busy, act };
}

function Panel({ state, empty, children }) {
  if (!state.data && !state.error) return <div className="loading-center" style={{ padding: 60 }}><Spinner /></div>;
  return (
    <>
      {state.error && <div className="error-msg-red" style={{ marginBottom: 16 }}>{state.error}</div>}
      {state.data?.length === 0
        ? <div className="card" style={{ padding: 40, textAlign: 'center', color: 'rgba(33,28,38,.45)', fontWeight: 600 }}>{empty}</div>
        : <div className="card" style={{ padding: 0, overflow: 'hidden', opacity: state.busy ? 0.6 : 1 }}>{children}</div>}
    </>
  );
}

function RidesPanel() {
  const state = usePanel(() => getAdminRides(false));
  return (
    <Panel state={state} empty="No upcoming rides">
      {state.data?.map((r, i) => (
        <div key={r.id} style={rowStyle(i === state.data.length - 1)}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '700 15px Familjen Grotesk,sans-serif', letterSpacing: '-.02em', marginBottom: 3 }}>
              {r.pickupName} → {r.dropName}
              {r.womenOnly && <span style={{ ...chip('#F7E3F0', '#8A2B6B'), marginLeft: 8 }}>Women only</span>}
              <span style={{ ...chip('#F4EEE3', 'rgba(33,28,38,.6)'), marginLeft: 6 }}>{r.kind}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(33,28,38,.55)', fontWeight: 600 }}>
              {when(r.pickupTime)} · {r.driver ? `${r.driver.name} (${r.driver.plateNumber})` : 'no driver yet'} · ₹{r.totalFare.toFixed(0)}
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(33,28,38,.5)', marginTop: 4 }}>
              {r.members.map((m) => `${m.name}${m.boarded ? ' ·boarded' : ''}${m.paid ? ' ·paid' : ''}`).join('  |  ')}
            </div>
          </div>
          {r.driver && (
            <button className="btn-ghost" style={{ width: 'auto', padding: '8px 12px' }} disabled={state.busy}
              onClick={() => state.act(() => unassignDriver(r.id, 'Reassigned by admin'))}>
              Unassign driver
            </button>
          )}
          <button className="btn-ghost" style={{ width: 'auto', padding: '8px 12px', color: '#B3261E' }} disabled={state.busy}
            onClick={() => state.act(() => cancelRide(r.id, 'Cancelled by admin'))}>
            Cancel ride
          </button>
        </div>
      ))}
    </Panel>
  );
}

function StudentsPanel() {
  const state = usePanel(getStudents);
  return (
    <Panel state={state} empty="No students yet">
      {state.data?.map((s, i) => (
        <div key={s.id} style={rowStyle(i === state.data.length - 1)}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '700 15px Familjen Grotesk,sans-serif', letterSpacing: '-.02em' }}>
              {s.name}
              {s.suspended && <span style={{ ...chip('#FDECEA', '#B3261E'), marginLeft: 8 }}>Suspended</span>}
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(33,28,38,.55)', fontWeight: 600 }}>
              {s.email} · {s.rides} rides · {s.ridesBoarded} boarded
              {s.unpaid ? ` · ${s.unpaid} unpaid` : ''}
              {s.reportsAgainst ? ` · ${s.reportsAgainst} reports` : ''}
            </div>
            {s.suspendedReason && <div style={{ fontSize: 12.5, color: '#B3261E', fontWeight: 600, marginTop: 3 }}>{s.suspendedReason}</div>}
          </div>
          <button className="btn-ghost" style={{ width: 'auto', padding: '8px 12px' }} disabled={state.busy}
            onClick={() => state.act(() => setStudentStatus(s.id, !s.suspended, s.suspended ? undefined : 'Suspended by admin'))}>
            {s.suspended ? 'Reinstate' : 'Suspend'}
          </button>
        </div>
      ))}
    </Panel>
  );
}

function ReportsPanel() {
  const state = usePanel(getSafetyReports);
  return (
    <Panel state={state} empty="No reports">
      {state.data?.map((r, i) => (
        <div key={r.id} style={rowStyle(i === state.data.length - 1)}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '700 15px Familjen Grotesk,sans-serif', letterSpacing: '-.02em' }}>
              {r.category}
              <span style={{ ...chip(r.status === 'open' ? '#FFF1DB' : '#E4F2EC', r.status === 'open' ? '#A96A0C' : '#0F6B52'), marginLeft: 8 }}>{r.status}</span>
            </div>
            <div style={{ fontSize: 13, margin: '4px 0', fontWeight: 500 }}>{r.message}</div>
            <div style={{ fontSize: 12.5, color: 'rgba(33,28,38,.5)', fontWeight: 600 }}>
              by {r.reportedBy} · {when(r.at)}
              {r.aboutStudent ? ` · about ${r.aboutStudent}` : ''}
              {r.aboutPlate ? ` · ${r.aboutPlate}` : ''}
              {r.resolution ? ` · ${r.resolution}` : ''}
            </div>
          </div>
          {r.status === 'open' && (
            <>
              <button className="btn-ghost" style={{ width: 'auto', padding: '8px 12px' }} disabled={state.busy}
                onClick={() => state.act(() => resolveReport(r.id, 'resolved', 'Actioned by admin'))}>
                Resolve
              </button>
              <button className="btn-ghost" style={{ width: 'auto', padding: '8px 12px' }} disabled={state.busy}
                onClick={() => state.act(() => resolveReport(r.id, 'dismissed', 'No action needed'))}>
                Dismiss
              </button>
            </>
          )}
        </div>
      ))}
    </Panel>
  );
}

function NoticesPanel() {
  const state = usePanel(getNotices);
  const [message, setMessage] = useState('');
  const [level, setLevel] = useState('info');

  return (
    <>
      <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Notice for every student, e.g. no autos after 10pm tonight"
          style={{ flex: '1 1 320px', minWidth: 0, border: '1.5px solid rgba(33,28,38,.14)', borderRadius: 10, padding: '10px 12px', font: '600 13.5px Karla,sans-serif', background: '#fff' }}
        />
        <select value={level} onChange={(e) => setLevel(e.target.value)} style={{ border: '1.5px solid rgba(33,28,38,.14)', borderRadius: 10, padding: '10px 12px', font: '600 13.5px Karla,sans-serif', background: '#fff' }}>
          <option value="info">info</option>
          <option value="warning">warning</option>
        </select>
        <button className="btn-accent" style={{ width: 'auto', padding: '10px 18px' }} disabled={state.busy || message.trim().length < 3}
          onClick={() => state.act(async () => { await postNotice(message.trim(), level); setMessage(''); })}>
          Post
        </button>
      </div>
      <Panel state={state} empty="No notices posted">
        {state.data?.map((n, i) => (
          <div key={n.id} style={rowStyle(i === state.data.length - 1)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '600 14px Karla,sans-serif' }}>
                {n.level === 'warning' && <span style={{ ...chip('#FFF1DB', '#A96A0C'), marginRight: 8 }}>warning</span>}
                {n.message}
              </div>
              <div style={{ fontSize: 12.5, color: 'rgba(33,28,38,.5)', fontWeight: 600, marginTop: 3 }}>
                {n.by} · {when(n.at)}{n.expiresAt ? ` · until ${when(n.expiresAt)}` : ''}
              </div>
            </div>
            <button className="btn-ghost" style={{ width: 'auto', padding: '8px 12px' }} disabled={state.busy}
              onClick={() => state.act(() => deleteNotice(n.id))}>
              Remove
            </button>
          </div>
        ))}
      </Panel>
    </>
  );
}

function AuditPanel() {
  const state = usePanel(getAuditLog);
  return (
    <Panel state={state} empty="Nothing yet">
      {state.data?.map((a, i) => (
        <div key={a.id} style={rowStyle(i === state.data.length - 1)}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '700 13.5px Karla,sans-serif' }}>{a.action}</div>
            <div style={{ fontSize: 12.5, color: 'rgba(33,28,38,.5)', fontWeight: 600 }}>
              {a.admin} · {when(a.at)}{a.target ? ` · ${a.target}` : ''}{a.details ? ` · ${a.details}` : ''}
            </div>
          </div>
        </div>
      ))}
    </Panel>
  );
}

const PANELS = { vehicles: VehiclesPanel, rides: RidesPanel, students: StudentsPanel, reports: ReportsPanel, notices: NoticesPanel, audit: AuditPanel };

export default function Admin() {
  const { user } = useAuth();
  const { tab = 'vehicles' } = useParams();
  const navigate = useNavigate();
  // Staff only. The backend refuses the data anyway; this keeps a student who
  // types the URL from seeing the panel. Sessions saved before admins existed
  // have no isAdmin, so confirm with the server.
  const [allowed, setAllowed] = useState(user?.isAdmin ? true : null);
  useEffect(() => {
    if (allowed === null) getMe().then((me) => setAllowed(Boolean(me.isAdmin))).catch(() => setAllowed(false));
  }, [allowed]);

  if (allowed === false) return <Navigate to="/dashboard" replace />;
  const Active = PANELS[tab] || VehiclesPanel;

  return (
    <div className="animate-screenIn" style={{ minHeight: '100vh' }}>
      <NavBar />
      <main className="screen-pad" style={{ maxWidth: 1100 }}>
        <h1 style={{ fontFamily: 'Familjen Grotesk,sans-serif', fontWeight: 700, fontSize: 32, letterSpacing: '-.03em', margin: '0 0 16px' }}>
          Admin
        </h1>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => navigate(`/admin/${t.key}`)}
              style={{
                border: 0, borderRadius: 999, padding: '9px 16px', cursor: 'pointer',
                font: '700 13px Karla,sans-serif',
                background: t.key === tab ? '#211C26' : '#fff',
                color: t.key === tab ? '#FDFAF4' : '#211C26',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {allowed === null ? <div className="loading-center" style={{ padding: 60 }}><Spinner /></div> : <Active />}
      </main>
    </div>
  );
}
