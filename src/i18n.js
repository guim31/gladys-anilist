// -----------------------------------------------------------------------------
// Texts produced by the container, in the four languages of the Gladys
// interface. The calendar name and description follow the language of the
// user who owns the calendar; scene texts follow the `language` setting (a
// scene action carries no user); the widget the language of the viewer.
// Anime titles come from AniList, in the language each user chose.
// -----------------------------------------------------------------------------

export const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

/** Labels of the anime statuses (src/anime.js STATUS_CODES). */
export const STATUS_TEXT = {
  en: {
    scheduled: 'Next episode dated',
    releasing: 'Airing, no date yet',
    not_yet_released: 'Not aired yet, no date',
    hiatus: 'On hiatus',
    finished: 'Finished',
    cancelled: 'Cancelled',
  },
  fr: {
    scheduled: 'Prochain épisode daté',
    releasing: 'En cours, sans date',
    not_yet_released: 'Pas encore diffusé, sans date',
    hiatus: 'En pause',
    finished: 'Terminé',
    cancelled: 'Annulé',
  },
  de: {
    scheduled: 'Nächste Folge datiert',
    releasing: 'Läuft, noch ohne Termin',
    not_yet_released: 'Noch nicht gesendet, ohne Termin',
    hiatus: 'Pausiert',
    finished: 'Beendet',
    cancelled: 'Abgesetzt',
  },
  es: {
    scheduled: 'Próximo episodio con fecha',
    releasing: 'En emisión, sin fecha',
    not_yet_released: 'Aún no emitido, sin fecha',
    hiatus: 'En pausa',
    finished: 'Finalizado',
    cancelled: 'Cancelado',
  },
};

