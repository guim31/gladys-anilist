# AniList

Los próximos episodios de los anime de su lista de [AniList](https://anilist.co) en Gladys: un
calendario por usuario, un widget de panel y disparadores de escena. AniList es gratuito; leer una
lista pública no requiere cuenta del lado de Gladys ni clave de API.

Esta integración no está afiliada a AniList. Se probó con la API real de AniList y con el doble de
prueba de Gladys, todavía no en una instancia real de Gladys: sus comentarios son bienvenidos en el
foro o en GitHub.

## Qué obtiene

- **Un calendario «Anime» por usuario**, en el calendario de Gladys: cada episodio de los anime que
  usted ve (y, si lo desea, que tiene previsto ver) en AniList, desde dos semanas atrás hasta tres meses
  adelante, con su número (Episodio 7/12). La hora es la de la emisión en Japón, convertida a la zona
  horaria de Gladys (las 23:00 en Tokio aparecen a las 15:00 en Madrid); cada episodio dura su duración
  real y enlaza a su página de AniList.
- **Un widget de panel**, «Próximos episodios»: los próximos episodios y la situación de cada anime
  (próximo episodio dentro de 3 días, en pausa, aún no emitido).
- **Dos disparadores de escena**: un anime seguido emite un episodio hoy (por la mañana o a su hora de
  emisión), y se anuncia un nuevo episodio para un anime que no tenía (primera fecha de emisión,
  regreso tras una pausa).
- **Una acción de escena**, «Leer el próximo episodio»: el próximo episodio de un anime, los días
  restantes y su estado.

La vista de calendario, el calendario del panel y el disparador integrado «un evento de calendario se
acerca» de Gladys también funcionan con estos calendarios una vez compartidos.

## Configuración

**Cada usuario** activa la integración en su página, en «Mis calendarios», y rellena:

- **Nombre de usuario de AniList**: su nombre en AniList (`Josh`), o la dirección de su perfil
  (`https://anilist.co/user/Josh/`). Su lista debe ser **pública**: un perfil privado no se puede leer
  sin iniciar sesión, y la integración no inicia sesión.
- **Anime seguidos**: «Viendo», «Viendo y previstos» (por defecto) o «Previstos». Los anime terminados
  no cuestan nada: solo se leen los que están en emisión, a punto de emitirse o recién terminados.
- **Idioma de los títulos**: romaji (`Sousou no Frieren`, por defecto), inglés (`Frieren: Beyond
Journey's End`) o japonés (`葬送のフリーレン`). Si falta un título en ese idioma, se usa otro.

La descripción de su calendario indica qué lista se leyó, cuántos anime contiene, cuáles están en
emisión y cuáles aún no tienen fecha, o por qué no se leyó nada (usuario desconocido, lista privada).

El calendario es **privado** al principio. **Compártalo** (el interruptor de «Mis calendarios») para
verlo en el panel y usarlo en las escenas: como cualquier calendario de Gladys, solo los calendarios
compartidos llegan a las escenas, y un calendario compartido es visible para todo el hogar.

El **administrador** elige el idioma de las fechas y estados enviados a las escenas. El nombre y la
descripción de los calendarios siguen el idioma de cada usuario.

## Acciones

En la página de la integración, para el administrador:

- **Comprobar**: vuelve a leer AniList ahora para todos los usuarios e indica cuántos anime se leyeron
  y cuántos tienen el próximo episodio fechado.

## Escenas

**Disparador «Episodio hoy»**: un anime seguido (de un calendario compartido) emite un episodio hoy. El
filtro **Cuándo** elige el momento: **por la mañana** (9:00) o **a la hora de emisión**. El filtro
**Anime** toma el título exacto que aparece en el calendario; vacío, todos los anime. Variables: anime,
número del episodio, número de episodios (0 si se desconoce), fecha y hora, hora de emisión, página de
AniList y los usuarios que siguen el anime.

**Disparador «Nuevo episodio anunciado»**: un anime seguido sin próximo episodio recibe uno: primera
fecha de emisión de un anime aún no estrenado, regreso tras una pausa. Un anime fechado semana a semana
no se anuncia en cada episodio. Las mismas variables, más los días restantes.

**Acción «Leer el próximo episodio»**: el próximo episodio de un anime (uno de sus títulos, o su
comienzo; vacío: el más próximo de todos), con `found` (1 o 0), episodio, número de episodios, fecha,
hora, `days_left` (-1 sin fecha), estado y último episodio emitido.

**Ejemplos**:

- _Avisar al hogar el día de un episodio_: disparador «Episodio hoy», cuándo «Por la mañana», y luego
  la acción de Gladys «Enviar un mensaje» a los usuarios que elija, con un texto construido con las
  variables Anime, Número del episodio y Hora elegidas en la lista. No se envía nada mientras usted no
  cree una escena así.
- _Saber cuándo se fecha la siguiente temporada_: disparador «Nuevo episodio anunciado», y luego un
  mensaje con las variables Anime y Fecha.
- _Recordatorio semanal_: una escena programada el domingo por la noche, la acción «Leer el próximo
  episodio» y luego un mensaje con sus salidas Anime y Fecha.

## Panel

Añada el widget **Próximos episodios** a un panel. Ajustes: los anime que mostrar (títulos exactos;
vacío, todos los anime compartidos), el periodo (7, 14 o 31 días) y si se muestra la situación de cada
anime.

## Límites

- **Datos**: el calendario de emisión de AniList, es decir, la **emisión en Japón**. Un simulcast en
  una plataforma (Crunchyroll, Netflix) puede llegar una hora o unos días después; un doblaje, mucho
  más tarde.
- **Actualización**: cada 3 horas y cuando un usuario modifica su cuenta. AniList admite 30 peticiones
  por minuto: la integración espacia sus peticiones (una cada 2 segundos como máximo), lee cada lista
  una sola vez y pide los episodios de todos los usuarios juntos.
- AniList fecha la mayoría de los anime con unas semanas de antelación. Un anime anunciado para
  «octubre de 2027» no tiene episodios en el calendario hasta que AniList lo feche: la descripción del
  calendario lo incluye en «Sin fecha».
- El calendario muestra tres meses adelante: un anime fechado con un año de antelación (Crayon
  Shin-chan) no lo llena con 50 episodios. Como máximo 500 episodios por calendario.
- Las listas privadas no son compatibles (sin inicio de sesión en AniList).

## Solución de problemas

- **El calendario sigue vacío**: lea su descripción (página Calendario de Gladys). «Ningún usuario de
  AniList…»: el nombre es incorrecto; «privada»: haga público su perfil en los ajustes de AniList.
- **Falta un anime**: compruebe su estado en su lista de AniList (Viendo o Previsto) y el ajuste «Anime
  seguidos». Un anime terminado no tiene próximos episodios.
- **No se dispara ninguna escena**: el calendario debe estar compartido y el filtro de anime debe ser
  el título exacto que aparece en el calendario.
- **«AniList inaccesible»**: la integración conserva los episodios conocidos y vuelve a intentarlo,
  tras un minuto y luego cada vez con menos frecuencia. Registros: página de la integración, pestaña
  Registros (`LOG_LEVEL=debug` para más detalle).

## Créditos

Los datos de los anime y de su emisión proceden de la [API de AniList](https://docs.anilist.co),
utilizada según sus condiciones de uso (gratuita, no comercial). Cada descripción de calendario y de
evento cita a AniList.
