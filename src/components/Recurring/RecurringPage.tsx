import { useState, useEffect, useCallback } from 'react';
import type { RecurrenceRule, RecurrenceRulePayload, UserEventCategory } from '../../types';
import {
  fetchRecurringRules,
  createRecurringRule,
  updateRecurringRule,
  deleteRecurringRule,
} from '../../services/api';
import './RecurringPage.css';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BYDAY_OPTIONS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const BYDAY_LABELS: Record<string, string> = {
  MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun',
};
const CATEGORY_COLORS: Record<UserEventCategory, string> = {
  Work: 'var(--color-warning)',
  Life: 'var(--color-life)',
  Workout: 'var(--color-workout)',
  Note: 'var(--color-info)',
  Checkin: 'var(--color-primary)',
};

function formatSchedule(rule: RecurrenceRule): string {
  const interval = rule.interval > 1 ? `Every ${rule.interval} ` : '';
  if (rule.freq === 'daily') return `${interval}Daily`;
  if (rule.freq === 'monthly') return `${interval}Monthly · day ${rule.bymonthday ?? '?'}`;
  // weekly
  const days = rule.byday.map(d => BYDAY_LABELS[d] ?? d).join(', ');
  return `${interval}Weekly · ${days || '?'}`;
}

function nextOccurrence(rule: RecurrenceRule): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(rule.start_date + 'T00:00:00');
  const until = rule.until ? new Date(rule.until + 'T00:00:00') : null;
  if (until && until < today) return 'Ended';

  if (rule.freq === 'weekly' && rule.byday.length > 0) {
    // Walk days until we find one on an allowed weekday and on/after start
    const weekdayMap: Record<string, number> = {
      MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0,
    };
    const targets = new Set(rule.byday.map(d => weekdayMap[d]));
    const candidate = new Date(Math.max(today.getTime(), start.getTime()));
    for (let i = 0; i < 42; i++) {
      if (targets.has(candidate.getDay())) {
        return candidate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      }
      candidate.setDate(candidate.getDate() + 1);
    }
  }
  // daily / monthly or fallback
  const base = start >= today ? start : today;
  return base.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Blank form state
// ---------------------------------------------------------------------------

interface FormState {
  title: string;
  category: UserEventCategory;
  freq: 'daily' | 'weekly' | 'monthly';
  interval: number;
  byday: string[];
  bymonthday: string;
  start_date: string;
  until: string;
  time: string;
  notes: string;
}

