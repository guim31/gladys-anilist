// -----------------------------------------------------------------------------
// AniList (https://docs.anilist.co): a public GraphQL API, no key nor account
// to read a public list. Its limit is 90 requests per minute, lowered to 30
// since 2024 (the `X-RateLimit-Limit` header says 30): the client spaces its
// calls by 2.1 s (28 per minute at most) and, on a 429, waits `Retry-After`
// and tries again. The answers are cached by the catalog (src/catalog.js):
// a list is read again every few hours.
// -----------------------------------------------------------------------------

export const API_URL = 'https://graphql.anilist.co';
const REQUEST_TIMEOUT_MS = 20_000;
export const MIN_SPACING_MS = 2_100;
const RETRY_429_MS = 60_000;
const MAX_429_RETRIES = 2;
// Airing schedules per page (AniList's maximum) and pages read at most.
const PAGE_SIZE = 50;
const MAX_PAGES = 20;
// Anime ids per schedule query: a bounded `mediaId_in`.
const IDS_PER_QUERY = 50;
const USER_AGENT = 'gladys-anilist (+https://github.com/guim31/gladys-anilist)';

/** AniList's list statuses, as the account setting chooses them. */
export const LIST_STATUSES = {
  current: ['CURRENT'],
  current_planning: ['CURRENT', 'PLANNING'],
  planning: ['PLANNING'],
};

const MEDIA_FIELDS = `
  id siteUrl status format episodes duration
  title { romaji english native }
  startDate { year month day }
  endDate { year month day }
  nextAiringEpisode { id airingAt episode }
`;

export const LIST_QUERY = `query ($user: String, $status: [MediaListStatus]) {
  MediaListCollection(userName: $user, type: ANIME, status_in: $status) {
    user { id name }
    lists { status entries { status progress media { ${MEDIA_FIELDS} } } }
  }
}`;

export const SCHEDULE_QUERY = `query ($ids: [Int], $from: Int, $to: Int, $page: Int) {
  Page(page: $page, perPage: ${PAGE_SIZE}) {
    pageInfo { hasNextPage }
    airingSchedules(mediaId_in: $ids, airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
      id airingAt episode mediaId
    }
  }
}`;

export class AniListError extends Error {
  /**
   * @param {string} message
   * @param {number} [status] HTTP or GraphQL status
   * @param {'not_found' | 'private'} [reason]
   */
  constructor(message, status, reason) {
    super(message);
    this.name = 'AniListError';
    this.status = status;
    this.reason = reason;
  }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {object} [options]
 * @param {Function} [options.fetch] the global fetch by default (tests inject one)
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {() => number} [options.now]
 */
export function createAniList({
  fetch = globalThis.fetch,
  sleep = defaultSleep,
  now = Date.now,
} = {}) {
  let last = -Infinity;
  // One call at a time: the spacing holds even when two users sync at once.
  let queue = Promise.resolve();

  async function call(query, variables) {
    for (let attempt = 0; ; attempt += 1) {
      const wait = last + MIN_SPACING_MS - now();
      if (wait > 0) {
        await sleep(wait);
      }
      last = now();
      let response;
      try {
        response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'user-agent': USER_AGENT,
          },
          body: JSON.stringify({ query, variables }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (err) {
        throw new AniListError(`AniList unreachable: ${err?.message ?? err}`);
      }
      if (response.status === 429 && attempt < MAX_429_RETRIES) {
        const after = Number(response.headers?.get?.('retry-after'));
        await sleep(after > 0 && after <= 120 ? after * 1000 : RETRY_429_MS);
        continue;
      }
      let body = null;
      try {
        body = await response.json();
      } catch {
        // An HTML error page (Cloudflare, maintenance): the status says it.
      }
      // GraphQL errors come with an HTTP status (404 for an unknown user).
      const [error] = Array.isArray(body?.errors) ? body.errors : [];
      if (error) {
        const status = Number(error.status) || response.status;
        const message = String(error.message ?? 'error');
        if (/private/i.test(message)) {
          throw new AniListError('AniList: private list', status, 'private');
        }
        if (status === 404) {
          throw new AniListError(`AniList: ${message}`, 404, 'not_found');
        }
        const reason = status === 429 ? ' (rate limited)' : '';
        throw new AniListError(`AniList answered HTTP ${status}${reason}`, status);
      }
      if (!response.ok || !body?.data) {
        const reason = response.status === 429 ? ' (rate limited)' : '';
        throw new AniListError(
          `AniList answered HTTP ${response.status}${reason}`,
          response.status,
        );
      }
      return body.data;
    }
  }

  /** A GraphQL query: its `data`, or an AniListError. */
  function query(text, variables) {
    const run = queue.then(
      () => call(text, variables),
      () => call(text, variables),
    );
    queue = run.catch(() => {});
    return run;
  }

  return {
    query,
    /**
     * The anime of a public list, by status.
     * @param {string} userName
     * @param {string[]} statuses AniList `MediaListStatus` values
     * @returns {Promise<{ user: { id: number, name: string }, entries: object[] }>}
     *   throws an AniListError with `reason` `not_found` or `private`
     */
    async list(userName, statuses) {
      const data = await query(LIST_QUERY, { user: userName, status: statuses });
      const collection = data?.MediaListCollection;
      if (!collection?.user) {
        throw new AniListError('AniList: User not found', 404, 'not_found');
      }
      const entries = (collection.lists ?? []).flatMap((list) =>
        (list?.entries ?? []).filter((entry) => entry?.media?.id),
      );
      return { user: collection.user, entries };
    },
    /**
     * The airing schedules of some anime between two times, by time.
     * @param {number[]} ids AniList media ids
     * @param {number} from timestamp (ms), exclusive
     * @param {number} to timestamp (ms), exclusive
     * @returns {Promise<{ id: number, airingAt: number, episode: number, mediaId: number }[]>}
     */
    async schedules(ids, from, to) {
      const all = [];
      for (let start = 0; start < ids.length; start += IDS_PER_QUERY) {
        const chunk = ids.slice(start, start + IDS_PER_QUERY);
        for (let page = 1; page <= MAX_PAGES; page += 1) {
          const data = await query(SCHEDULE_QUERY, {
            ids: chunk,
            from: Math.floor(from / 1000),
            to: Math.ceil(to / 1000),
            page,
          });
          const result = data?.Page;
          all.push(...(result?.airingSchedules ?? []).filter((entry) => entry?.id));
          if (!result?.pageInfo?.hasNextPage) {
            break;
          }
        }
      }
      return all;
    },
  };
}
