<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useToast } from 'vue-toastification';
import BasePanel from '@/components/ui/BasePanel.vue';
import { panelIcons } from '@/constants/panel-icons';
import { useCalendarStore, type CalendarEvent, type CalendarEventType } from '@/stores/calendar';
import { useWorkspaceStore } from '@/stores/workspace';

const { t, locale } = useI18n();
type CalendarView = 'month' | 'week' | 'day' | 'agenda';
const viewMode = ref<CalendarView>('month');
const referenceDate = ref(new Date());
const selectedDate = ref(new Date());
const calendarIcon = panelIcons.calendar ?? 'ph:calendar-duotone';
const toast = useToast();
const calendarStore = useCalendarStore();
const workspaceStore = useWorkspaceStore();

const viewOptions: CalendarView[] = ['month', 'week', 'day', 'agenda'];
const eventTypeOptions: CalendarEventType[] = [
  'meeting',
  'task',
  'personal',
  'reminder',
  'focus',
  'other',
];

const showForm = ref(false);
const editingEventId = ref<string | null>(null);
const form = ref({
  title: '',
  startsAt: '',
  endsAt: '',
  eventType: 'meeting' as CalendarEventType,
  color: '#6366f1',
  location: '',
  description: '',
});

/**
 * Local calendar-day key (YYYY-MM-DD).
 *
 * Must NOT go through toISOString(): the grid is built from local-midnight
 * Dates, and converting those to UTC shifts the key by a day for anyone east
 * of UTC, so events were filed against the wrong cell.
 */
function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const weekDayLabels = computed(() => {
  const start = new Date(2024, 0, 1); // Monday
  return Array.from({ length: 7 }, (_, i) =>
    new Date(start.getTime() + i * 86400000).toLocaleDateString(locale.value, { weekday: 'short' }),
  );
});

function startOfWeek(date: Date) {
  const dayIndex = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayIndex);
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