const blankForm = (): FormState => ({
  title: '',
  category: 'Work',
  freq: 'weekly',
  interval: 1,
  byday: [],
  bymonthday: '',
  start_date: new Date().toISOString().slice(0, 10),
  until: '',
  time: '07:00',
  notes: '',
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RecurringPage() {
  const [rules, setRules] = useState<RecurrenceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(blankForm());
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(blankForm());
  const [editMode, setEditMode] = useState<'all' | 'this_and_future' | 'this_only'>('all');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRecurringRules();
      setRules(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);
    try {
      const payload: RecurrenceRulePayload = {
        title: createForm.title,
        category: createForm.category,
        freq: createForm.freq,
        interval: createForm.interval,
        byday: createForm.freq === 'weekly' ? createForm.byday : [],
        bymonthday: createForm.freq === 'monthly' && createForm.bymonthday
          ? Number(createForm.bymonthday) : undefined,
        start_date: createForm.start_date,
        until: createForm.until || undefined,
        time: createForm.time,
        notes: createForm.notes || undefined,
      };
      const result = await createRecurringRule(payload);
      setRules(prev => [...prev, result.rule]);
      setShowCreate(false);
      setCreateForm(blankForm());
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create rule');
    } finally {
      setCreateLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Edit
  // ---------------------------------------------------------------------------

  function openEdit(rule: RecurrenceRule) {
    setEditId(rule.id);
    setEditMode('all');
    setEditError(null);
    setEditForm({
      title: rule.title,
      category: rule.category,
      freq: rule.freq,
      interval: rule.interval,
      byday: rule.byday ?? [],
      bymonthday: rule.bymonthday?.toString() ?? '',
      start_date: rule.start_date,
      until: rule.until ?? '',
      time: rule.time,
      notes: rule.notes ?? '',
    });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const payload = {
        edit_mode: editMode,
        title: editForm.title,
        freq: editForm.freq,
        interval: editForm.interval,
        byday: editForm.freq === 'weekly' ? editForm.byday : [],
        bymonthday: editForm.freq === 'monthly' && editForm.bymonthday
          ? Number(editForm.bymonthday) : undefined,
        until: editForm.until || undefined,
        time: editForm.time,
        notes: editForm.notes || undefined,
      };
      const result = await updateRecurringRule(editId, payload);
      void result;
      // Re-fetch because this_and_future creates a new rule
      await load();
      setEditId(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Failed to update rule');
    } finally {
      setEditLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  async function handleDelete(ruleId: string) {
    setDeleteLoading(true);
    try {
      await deleteRecurringRule(ruleId);
      setRules(prev => prev.filter(r => r.id !== ruleId));
      setDeleteId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete rule');
    } finally {
      setDeleteLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="recurring-page">
      <div className="recurring-header">
        <div>
          <h2>Recurring Events</h2>
          <p className="recurring-subtitle">
            Rules that automatically populate your plan files. Events are written out for the next ~6 months.
          </p>
        </div>
        <button className="btn-primary" onClick={() => { setShowCreate(true); setCreateError(null); }}>
          + Add Recurring Event
        </button>
      </div>

      {error && <div className="recurring-error">{error}</div>}

      {/* ── Create form ── */}
      {showCreate && (
        <div className="rule-form-card">
          <h3>New Recurring Event</h3>
          <form onSubmit={handleCreate}>
            <RuleFormFields form={createForm} onChange={setCreateForm} />
            {createError && <div className="form-error">{createError}</div>}
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={createLoading}>
                {createLoading ? 'Creating…' : 'Create & Materialize'}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Rules list ── */}
      {loading ? (
        <div className="recurring-loading">Loading…</div>
      ) : rules.length === 0 && !showCreate ? (
        <div className="recurring-empty">
          No recurring events yet. Add one to automatically populate your calendar.
        </div>
      ) : (
        <div className="rules-list">
          {rules.map(rule => (
            <div key={rule.id} className="rule-card">
              {editId === rule.id ? (
                /* ── Inline edit form ── */
                <div className="rule-edit-form">
                  <h4>Edit: {rule.title}</h4>
                  <div className="edit-mode-selector">
                    <label>Apply changes to:</label>
                    <div className="edit-mode-options">
                      {(['all', 'this_and_future'] as const).map(mode => (
                        <label key={mode} className="radio-label">
                          <input
                            type="radio"
                            name="editMode"
                            value={mode}
                            checked={editMode === mode}
                            onChange={() => setEditMode(mode)}
                          />
                          {mode === 'all' ? 'All events' : 'This and future'}
                        </label>
                      ))}
                    </div>
                  </div>
                  <form onSubmit={handleEdit}>
                    <RuleFormFields form={editForm} onChange={setEditForm} />
                    {editError && <div className="form-error">{editError}</div>}
                    <div className="form-actions">
                      <button type="submit" className="btn-primary" disabled={editLoading}>
                        {editLoading ? 'Saving…' : 'Save Changes'}
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => setEditId(null)}>
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              ) : deleteId === rule.id ? (
                /* ── Delete confirm ── */
                <div className="rule-delete-confirm">
                  <p>Delete <strong>{rule.title}</strong>? This will remove all materialized events from your plan files.</p>
                  <div className="form-actions">
                    <button
                      className="btn-danger"
                      disabled={deleteLoading}
                      onClick={() => handleDelete(rule.id)}
                    >
                      {deleteLoading ? 'Deleting…' : 'Yes, Delete All'}
                    </button>
                    <button className="btn-ghost" onClick={() => setDeleteId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Rule summary row ── */
                <div className="rule-summary">
                  <div className="rule-summary-left">
                    <span
                      className="rule-category-badge"
                      style={{ background: CATEGORY_COLORS[rule.category] }}
                    >
                      {rule.category}
                    </span>
                    <div className="rule-info">
                      <span className="rule-title">{rule.title}</span>
                      <span className="rule-meta">
                        {formatSchedule(rule)} · {rule.time}
                        {rule.until && <> · until {rule.until}</>}
                      </span>
                      <span className="rule-next">Next: {nextOccurrence(rule)}</span>
                    </div>
                  </div>
                  <div className="rule-actions">
                    <button className="btn-ghost btn-sm" onClick={() => openEdit(rule)}>Edit</button>
                    <button className="btn-ghost btn-sm btn-danger-ghost" onClick={() => setDeleteId(rule.id)}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared form fields
// ---------------------------------------------------------------------------

interface FieldsProps {
  form: FormState;
  onChange: (f: FormState) => void;
}

function RuleFormFields({ form, onChange }: FieldsProps) {
  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    onChange({ ...form, [key]: value });
  }

  function toggleByday(day: string) {
    const next = form.byday.includes(day)
      ? form.byday.filter(item => item !== day)
      : [...form.byday, day];
    set('byday', next);
  }

  return (
    <div className="form-grid">
      <div className="form-row">
        <label>Title
          <input
            type="text"
            required
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="Morning Shift"
          />
        </label>
        <label>Category
          <select value={form.category} onChange={e => set('category', e.target.value as UserEventCategory)}>
            <option value="Work">Work</option>
            <option value="Life">Life</option>
            <option value="Workout">Workout</option>
            <option value="Note">Note</option>
            <option value="Checkin">Checkin</option>
          </select>
        </label>
      </div>

      <div className="form-row">
        <label>Start time
          <input
            type="time"
            required
            value={form.time}
            onChange={e => set('time', e.target.value)}
          />
        </label>
        <label>Frequency
          <select value={form.freq} onChange={e => set('freq', e.target.value as FormState['freq'])}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label>Every
          <input
            type="number"
            min={1}
            max={52}
            value={form.interval}
            onChange={e => set('interval', Number(e.target.value))}
          />
          <span className="input-suffix">
            {form.freq === 'daily' ? 'day(s)' : form.freq === 'weekly' ? 'week(s)' : 'month(s)'}
          </span>
        </label>
      </div>

      {form.freq === 'weekly' && (
        <div className="form-row">
          <label className="label-block">Days of week
            <div className="byday-pills">
              {BYDAY_OPTIONS.map(day => (
                <button
                  key={day}
                  type="button"
                  className={`byday-pill${form.byday.includes(day) ? ' active' : ''}`}
                  onClick={() => toggleByday(day)}
                >
                  {BYDAY_LABELS[day]}
                </button>
              ))}
            </div>
          </label>
        </div>
      )}

      {form.freq === 'monthly' && (
        <div className="form-row">
          <label>Day of month
            <input
              type="number"
              min={1}
              max={31}
              value={form.bymonthday}
              onChange={e => set('bymonthday', e.target.value)}
              placeholder="15"
            />
          </label>
        </div>
      )}

      <div className="form-row">
        <label>Start date
          <input
            type="date"
            required
            value={form.start_date}
            onChange={e => set('start_date', e.target.value)}
          />
        </label>
        <label>End date <span className="optional">(optional)</span>
          <input
            type="date"
            value={form.until}
            onChange={e => set('until', e.target.value)}
          />
        </label>
      </div>

      <div className="form-row">
        <label className="label-block">Notes <span className="optional">(optional)</span>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={2}
            placeholder="Any context for Coach…"
          />
        </label>
      </div>
    </div>
  );
}
