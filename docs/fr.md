# AniList

Les prochains épisodes des animes de votre liste [AniList](https://anilist.co) dans Gladys : un
calendrier par utilisateur, un widget de tableau de bord et des déclencheurs de scène. AniList est
gratuit ; lire une liste publique ne demande ni compte côté Gladys ni clé d'API.

Cette intégration n'est pas affiliée à AniList. Elle a été testée contre la vraie API d'AniList et la
doublure de test de Gladys, pas encore sur une vraie instance Gladys : vos retours sont les bienvenus
sur le forum ou sur GitHub.

## Ce que vous obtenez

- **Un calendrier « Animes » par utilisateur**, dans le calendrier de Gladys : chaque épisode des
  animes que vous regardez (et, si vous le souhaitez, que vous prévoyez de regarder) sur AniList, de
  deux semaines en arrière à trois mois en avant, avec son numéro (Épisode 7/12). L'heure est celle de
  la diffusion au Japon, convertie dans le fuseau de Gladys (23 h à Tokyo s'affiche à 15 h à Paris) ;
  chaque épisode dure sa durée réelle et renvoie à sa page AniList.
- **Un widget de tableau de bord**, « Prochains épisodes » : les épisodes à venir, puis où en est
  chaque anime (prochain épisode dans 3 jours, en pause, pas encore diffusé).
- **Deux déclencheurs de scène** : un anime suivi diffuse un épisode aujourd'hui (le matin ou à l'heure
  de diffusion), et un nouvel épisode est annoncé pour un anime qui n'en avait pas (première date de
  diffusion, retour de pause).
- **Une action de scène**, « Lire le prochain épisode » : le prochain épisode d'un anime, les jours
  restants et son statut.

La vue calendrier, le calendrier du tableau de bord et le déclencheur « un événement de calendrier
arrive » de Gladys fonctionnent aussi avec ces calendriers une fois partagés.

## Configuration

**Chaque utilisateur** active l'intégration sur sa page, dans « Mes calendriers », et renseigne :

- **Nom d'utilisateur AniList** : votre nom sur AniList (`Josh`), ou l'adresse de votre profil
  (`https://anilist.co/user/Josh/`). Votre liste doit être **publique** : un profil privé ne se lit pas
  sans connexion, et l'intégration ne se connecte pas.
- **Animes suivis** : « En cours », « En cours et prévus » (par défaut) ou « Prévus ». Les animes
  terminés ne coûtent rien : seuls ceux en diffusion, sur le point de l'être ou tout juste finis sont
  lus.
- **Langue des titres** : romaji (`Sousou no Frieren`, par défaut), anglais (`Frieren: Beyond Journey's
End`) ou japonais (`葬送のフリーレン`). Un titre absent dans cette langue est remplacé par un autre.

La description de votre calendrier dit quelle liste a été lue, combien d'animes elle compte, lesquels
sont en diffusion et lesquels n'ont pas encore de date, ou pourquoi rien n'a été lu (utilisateur
inconnu, liste privée).

Le calendrier est d'abord **privé**. **Partagez-le** (l'interrupteur de « Mes calendriers ») pour le
voir sur le tableau de bord et l'utiliser dans les scènes : comme tout calendrier de Gladys, seuls les
calendriers partagés atteignent les scènes, et un calendrier partagé est visible de tout le foyer.

L'**administrateur** choisit la langue des dates et des statuts transmis aux scènes. Le nom et la
description des calendriers suivent la langue de chaque utilisateur.

## Actions

Sur la page de l'intégration, pour l'administrateur :

- **Vérifier** : relit AniList maintenant pour tous les utilisateurs, et dit combien d'animes ont été
  lus et combien ont un prochain épisode daté.

## Scènes