/** The other texts. Functions take the value they show. */
export const TEXT = {
  en: {
    calendar: 'Anime',
    none: 'No AniList user name yet: type yours in the settings of your account.',
    notFound: (name) => `No AniList user named "${name}": check the name in your account.`,
    private: (name) =>
      `The list of "${name}" is private on AniList: make your profile public to see it here.`,
    unavailable: 'AniList unreachable, retried later.',
    summary: (name, count) => `AniList list of ${name}: ${count} anime followed.`,
    coming: 'Airing:',
    undated: 'No date yet:',
    truncated: (count) => `${count} later episode(s) left out (500 at most)`,
    credit: 'Data: AniList.co',
    episode: (number) => `Episode ${number}`,
    today: 'Today',
    tomorrow: 'Tomorrow',
    inDays: (count) => `In ${count} days`,
    loading: 'Reading AniList…',
    noShared: 'No shared anime calendar: share yours from the AniList integration page.',
    nothing: 'No episode in this period.',
    check: (anime, dated) => `AniList read: ${anime} anime, ${dated} with a dated next episode.`,
    checkFailed: 'AniList could not be read. Try again in a few minutes.',
  },
  fr: {
    calendar: 'Animes',
    none: "Pas encore de nom d'utilisateur AniList : saisissez le vôtre dans votre compte.",
    notFound: (name) =>
      `Aucun utilisateur AniList « ${name} » : vérifiez le nom dans votre compte.`,
    private: (name) =>
      `La liste de « ${name} » est privée sur AniList : rendez votre profil public pour la voir ici.`,
    unavailable: 'AniList injoignable, nouvel essai plus tard.',
    summary: (name, count) => `Liste AniList de ${name} : ${count} anime(s) suivi(s).`,
    coming: 'En diffusion :',
    undated: 'Sans date :',
    truncated: (count) => `${count} épisode(s) plus lointain(s) omis (500 au plus)`,
    credit: 'Données : AniList.co',
    episode: (number) => `Épisode ${number}`,
    today: "Aujourd'hui",
    tomorrow: 'Demain',
    inDays: (count) => `Dans ${count} jours`,
    loading: 'Lecture d’AniList…',
    noShared:
      "Aucun calendrier d'animes partagé : partagez le vôtre depuis la page de l'intégration AniList.",
    nothing: 'Aucun épisode sur cette période.',
    check: (anime, dated) =>
      `AniList lu : ${anime} anime(s), dont ${dated} avec un prochain épisode daté.`,
    checkFailed: 'AniList est illisible. Réessayez dans quelques minutes.',
  },
  de: {
    calendar: 'Anime',
    none: 'Noch kein AniList-Benutzername: Gib deinen in deinem Konto ein.',
    notFound: (name) => `Kein AniList-Benutzer „${name}“: Prüfe den Namen in deinem Konto.`,
    private: (name) =>
      `Die Liste von „${name}“ ist auf AniList privat: Mach dein Profil öffentlich, um sie hier zu sehen.`,
    unavailable: 'AniList nicht erreichbar, später neuer Versuch.',
    summary: (name, count) => `AniList-Liste von ${name}: ${count} verfolgte Anime.`,
    coming: 'Läuft gerade:',
    undated: 'Noch ohne Termin:',
    truncated: (count) => `${count} spätere Folge(n) weggelassen (höchstens 500)`,
    credit: 'Daten: AniList.co',
    episode: (number) => `Folge ${number}`,
    today: 'Heute',
    tomorrow: 'Morgen',
    inDays: (count) => `In ${count} Tagen`,
    loading: 'AniList wird gelesen…',
    noShared: 'Kein geteilter Anime-Kalender: Teile deinen auf der Seite der AniList-Integration.',
    nothing: 'Keine Folge in diesem Zeitraum.',
    check: (anime, dated) =>
      `AniList gelesen: ${anime} Anime, ${dated} mit datierter nächster Folge.`,
    checkFailed: 'AniList ist nicht lesbar. Versuche es in ein paar Minuten erneut.',
  },
  es: {
    calendar: 'Anime',
    none: 'Aún no hay nombre de usuario de AniList: escriba el suyo en su cuenta.',
    notFound: (name) =>
      `Ningún usuario de AniList llamado «${name}»: compruebe el nombre en su cuenta.`,
    private: (name) =>
      `La lista de «${name}» es privada en AniList: haga público su perfil para verla aquí.`,
    unavailable: 'AniList inaccesible, nuevo intento más tarde.',
    summary: (name, count) => `Lista de AniList de ${name}: ${count} anime seguido(s).`,
    coming: 'En emisión:',
    undated: 'Sin fecha:',
    truncated: (count) => `${count} episodio(s) posterior(es) omitido(s) (500 como máximo)`,
    credit: 'Datos: AniList.co',
    episode: (number) => `Episodio ${number}`,
    today: 'Hoy',
    tomorrow: 'Mañana',
    inDays: (count) => `Dentro de ${count} días`,
    loading: 'Leyendo AniList…',
    noShared:
      'Ningún calendario de anime compartido: comparta el suyo desde la página de la integración AniList.',
    nothing: 'Ningún episodio en este periodo.',
    check: (anime, dated) =>
      `AniList leído: ${anime} anime, ${dated} con el próximo episodio fechado.`,
    checkFailed: 'No se pudo leer AniList. Inténtelo de nuevo en unos minutos.',
  },
};

/** The table of a language, English when unknown. */
export const pick = (table, language) => table[language] ?? table.en;

/** Every language of a table entry, for an action message `{ en, fr, de, es }`. */
export function allLanguages(render) {
  return Object.fromEntries(Object.keys(TEXT).map((language) => [language, render(language)]));
}

/** `ven. 20 nov., 17:00`, local. */
export function formatWhen(airing, language) {
  return new Intl.DateTimeFormat(LOCALES[language] ?? LOCALES.en, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(airing.start));
}

/** `17:00`, local. */
export function formatTime(airing) {
  const date = new Date(airing.start);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Today, tomorrow, in N days. */
export function relativeDay(days, language) {
  const text = pick(TEXT, language);
  if (days <= 0) {
    return text.today;
  }
  return days === 1 ? text.tomorrow : text.inDays(days);
}
