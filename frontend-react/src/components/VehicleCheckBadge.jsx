// "Verified vehicle · inspected 12 Oct" on the driver card. `check` is the
// vehicleCheck block the backend attaches to an assigned driver.
const day = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export default function VehicleCheckBadge({ check }) {
  if (!check) return null;
  const verified = check.verified;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        font: '700 11.5px Karla,sans-serif', borderRadius: 8, padding: '5px 9px',
        background: verified ? '#E4F2EC' : '#F4EEE3',
        color: verified ? '#0F6B52' : 'rgba(33,28,38,.6)',
      }}>
        {verified ? `✓ Verified vehicle · inspected ${day(check.inspectedOn)}` : 'Inspection due'}
      </span>
      {check.registrationNumber && (
        <span style={{ font: '600 11.5px Karla,sans-serif', color: 'rgba(33,28,38,.5)' }}>
          Reg {check.registrationNumber}
        </span>
      )}
      {check.serviceOverdue && (
        <span style={{ font: '700 11.5px Karla,sans-serif', color: '#A96A0C' }}>Service due</span>
      )}
    </div>
  );
}