**Déclencheur « Épisode aujourd'hui »** : un anime suivi (d'un calendrier partagé) diffuse un épisode
aujourd'hui. Le filtre **Quand** choisit le moment : **le matin** (9 h) ou **à l'heure de diffusion**.
Le filtre **Anime** prend le titre exact affiché dans le calendrier ; vide, tous les animes. Variables :
anime, numéro de l'épisode, nombre d'épisodes (0 s'il est inconnu), date et heure, heure de diffusion,
page AniList, et les utilisateurs qui suivent l'anime.

**Déclencheur « Nouvel épisode annoncé »** : un anime suivi qui n'avait pas de prochain épisode en
reçoit un : première date de diffusion d'un anime pas encore sorti, retour de pause. Un anime daté
semaine après semaine n'est pas annoncé à chaque épisode. Mêmes variables, plus les jours restants.

**Action « Lire le prochain épisode »** : le prochain épisode d'un anime (l'un de ses titres, ou son
début ; vide : le plus proche de tous), avec `found` (1 ou 0), épisode, nombre d'épisodes, date, heure,
`days_left` (-1 sans date), statut et dernier épisode diffusé.

**Exemples** :

- _Prévenir le foyer le jour d'un épisode_ : déclencheur « Épisode aujourd'hui », quand « Le matin »,
  puis l'action Gladys « Envoyer un message » aux utilisateurs choisis, avec un texte construit à
  partir des variables Anime, Numéro de l'épisode et Heure choisies dans la liste. Rien n'est envoyé
  tant que vous ne créez pas une telle scène.
- _Savoir quand la saison suivante est datée_ : déclencheur « Nouvel épisode annoncé », puis un
  message avec les variables Anime et Date.
- _Rappel hebdomadaire_ : une scène programmée le dimanche soir, l'action « Lire le prochain épisode »,
  puis un message avec ses sorties Anime et Date.

## Tableau de bord

Ajoutez le widget **Prochains épisodes** à un tableau de bord. Réglages : les animes à afficher (titres
exacts ; vide, tous les animes partagés), la période (7, 14 ou 31 jours) et l'affichage ou non de
l'état de chaque anime.

## Limites

- **Données** : le planning de diffusion d'AniList, c'est-à-dire la **diffusion au Japon**. Un
  simulcast sur une plateforme (Crunchyroll, ADN, Netflix) peut arriver une heure ou quelques jours plus
  tard ; une VF bien plus tard.
- **Rafraîchissement** : toutes les 3 heures, et quand un utilisateur modifie son compte. AniList
  accepte 30 requêtes par minute : l'intégration espace ses requêtes (une toutes les 2 secondes au
  plus), lit chaque liste une seule fois et demande les épisodes de tous les utilisateurs ensemble.
- AniList date la plupart des animes quelques semaines à l'avance. Un anime annoncé pour « octobre
  2027 » n'a aucun épisode dans le calendrier tant qu'AniList ne le date pas : la description du
  calendrier le range sous « Sans date ».
- Le calendrier montre trois mois en avant : un anime daté un an à l'avance (Crayon Shin-chan) ne le
  remplit pas de 50 épisodes. 500 épisodes au plus par calendrier.
- Les listes privées ne sont pas prises en charge (pas de connexion à AniList).

## Dépannage

- **Le calendrier reste vide** : lisez sa description (page Calendrier de Gladys). « Aucun utilisateur
  AniList… » : le nom est faux ; « privée » : rendez votre profil public dans les réglages d'AniList.
- **Un anime manque** : vérifiez son statut dans votre liste AniList (En cours ou Prévu) et le réglage
  « Animes suivis ». Un anime terminé n'a pas d'épisode à venir.
- **Aucune scène ne part** : le calendrier doit être partagé, et le filtre d'anime doit être le titre
  exact affiché dans le calendrier.
- **« AniList injoignable »** : l'intégration garde les épisodes connus et réessaie, au bout d'une
  minute puis de moins en moins souvent. Journaux : page de l'intégration, onglet Journaux
  (`LOG_LEVEL=debug` pour plus de détail).

## Crédits

Les données des animes et de leur diffusion viennent de l'[API d'AniList](https://docs.anilist.co),
utilisée selon ses conditions d'utilisation (gratuite, non commerciale). Chaque description de
calendrier et d'événement crédite AniList.
