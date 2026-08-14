import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { TeamMember } from '../lib/api';
import { PageHeader, Card, Skeleton, ErrorState } from '../components/ui';

const ROLE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  owner: { bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Owner' },
  staff: { bg: 'bg-ink-100', text: 'text-ink-600', label: 'Staff' },
  read_only: { bg: 'bg-amber-100', text: 'text-amber-600', label: 'Read only' },
};

const AVATAR_COLORS = ['bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-ink-600', 'bg-emerald-600'];

function avatarColor(seed: string) {
  const idx = seed.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export default function Team() {
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);

  function load() {
    api.getTeam().then(setTeam).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  if (error) return <div className="p-8"><ErrorState message={error} /></div>;

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        title="Team"
        subtitle={team ? `${team.length} member${team.length !== 1 ? 's' : ''}` : undefined}
        actions={
          <button
            onClick={() => setShowInvite(true)}
            className="px-4 py-2 rounded-lg bg-ink-950 text-white text-[13.5px] font-medium hover:bg-ink-800 transition-colors"
          >
            + Invite member
          </button>
        }
      />

      <Card>
        <div className="divide-y divide-ink-100">
          {!team &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-4 w-48" />
              </div>
            ))}
          {team?.map((member) => {
            const role = ROLE_STYLES[member.role] ?? ROLE_STYLES.staff;
            return (
              <div key={member.id} className="px-6 py-4 flex items-center justify-between hover:bg-ink-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full ${avatarColor(member.name)} flex items-center justify-center text-[12px] font-semibold text-white`}>
                    {member.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-[13.5px] font-medium text-ink-900">{member.name}</p>
                    <p className="text-[12.5px] text-ink-500">{member.email}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[12px] font-medium ${role.bg} ${role.text}`}>
                  {role.label}
                </span>
              </div>
            );
          })}
          {team?.length === 0 && (
            <div className="px-6 py-10 text-center">
              <p className="text-[13.5px] text-ink-500">No team members yet</p>
            </div>
          )}
        </div>
      </Card>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={() => {
            setShowInvite(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.inviteTeamMember(email, name, role);
      onInvited();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-950/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[15px] font-semibold text-ink-900 mb-4">Invite team member</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-ink-700 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ink-200 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              required
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-ink-700 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ink-200 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              required
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-ink-700 mb-1.5">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ink-200 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="owner">Owner</option>
              <option value="staff">Staff</option>
              <option value="read_only">Read only</option>
            </select>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-rose-100 text-rose-600 text-[13px]">{error}</div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-ink-200 text-ink-700 text-[13.5px] font-medium hover:bg-ink-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 rounded-lg bg-ink-950 text-white text-[13.5px] font-medium hover:bg-ink-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Inviting…' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