const headerLabel = computed(() => {
  if (viewMode.value === 'month') {
    return referenceDate.value.toLocaleString(locale.value, { month: 'long', year: 'numeric' });
  }
  if (viewMode.value === 'week') {
    const start = startOfWeek(referenceDate.value);
    const end = addDays(start, 6);
    const startText = start.toLocaleDateString(locale.value, { month: 'short', day: 'numeric' });
    const endText = end.toLocaleDateString(locale.value, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${startText} - ${endText}`;
  }
  if (viewMode.value === 'day') {
    return referenceDate.value.toLocaleDateString(locale.value, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return t('calendar.agendaTitle');
});

const monthDays = computed(() => {
  const year = referenceDate.value.getFullYear();
  const month = referenceDate.value.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (firstDay.getDay() + 6) % 7;

  const days: Array<{ date: Date; inMonth: boolean }> = [];

  for (let i = 0; i < offset; i++) {
    const date = new Date(year, month, -(offset - i - 1));
    days.push({ date, inMonth: false });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    days.push({ date: new Date(year, month, day), inMonth: true });
  }

  while (days.length < 42) {
    const last = days[days.length - 1];
    if (!last) break;
    days.push({
      date: new Date(last.date.getFullYear(), last.date.getMonth(), last.date.getDate() + 1),
      inMonth: false,
    });
  }

  return days;
});

const weekDays = computed(() => {
  const start = startOfWeek(referenceDate.value);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
});

const hours = Array.from({ length: 13 }, (_, i) => `${String(i + 8).padStart(2, '0')}:00`);

/**
 * The stored timestamp is UTC, so slicing the raw string yields the UTC day.
 * Convert to the viewer's local day instead, matching toDateKey — otherwise a
 * late-evening event west of UTC lands on tomorrow's cell.
 */
function eventDateKey(event: CalendarEvent) {
  return toDateKey(new Date(event.starts_at));
}

function timeRange(event: CalendarEvent) {
  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  const startText = start.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' });
  const endText = end.toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit' });
  return `${startText} - ${endText}`;
}

function eventsOn(date: Date) {
  const key = toDateKey(date);
  return calendarStore.events
    .filter((event) => eventDateKey(event) === key)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
}

const selectedDateKey = computed(() => toDateKey(selectedDate.value));
const selectedEvents = computed(() => eventsOn(selectedDate.value));

const agendaEvents = computed(() => {
  const start = new Date(
    referenceDate.value.getFullYear(),
    referenceDate.value.getMonth(),
    referenceDate.value.getDate(),
  );
  const end = addDays(start, 14).getTime();
  return calendarStore.events
    .filter((event) => {
      const eventTime = new Date(event.starts_at).getTime();
      return eventTime >= start.getTime() && eventTime <= end;
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
});

function isToday(date: Date) {
  return toDateKey(date) === toDateKey(new Date());
}

function hasEvents(date: Date) {
  return eventsOn(date).length > 0;
}

function previousRange() {
  if (viewMode.value === 'month') {
    referenceDate.value = new Date(
      referenceDate.value.getFullYear(),
      referenceDate.value.getMonth() - 1,
      1,
    );
    return;
  }
  if (viewMode.value === 'week') {
    referenceDate.value = addDays(referenceDate.value, -7);
    return;
  }
  referenceDate.value = addDays(referenceDate.value, -1);
}

function nextRange() {
  if (viewMode.value === 'month') {
    referenceDate.value = new Date(
      referenceDate.value.getFullYear(),
      referenceDate.value.getMonth() + 1,
      1,
    );
    return;
  }
  if (viewMode.value === 'week') {
    referenceDate.value = addDays(referenceDate.value, 7);
    return;
  }
  referenceDate.value = addDays(referenceDate.value, 1);
}

function goToToday() {
  const today = new Date();
  referenceDate.value = today;
  selectedDate.value = today;
}

function dateInputValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function openCreateForm(baseDate?: Date) {
  const start = baseDate ? new Date(baseDate) : new Date(selectedDate.value);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(start.getHours() + 1);
  form.value = {
    title: '',
    startsAt: dateInputValue(start),
    endsAt: dateInputValue(end),
    eventType: 'meeting',
    color: '#6366f1',
    location: '',
    description: '',
  };
  editingEventId.value = null;
  showForm.value = true;
}

function openEditForm(event: CalendarEvent) {
  editingEventId.value = event.id;
  form.value = {
    title: event.title,
    startsAt: dateInputValue(new Date(event.starts_at)),
    endsAt: dateInputValue(new Date(event.ends_at)),
    eventType: event.event_type,
    color: event.color,
    location: event.location ?? '',
    description: event.description ?? '',
  };
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingEventId.value = null;
}

function rangeForView() {
  if (viewMode.value === 'month') {
    const year = referenceDate.value.getFullYear();
    const month = referenceDate.value.getMonth();
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }
  if (viewMode.value === 'week') {
    const start = startOfWeek(referenceDate.value);
    const end = addDays(start, 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (viewMode.value === 'day') {
    const start = new Date(referenceDate.value);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  // agenda: a rolling two-week look-ahead
  const start = new Date(referenceDate.value);
  start.setHours(0, 0, 0, 0);
  const end = addDays(start, 14);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function refreshEvents() {
  if (!workspaceStore.activeWorkspaceId) return;
  const { start, end } = rangeForView();
  await calendarStore.fetchEvents(start.toISOString(), end.toISOString());
}

async function submitForm() {
  if (!form.value.title.trim()) {
    toast.error(t('calendar.errors.titleRequired'));
    return;
  }
  if (!form.value.startsAt || !form.value.endsAt) {
    toast.error(t('calendar.errors.timeRequired'));
    return;
  }
  if (new Date(form.value.endsAt).getTime() < new Date(form.value.startsAt).getTime()) {
    toast.error(t('calendar.errors.invalidRange'));
    return;
  }
  try {
    if (editingEventId.value) {
      await calendarStore.updateEvent(editingEventId.value, {
        title: form.value.title,
        starts_at: new Date(form.value.startsAt).toISOString(),
        ends_at: new Date(form.value.endsAt).toISOString(),
        event_type: form.value.eventType,
        color: form.value.color,
        location: form.value.location,
        description: form.value.description,
      });
      toast.success(t('calendar.toasts.updated'));
    } else {
      await calendarStore.createEvent({
        title: form.value.title,
        starts_at: new Date(form.value.startsAt).toISOString(),
        ends_at: new Date(form.value.endsAt).toISOString(),
        event_type: form.value.eventType,
        color: form.value.color,
        location: form.value.location,
        description: form.value.description,
      });
      toast.success(t('calendar.toasts.created'));
    }
    closeForm();
  } catch (err) {
    const message = err instanceof Error ? err.message : t('calendar.errors.saveFailed');
    toast.error(message);
  }
}

async function removeEvent(eventId: string) {
  if (!window.confirm(t('calendar.confirmDelete'))) return;
  try {
    await calendarStore.deleteEvent(eventId);
    toast.success(t('calendar.toasts.deleted'));
  } catch (err) {
    const message = err instanceof Error ? err.message : t('calendar.errors.deleteFailed');
    toast.error(message);
  }
}

onMounted(() => {
  refreshEvents().catch(() => undefined);
});

watch([referenceDate, viewMode], () => {
  refreshEvents().catch(() => undefined);
});

watch(
  () => workspaceStore.activeWorkspaceId,
  () => {
    calendarStore.clear();
    refreshEvents().catch(() => undefined);
  },
);
</script>

<template>
  <BasePanel :title="t('sidebar.panels.calendar')" :icon="calendarIcon">
    <div class="calendar-panel">
      <div class="calendar-header">
        <div>
          <h3>{{ headerLabel }}</h3>
          <p>{{ t('calendar.subtitle') }}</p>
        </div>
        <div class="toolbar">
          <button class="create-btn" @click="openCreateForm(selectedDate)">
            <iconify-icon icon="ph:plus-bold"></iconify-icon>
            {{ t('calendar.addEvent') }}
          </button>
          <div class="view-toggle">
            <button
              v-for="view in viewOptions"
              :key="view"
              class="view-btn"
              :class="{ active: viewMode === view }"
              @click="viewMode = view"
            >
              {{ t(`calendar.views.${view}`) }}
            </button>
          </div>
          <button class="nav-btn" @click="previousRange" :aria-label="t('calendar.previousRange')">
            <iconify-icon icon="ph:caret-left-bold"></iconify-icon>
          </button>
          <button class="today-btn" @click="goToToday">{{ t('calendar.today') }}</button>
          <button class="nav-btn" @click="nextRange" :aria-label="t('calendar.nextRange')">
            <iconify-icon icon="ph:caret-right-bold"></iconify-icon>
          </button>
        </div>
      </div>

      <template v-if="viewMode === 'month'">
        <div class="calendar-content month-layout">
          <div class="calendar-grid">
            <div v-for="label in weekDayLabels" :key="label" class="weekday">{{ label }}</div>

            <button
              v-for="entry in monthDays"
              :key="toDateKey(entry.date)"
              class="day-cell"
              :class="{
                muted: !entry.inMonth,
                selected: toDateKey(entry.date) === selectedDateKey,
                today: isToday(entry.date),
              }"
              @click="selectedDate = entry.date"
            >
              <span class="day-number">{{ entry.date.getDate() }}</span>
              <span v-if="hasEvents(entry.date)" class="dot"></span>
            </button>
          </div>

          <div class="agenda-card">
            <div class="agenda-header">
              <h4>{{ t('calendar.scheduleFor') }}</h4>
              <span>{{
                selectedDate.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
              }}</span>
            </div>

            <div v-if="selectedEvents.length === 0" class="agenda-empty">
              {{ t('calendar.noEvents') }}
            </div>

            <ul v-else class="agenda-list">
              <li v-for="event in selectedEvents" :key="event.id">
                <span class="event-dot" :style="{ background: event.color }"></span>
                <div class="event-text">
                  <strong>{{ event.title }}</strong>
                  <small>{{ t(`calendar.eventTypes.${event.event_type}`) }}</small>
                  <small>{{ timeRange(event) }}</small>
                </div>
                <div class="event-actions">
                  <button class="event-btn" @click="openEditForm(event)">
                    {{ t('calendar.edit') }}
                  </button>
                  <button class="event-btn danger" @click="removeEvent(event.id)">
                    {{ t('calendar.delete') }}
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </template>

      <template v-else-if="viewMode === 'week'">
        <div class="week-grid">
          <div class="week-day" v-for="day in weekDays" :key="toDateKey(day)">
            <button class="week-day-header" @click="selectedDate = day">
              <strong>{{ day.toLocaleDateString(locale, { weekday: 'short' }) }}</strong>
              <span :class="{ today: isToday(day) }">{{ day.getDate() }}</span>
            </button>
            <ul class="week-events">
              <li
                v-for="event in eventsOn(day)"
                :key="event.id"
                :style="{ borderLeftColor: event.color }"
              >
                <strong>{{ event.title }}</strong>
                <small>{{ t(`calendar.eventTypes.${event.event_type}`) }}</small>
                <small>{{ timeRange(event) }}</small>
                <div class="event-actions">
                  <button class="event-btn" @click="openEditForm(event)">
                    {{ t('calendar.edit') }}
                  </button>
                  <button class="event-btn danger" @click="removeEvent(event.id)">
                    {{ t('calendar.delete') }}
                  </button>
                </div>
              </li>
              <li v-if="eventsOn(day).length === 0" class="empty-day">
                {{ t('calendar.noEvents') }}
              </li>
            </ul>
          </div>
        </div>
      </template>

      <template v-else-if="viewMode === 'day'">
        <div class="day-view">
          <div class="day-view-header">
            {{
              referenceDate.toLocaleDateString(locale, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })
            }}
          </div>
          <div class="day-hours">
            <div class="hour-row" v-for="hour in hours" :key="hour">
              <span>{{ hour }}</span>
            </div>
          </div>
          <div class="day-events">
            <div
              v-for="event in eventsOn(referenceDate)"
              :key="event.id"
              class="day-event"
              :style="{ borderLeftColor: event.color }"
            >
              <strong>{{ event.title }}</strong>
              <small>{{ t(`calendar.eventTypes.${event.event_type}`) }}</small>
              <small>{{ timeRange(event) }}</small>
              <div class="event-actions">
                <button class="event-btn" @click="openEditForm(event)">
                  {{ t('calendar.edit') }}
                </button>
                <button class="event-btn danger" @click="removeEvent(event.id)">
                  {{ t('calendar.delete') }}
                </button>
              </div>
            </div>
            <div v-if="eventsOn(referenceDate).length === 0" class="agenda-empty">
              {{ t('calendar.noEvents') }}
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="agenda-card agenda-full">
          <div class="agenda-header">
            <h4>{{ t('calendar.agendaTitle') }}</h4>
            <span>{{ t('calendar.nextTwoWeeks') }}</span>
          </div>
          <ul v-if="agendaEvents.length" class="agenda-list">
            <li v-for="event in agendaEvents" :key="event.id">
              <span class="event-dot" :style="{ background: event.color }"></span>
              <div class="event-text">
                <strong>{{ event.title }}</strong>
                <small>
                  {{
                    new Date(event.starts_at).toLocaleDateString(locale, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })
                  }}
                  - {{ t(`calendar.eventTypes.${event.event_type}`) }} - {{ timeRange(event) }}
                </small>
              </div>
              <div class="event-actions">
                <button class="event-btn" @click="openEditForm(event)">
                  {{ t('calendar.edit') }}
                </button>
                <button class="event-btn danger" @click="removeEvent(event.id)">
                  {{ t('calendar.delete') }}
                </button>
              </div>
            </li>
          </ul>
          <div v-else class="agenda-empty">{{ t('calendar.noUpcomingEvents') }}</div>
        </div>
      </template>

      <div v-if="showForm" class="event-form">
        <h4>{{ editingEventId ? t('calendar.editEvent') : t('calendar.createEvent') }}</h4>
        <div class="form-grid">
          <label>
            <span>{{ t('calendar.form.title') }}</span>
            <input v-model="form.title" type="text" />
          </label>
          <label>
            <span>{{ t('calendar.form.type') }}</span>
            <select v-model="form.eventType">
              <option v-for="type in eventTypeOptions" :key="type" :value="type">
                {{ t(`calendar.eventTypes.${type}`) }}
              </option>
            </select>
          </label>
          <label>
            <span>{{ t('calendar.form.start') }}</span>
            <input v-model="form.startsAt" type="datetime-local" />
          </label>
          <label>
            <span>{{ t('calendar.form.end') }}</span>
            <input v-model="form.endsAt" type="datetime-local" />
          </label>
          <label>
            <span>{{ t('calendar.form.color') }}</span>
            <input v-model="form.color" type="color" />
          </label>
          <label>
            <span>{{ t('calendar.form.location') }}</span>
            <input v-model="form.location" type="text" />
          </label>
          <label class="full-width">
            <span>{{ t('calendar.form.description') }}</span>
            <textarea v-model="form.description" rows="3"></textarea>
          </label>
        </div>
        <div class="form-actions">
          <button class="event-btn" @click="closeForm">{{ t('calendar.cancel') }}</button>
          <button class="create-btn" @click="submitForm">{{ t('calendar.save') }}</button>
        </div>
      </div>
    </div>
  </BasePanel>
</template>

<style scoped>
.calendar-panel {
  grid-column: 1 / -1;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 0 12px 14px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.calendar-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
  text-transform: capitalize;
}

.calendar-header p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.create-btn {
  border: 1px solid var(--accent-primary);
  background: var(--accent-glow);
  color: var(--text-primary);
  height: 32px;
  border-radius: var(--radius-md);
  cursor: pointer;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
}

.view-toggle {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: var(--surface-1);
}

.view-btn {
  border: none;
  background: transparent;
  color: var(--text-muted);
  height: 28px;
  padding: 0 10px;
  border-radius: calc(var(--radius-md) - 2px);
  font-size: 12px;
  cursor: pointer;
}

.view-btn.active {
  background: var(--surface-2);
  color: var(--text-primary);
}

.nav-btn,
.today-btn {
  border: 1px solid var(--glass-border);
  background: var(--surface-1);
  color: var(--text-secondary);
  height: 32px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.nav-btn {
  width: 32px;
  display: grid;
  place-items: center;
}

.today-btn {
  padding: 0 12px;
  font-size: 12px;
  font-weight: 600;
}

.nav-btn:hover,
.today-btn:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.calendar-content.month-layout {
  display: grid;
  gap: 12px;
  align-items: start;
  grid-template-columns: minmax(0, 1fr);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

.weekday {
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
}

.day-cell {
  min-height: 84px;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: var(--surface-1);
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  padding: 8px;
  cursor: pointer;
}

.day-cell:hover {
  border-color: var(--glass-border);
}

.day-cell.muted {
  opacity: 0.45;
}

.day-cell.selected {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent-primary) 35%, transparent);
  background: var(--accent-glow);
}

.day-cell.today .day-number,
.week-day-header .today {
  color: var(--accent-primary);
  font-weight: 700;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent-primary);
}

.agenda-card,
.week-grid,
.day-view {
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 12px;
  background: var(--surface-1);
}

.agenda-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.agenda-header h4 {
  margin: 0;
  font-size: 13px;
  color: var(--text-primary);
}

.agenda-header span,
.agenda-empty,
.empty-day {
  font-size: 12px;
  color: var(--text-muted);
}

.agenda-list,
.week-events {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.agenda-list li,
.week-events li,
.day-event {
  display: flex;
  align-items: center;
  gap: 8px;
}

.week-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.week-day {
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 8px;
  background: color-mix(in srgb, var(--surface-1) 85%, transparent);
}

.week-day-header {
  border: none;
  background: transparent;
  color: var(--text-primary);
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 0 0 8px;
  cursor: pointer;
}

.week-events li,
.day-event {
  border-left: 3px solid var(--accent-primary);
  padding-left: 8px;
  align-items: flex-start;
  flex-direction: column;
}

.day-view {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  gap: 12px;
}

.day-view-header {
  grid-column: 1 / -1;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.day-hours {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hour-row {
  height: 34px;
  display: flex;
  align-items: center;
  font-size: 11px;
  color: var(--text-muted);
}

.day-events {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.event-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.event-text {
  display: flex;
  flex-direction: column;
}

.event-text strong {
  font-size: 12px;
  color: var(--text-primary);
  line-height: 1.2;
}

.event-text small {
  font-size: 11px;
  color: var(--text-muted);
}

.event-actions {
  margin-left: auto;
  display: inline-flex;
  gap: 6px;
}

.event-btn {
  border: 1px solid var(--glass-border);
  background: var(--surface-2);
  color: var(--text-primary);
  font-size: 11px;
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  cursor: pointer;
}

.event-btn.danger {
  border-color: rgba(239, 68, 68, 0.5);
  color: #ef4444;
}

.agenda-full {
  min-height: 360px;
}

.event-form {
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  background: var(--surface-1);
  padding: 12px;
}

.event-form h4 {
  margin: 0 0 10px;
  font-size: 14px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.form-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-grid label span {
  font-size: 11px;
  color: var(--text-muted);
}

.form-grid input,
.form-grid select,
.form-grid textarea {
  border: 1px solid var(--glass-border);
  background: var(--surface-2);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  padding: 8px;
  font-size: 12px;
}

.form-grid .full-width {
  grid-column: 1 / -1;
}

.form-actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (min-width: 980px) {
  .calendar-content.month-layout {
    grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
  }
}
</style>
