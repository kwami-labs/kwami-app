import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api, createRequestGuard, isAbortError } from '@/lib/apiClient';
import { useWorkspaceStore } from '@/stores/workspace';

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


export const useCalendarStore = defineStore('calendar', () => {
  const events = ref<CalendarEvent[]>([]);
  const isLoading = ref(false);
  const isMutating = ref(false);
  const error = ref<string | null>(null);

  const workspaceStore = useWorkspaceStore();
  const activeKwamiId = computed(() => workspaceStore.activeWorkspaceId);

  // Aborts the previous in-flight load when the user switches kwami.
  const guard = createRequestGuard();

  async function fetchEvents(rangeStart: string, rangeEnd: string) {
    if (!activeKwamiId.value) return [];
    isLoading.value = true;
    error.value = null;
    const { signal, isCurrent } = guard.begin();
    try {
      const data = await api.get<{ events: CalendarEvent[] }>('/calendar/events', {
        query: {
          kwami_id: activeKwamiId.value,
          range_start: rangeStart,
          range_end: rangeEnd,
        },
        signal,
      });
      if (!isCurrent()) return events.value;
      events.value = data.events;
      return data.events;
    } catch (err) {
      if (isAbortError(err) || !isCurrent()) return events.value;
      error.value = err instanceof Error ? err.message : 'Failed to load events';
      throw err;
    } finally {
      if (isCurrent()) isLoading.value = false;
    }
  }

  async function createEvent(input: CalendarEventInput) {
    if (!activeKwamiId.value) throw new Error('No active kwami selected');
    isMutating.value = true;
    error.value = null;
    try {
      const data = await api.post<{ event: CalendarEvent }>('/calendar/events', {
        kwami_id: activeKwamiId.value,
        ...input,
      });
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
      const data = await api.patch<{ event: CalendarEvent }>(
        `/calendar/events/${eventId}`,
        patch,
      );
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
      await api.del<{ ok: boolean }>(`/calendar/events/${eventId}`);
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
    guard.cancelAll();
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
