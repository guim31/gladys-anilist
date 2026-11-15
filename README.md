# AniList for Gladys Assistant

The upcoming episodes of the anime you follow on [AniList](https://anilist.co) in
[Gladys Assistant](https://gladysassistant.com). Every member of the household types their AniList user
name (a public list: no sign-in, no key); the episodes of the anime they watch or plan to watch fill an
"Anime" calendar, the dashboard and the scenes, at the local time of the broadcast in Japan.

This is an **external integration** of type `calendar` (Gladys 5.2.0 or later): it runs in its own
sandboxed container and pushes calendars and events into the core calendar store, per user. It reads
`graphql.anilist.co` (`transports: cloud`).

> Developed without a real Gladys instance: tested against the real AniList API (a public list with
> anime airing, an unknown user, an empty list, an anime without a date), with the SDK's fake Gladys,
> and in its Docker image under the Gladys sandbox constraints. Feedback welcome on the Gladys forum or
> in the issues.

## Features

- **Per user**: every member enables the integration in **My calendars** and types their AniList user
  name or profile address, the statuses followed (watching, planning, or both) and the language of the
  titles (romaji, English, Japanese).
- **An "Anime" calendar**: every airing from two weeks back to three months ahead, with its episode
  number (Episode 7/12), at the local time of the broadcast in Japan, linked to its AniList page. The
  calendar description says which anime are airing and which have no date yet, or why the list could
  not be read (unknown user, private list).
- **Scene triggers**: "Episode today" (in the morning or at the air time, filter by anime) and "New
  episode announced" (an anime without a next episode gets one: a first date, a return from a hiatus).
- **Scene action** "Read the next episode": next episode, days left, status, last episode aired.
- **Dashboard widget** "Upcoming episodes": the coming episodes, then where each anime stands.
- **Administrator action** "Check": read AniList again now.
- Four languages (English, French, German, Spanish): the calendars follow the language of their owner.

## Requirements

- Gladys Assistant **5.2.0 or later** (calendar integrations).
- Internet access to `graphql.anilist.co`.
- A **public** AniList list (private profiles need a sign-in this integration does not do).

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-anilist`.
2. Each user opens **Integrations → AniList**, types their AniList user name in **My calendars** and
   clicks **Enable**.
3. Share the calendar in the list under the form to see it on the dashboard and use it in scenes.

The user documentation, in [English](docs/en.md), [French](docs/fr.md), [German](docs/de.md) and
[Spanish](docs/es.md), details every field, trigger and example.

## Limits

- Air times are those of the broadcast in Japan (converted to the time zone of Gladys); a simulcast on a
  streaming platform can come later.
- Refreshed every 3 hours and when an account changes; AniList's limit of 30 requests a minute is
  respected (requests spaced by 2.1 s, each list read once, the airings of all users asked together,
  finished anime never asked for).
- Three months ahead at most, 500 episodes per calendar. An anime not dated yet appears only in the
  calendar description until AniList dates it.
- Scenes and the widget only see **shared** calendars, like the calendar scenes of Gladys.
- An "Episode today" moment that passes while the integration is stopped fires no scene.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

The tests replay real AniList answers recorded on 15 November 2026 (`test/fixtures`, user name
anonymized) against the SDK's fake Gladys (`@gladysassistant/integration-sdk/testing`), in the
`Europe/Paris` time zone, with an injectable clock: they never touch the network. See
[`CLAUDE.md`](CLAUDE.md) for the architecture and the rules of the repository. Releases go through
**Actions → Release**, which bumps the version, rolls [`CHANGELOG.md`](CHANGELOG.md) and builds the
multi-arch image on `ghcr.io`.

## Credits

- Anime and airing data from the [AniList API](https://docs.anilist.co), used under its terms of use
  (free, non-commercial). The AniList logo on the cover belongs to AniList.
- Built on the official [Gladys integration template](https://github.com/GladysAssistant/integration-template-js)
  and [`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js) (Apache-2.0).
- Requested in Pierre-Gilles' list of integrations to bring to the Gladys store (AniList, upcoming
  episodes).

Not affiliated with AniList.

## License

[Apache-2.0](LICENSE)
