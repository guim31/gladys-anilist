// -----------------------------------------------------------------------------
// Dashboard widget "Upcoming episodes": the coming airings of the shared
// calendars, then where each followed anime stands (next episode in N days,
// on hiatus, no date). Shared calendars only: a dashboard is seen by the
// whole household.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { TEXT, formatWhen, pick, relativeDay } from './i18n.js';
import { daysUntil, episodeOf, fold } from './anime.js';
import { animeStatus, matchesAnime } from './scenes.js';

export const ANIME_WIDGET = 'upcoming_episodes';
export const WIDGET_DAYS = ['7', '14', '31'];
const MAX_ITEMS = 8;
const MAX_ROWS = 10;

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** The titles of the `anime` setting. */
export function parseAnimeFilter(setting) {
  return String(setting ?? '')
    .split(/[,;\n]/)
    .filter((title) => fold(title));
}

/**
 * The widget content.
 * @param {import('./syncer.js').Syncer} syncer
 * @param {{ settings?: object, language?: string, now: number }} request
 */
export function animeContent(syncer, { settings = {}, language = 'en', now }) {
  const text = pick(TEXT, language);
  if (!syncer.ready) {
    return {
      ttl_seconds: 30,
      components: [{ type: 'text', variant: 'caption', text: text.loading }],
    };
  }
  const wanted = parseAnimeFilter(settings.anime);
  const entries = syncer
    .sharedAnime()
    .filter((entry) => wanted.length === 0 || wanted.some((title) => matchesAnime(entry, title)));
  if (entries.length === 0) {
    return {
      ttl_seconds: 300,
      components: [{ type: 'text', variant: 'body', text: text.noShared }],
    };
  }

  const components = [];
  const days = Number(WIDGET_DAYS.includes(String(settings.days)) ? settings.days : '14');
  const items = entries
    .flatMap((entry) =>
      entry.airings
        .filter((airing) => airing.end > now && daysUntil(airing, now) < days)
        .map((airing) => ({ entry, airing })),
    )
    .sort((a, b) => a.airing.start - b.airing.start)
    .slice(0, MAX_ITEMS);
  if (items.length === 0) {
    components.push({ type: 'text', variant: 'caption', text: text.nothing });
  } else {
    components.push({
      type: 'card-list',
      display: 'list',
      items: items.map(({ entry, airing }) => {
        const left = daysUntil(airing, now);
        return {
          title: truncate(entry.title, 60),
          subtitle: truncate(
            `${text.episode(episodeOf(airing, entry.anime))} · ${formatWhen(airing, language)}`,
            60,
          ),
          ...(left <= 1
            ? {
                badge: {
                  text: relativeDay(left, language),
                  color: left <= 0 ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.INFO,
                },
              }
            : {}),
        };
      }),
    });
  }

  // Finished anime of a planning list say nothing worth a row.
  const rows = entries
    .map((entry) => animeStatus(entry, language, now))
    .filter((status) => !['finished', 'cancelled'].includes(status.statusCode));
  if (settings.show_status !== false && rows.length > 0) {
    components.push({
      type: 'status',
      items: rows
        .sort((a, b) => (a.next?.start ?? Infinity) - (b.next?.start ?? Infinity))
        .slice(0, MAX_ROWS)
        .map((status) => ({
          label: truncate(status.anime, 40),
          value: truncate(
            status.next ? relativeDay(status.days_left, language) : status.status,
            40,
          ),
          icon: status.next ? 'calendar' : 'clock',
          color: status.next
            ? status.days_left <= 1
              ? WIDGET_COLORS.SUCCESS
              : WIDGET_COLORS.INFO
            : WIDGET_COLORS.NEUTRAL,
        })),
    });
  }
  return { ttl_seconds: 900, components };
}
