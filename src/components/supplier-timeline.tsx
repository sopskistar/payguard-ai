'use client';
import { useEffect, useState, useCallback } from 'react';
import type { TimelineEvent } from '@/lib/business-types';
import { api, Badge } from './ui';
export function SupplierTimeline({
  vendorId,
  organizationId,
}: {
  vendorId: string;
  organizationId?: string;
}) {
  const [events, setEvents] = useState<TimelineEvent[]>(),
    [filter, setFilter] = useState('all'),
    [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      setError('');
      setEvents(
        await api<TimelineEvent[]>(
          organizationId
            ? 'business/' + organizationId + '/timeline?vendorId=' + vendorId
            : 'suppliers/' + vendorId + '/timeline',
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [vendorId, organizationId]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);
  const selected = events?.filter(
    (e) =>
      filter === 'all' ||
      e.category === filter ||
      (filter === 'pending' && ['pending', 'clarification', 'invalidated'].includes(e.status)),
  );
  return (
    <section className="panel supplier-timeline" aria-label="Supplier change timeline">
      <div className="section-heading">
        <div>
          <span className="eyebrow">SUPPLIER HISTORY</span>
          <h2>Change timeline</h2>
        </div>
        <button className="button outline small" onClick={() => void load()}>
          Refresh timeline
        </button>
      </div>
      <label className="field">
        <span>Timeline filter</span>
        <select
          aria-label="Timeline filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          {[
            ['all', 'All events'],
            ['recipient', 'Payment recipient changes'],
            ['verification', 'Verification decisions'],
            ['memory', 'Walrus memory events'],
            ['pending', 'Pending reviews'],
          ].map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p className="small-text">
        Ordered by recorded timestamps. Events with equal timestamps have no inferred sub-order.
        Database audit and Walrus confirmation evidence are labeled separately.
      </p>
      {error && <p role="alert">{error}</p>}
      {!events && !error && <p role="status">Loading recorded evidence…</p>}
      {selected?.length === 0 && <p>No recorded events match this filter.</p>}
      <ol className="timeline-events">
        {selected?.map((event) => (
          <li key={event.id}>
            <div>
              <time dateTime={event.at}>{new Date(event.at).toLocaleString()}</time>
              <Badge tone={event.status === 'pending' ? 'amber' : 'neutral'}>{event.status}</Badge>
            </div>
            <h3>{event.title}</h3>
            <p>
              {event.source}
              {event.invoice ? ' · ' + event.invoice : ''}
            </p>
            <small>Actor: {event.actor}</small>
            <details>
              <summary>Recorded evidence and provenance</summary>
              <pre className="source-text">{JSON.stringify(event.evidence, null, 2)}</pre>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
