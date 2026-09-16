import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export type CalendarEventType = 'meeting' | 'task' | 'personal' | 'reminder' | 'focus' | 'other';

export interface CalendarEvent {
  id: string;
  kwami_id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  event_type: CalendarEventType;
  color: string;
  location: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CalendarEventInput {
  title: string;
  starts_at: string;
  ends_at: string;
  description?: string;
  all_day?: boolean;
  event_type?: CalendarEventType;
  color?: string;
  location?: string;
  metadata?: Record<string, unknown>;
}

async function authHeaders(): Promise<HeadersInit> {
  const authStore = useAuthStore();
  const token = await authStore.getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const detail = err.detail ?? err.message;
    throw new Error(typeof detail === 'string' ? detail : `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const useCalendarStore = defineStore('calendar', () => {
  const events = ref<CalendarEvent[]>([]);
  const isLoading = ref(false);
  const isMutating = ref(false);
  const error = ref<string | null>(null);

  const workspaceStore = useWorkspaceStore();
  const activeKwamiId = computed(() => workspaceStore.activeWorkspaceId);

  // Guards against a stale response landing after the user switched kwami.
  let eventsRequestNonce = 0;

  async function fetchEvents(rangeStart: string, rangeEnd: string) {
    if (!activeKwamiId.value) return [];
    isLoading.value = true;
    error.value = null;
    const requestNonce = ++eventsRequestNonce;
    try {
      const params = new URLSearchParams({
        kwami_id: activeKwamiId.value,
        range_start: rangeStart,
        range_end: rangeEnd,
      });
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/calendar/events?${params.toString()}`, { headers });
      const data = await parseJson<{ events: CalendarEvent[] }>(res);
      if (requestNonce !== eventsRequestNonce) return events.value;
      events.value = data.events;
      return data.events;
    } catch (err) {
      if (requestNonce !== eventsRequestNonce) return events.value;
      error.value = err instanceof Error ? err.message : 'Failed to load events';
      throw err;
    } finally {
      if (requestNonce === eventsRequestNonce) isLoading.value = false;
    }
  }

  async function createEvent(input: CalendarEventInput) {
    if (!activeKwamiId.value) throw new Error('No active kwami selected');
    isMutating.value = true;
    error.value = null;
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/calendar/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          kwami_id: activeKwamiId.value,
          ...input,
        }),
      });
      const data = await parseJson<{ event: CalendarEvent }>(res);
      events.value = [...events.value, data.event].sort((a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );
      return data.event;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create event';
      throw err;
    } finally {
      isMutating.value = false;
    }
  }

  async function updateEvent(eventId: string, patch: Partial<CalendarEventInput>) {
    isMutating.value = true;
    error.value = null;
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/calendar/events/${eventId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(patch),
      });
      const data = await parseJson<{ event: CalendarEvent }>(res);
      events.value = events.value.map((event) => (event.id === eventId ? data.event : event));
      return data.event;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update event';
      throw err;
    } finally {
      isMutating.value = false;
    }
  }

  async function deleteEvent(eventId: string) {
    isMutating.value = true;
    error.value = null;
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API_BASE}/calendar/events/${eventId}`, {
        method: 'DELETE',
        headers,
      });
      await parseJson<{ ok: boolean }>(res);
      events.value = events.value.filter((event) => event.id !== eventId);
      return true;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete event';
      throw err;
    } finally {
      isMutating.value = false;
    }
  }

  function clear() {
    events.value = [];
    error.value = null;
  }

  return {
    events,
    isLoading,
    isMutating,
    error,
    activeKwamiId,
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    clear,
  };
});
