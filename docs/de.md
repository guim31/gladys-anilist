# AniList

Die nächsten Folgen der Anime deiner [AniList](https://anilist.co)-Liste in Gladys: ein Kalender pro
Person, ein Dashboard-Widget und Szenen-Auslöser. AniList ist kostenlos; eine öffentliche Liste zu
lesen braucht weder ein Konto auf Seiten von Gladys noch einen API-Schlüssel.

Diese Integration ist nicht mit AniList verbunden. Getestet wurde sie mit der echten AniList-API und
dem Test-Double von Gladys, noch nicht auf einer echten Gladys-Instanz: Rückmeldungen sind im
Forum oder auf GitHub willkommen.

## Was du bekommst

- **Einen Kalender „Anime“ pro Person**, im Kalender von Gladys: jede Folge der Anime, die du auf
  AniList schaust (und, wenn du willst, schauen willst), von zwei Wochen zurück bis drei Monate
  voraus, mit ihrer Nummer (Folge 7/12). Die Uhrzeit ist die der Ausstrahlung in Japan, umgerechnet in
  die Zeitzone von Gladys (23:00 in Tokio erscheint um 15:00 in Berlin); jede Folge dauert ihre echte
  Länge und verlinkt auf ihre AniList-Seite.
- **Ein Dashboard-Widget**, „Nächste Folgen“: die kommenden Folgen, dann der Stand jedes Anime
  (nächste Folge in 3 Tagen, pausiert, noch nicht gesendet).
- **Zwei Szenen-Auslöser**: ein verfolgter Anime zeigt heute eine Folge (morgens oder zur Sendezeit),
  und eine neue Folge wird für einen Anime angekündigt, der keine hatte (erster Sendetermin, Rückkehr
  nach einer Pause).
- **Eine Szenen-Aktion**, „Nächste Folge lesen“: die nächste Folge eines Anime, die verbleibenden Tage
  und sein Status.

Die Kalenderansicht, der Dashboard-Kalender und der eingebaute Auslöser „Ein Kalenderereignis steht
bevor“ von Gladys funktionieren mit diesen Kalendern ebenfalls, sobald sie geteilt sind.

## Konfiguration

**Jede Person** aktiviert die Integration auf ihrer Seite unter „Meine Kalender“ und füllt aus:

- **AniList-Benutzername**: dein Name auf AniList (`Josh`) oder die Adresse deines Profils
  (`https://anilist.co/user/Josh/`). Deine Liste muss **öffentlich** sein: Ein privates Profil lässt
  sich ohne Anmeldung nicht lesen, und die Integration meldet sich nicht an.
- **Verfolgte Anime**: „Am Schauen“, „Am Schauen und geplant“ (Standard) oder „Geplant“. Beendete
  Anime kosten nichts: Nur laufende, bald startende oder gerade beendete werden gelesen.
- **Sprache der Titel**: Romaji (`Sousou no Frieren`, Standard), Englisch (`Frieren: Beyond Journey's
End`) oder Japanisch (`葬送のフリーレン`). Fehlt ein Titel in dieser Sprache, wird ein anderer
  verwendet.

Die Beschreibung deines Kalenders nennt die gelesene Liste, wie viele Anime sie enthält, welche gerade
laufen und welche noch keinen Termin haben, oder warum nichts gelesen wurde (unbekannte Person, private
Liste).

Der Kalender ist zuerst **privat**. **Teile** ihn (der Schalter unter „Meine Kalender“), um ihn im
Dashboard zu sehen und in Szenen zu nutzen: Wie bei jedem Kalender von Gladys erreichen nur geteilte
Kalender die Szenen, und ein geteilter Kalender ist für den ganzen Haushalt sichtbar.

Die **Administratorin oder der Administrator** wählt die Sprache der Daten und Status, die an die
Szenen gehen. Name und Beschreibung der Kalender folgen der Sprache jeder Person.

## Aktionen

Auf der Seite der Integration, für die Administration:

- **Prüfen**: liest AniList jetzt für alle Personen neu und sagt, wie viele Anime gelesen wurden und
  wie viele eine datierte nächste Folge haben.

## Szenen

**Auslöser „Folge heute“**: ein verfolgter Anime (eines geteilten Kalenders) zeigt heute eine Folge.
Der Filter **Wann** wählt den Moment: **morgens** (9:00) oder **zur Sendezeit**. Der Filter **Anime**
nimmt den genauen Titel, wie er im Kalender steht; leer, alle Anime. Variablen: Anime, Nummer der
Folge, Anzahl der Folgen (0, wenn unbekannt), Datum und Uhrzeit, Sendezeit, AniList-Seite und die
Personen, die den Anime verfolgen.

**Auslöser „Neue Folge angekündigt“**: ein verfolgter Anime ohne nächste Folge bekommt eine: erster
Sendetermin eines noch nicht gestarteten Anime, Rückkehr nach einer Pause. Ein Woche für Woche
datierter Anime wird nicht bei jeder Folge angekündigt. Gleiche Variablen, dazu die verbleibenden Tage.

**Aktion „Nächste Folge lesen“**: die nächste Folge eines Anime (einer seiner Titel oder dessen Anfang;
leer: die nächste aller Anime), mit `found` (1 oder 0), Folge, Anzahl der Folgen, Datum, Uhrzeit,
`days_left` (-1 ohne Termin), Status und zuletzt gesendeter Folge.

**Beispiele**:

- _Den Haushalt am Tag einer Folge informieren_: Auslöser „Folge heute“, Wann „Morgens“, dann die
  Gladys-Aktion „Nachricht senden“ an die gewählten Personen, mit einem Text aus den Variablen Anime,
  Nummer der Folge und Sendezeit aus der Liste. Nichts wird gesendet, solange du keine solche Szene
  anlegst.
- _Erfahren, wann die nächste Staffel datiert ist_: Auslöser „Neue Folge angekündigt“, dann eine
  Nachricht mit den Variablen Anime und Datum.
- _Wöchentliche Erinnerung_: eine geplante Szene am Sonntagabend, die Aktion „Nächste Folge lesen“,
  dann eine Nachricht mit ihren Ausgaben Anime und Datum.

## Dashboard

Füge das Widget **Nächste Folgen** einem Dashboard hinzu. Einstellungen: die anzuzeigenden Anime
(genaue Titel; leer, alle geteilten Anime), der Zeitraum (7, 14 oder 31 Tage) und ob der Stand jedes
Anime angezeigt wird.

## Grenzen

- **Daten**: der Sendeplan von AniList, also die **Ausstrahlung in Japan**. Ein Simulcast auf einer
  Plattform (Crunchyroll, Netflix) kann eine Stunde oder einige Tage später kommen; eine Synchronfassung
  viel später.
- **Aktualisierung**: alle 3 Stunden und wenn eine Person ihr Konto ändert. AniList erlaubt 30 Anfragen
  pro Minute: Die Integration verteilt ihre Anfragen (höchstens eine alle 2 Sekunden), liest jede Liste
  nur einmal und fragt die Folgen aller Personen zusammen ab.
- AniList datiert die meisten Anime einige Wochen im Voraus. Ein für „Oktober 2027“ angekündigter Anime
  hat keine Folge im Kalender, bis AniList ihn datiert: Die Kalenderbeschreibung führt ihn unter „Noch
  ohne Termin“.
- Der Kalender zeigt drei Monate voraus: Ein ein Jahr im Voraus datierter Anime (Crayon Shin-chan)
  füllt ihn nicht mit 50 Folgen. Höchstens 500 Folgen pro Kalender.
- Private Listen werden nicht unterstützt (keine Anmeldung bei AniList).

## Fehlerbehebung

- **Der Kalender bleibt leer**: Lies seine Beschreibung (Kalenderseite von Gladys). „Kein
  AniList-Benutzer…“: Der Name ist falsch; „privat“: Mach dein Profil in den AniList-Einstellungen
  öffentlich.
- **Ein Anime fehlt**: Prüfe seinen Status in deiner AniList-Liste (Am Schauen oder Geplant) und die
  Einstellung „Verfolgte Anime“. Ein beendeter Anime hat keine kommende Folge.
- **Keine Szene startet**: Der Kalender muss geteilt sein, und der Anime-Filter muss der genaue Titel
  aus dem Kalender sein.
- **„AniList nicht erreichbar“**: Die Integration behält die bekannten Folgen und versucht es erneut,
  nach einer Minute, dann immer seltener. Logs: Seite der Integration, Reiter Logs (`LOG_LEVEL=debug`
  für mehr Details).

## Danksagung

Die Daten der Anime und ihrer Ausstrahlung stammen aus der [AniList-API](https://docs.anilist.co),
genutzt gemäß ihren Nutzungsbedingungen (kostenlos, nicht kommerziell). Jede Kalender- und
Ereignisbeschreibung nennt AniList.
