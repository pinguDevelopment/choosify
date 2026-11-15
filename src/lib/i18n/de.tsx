// Deutsche Texte der Oberfläche. Jede andere Sprache muss dieselben Schlüssel haben (siehe en.tsx).
import type { ReactNode } from "react";

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const de = {
  meta: {
    description: "Gemeinsam schnell einen Film finden",
    round: "Runde",
    tv: "Fernseher",
    abspann: "Abspann",
    account: "Konto",
    signIn: "Anmelden",
    rate: "Film bewerten",
  },
  common: {
    loading: "Lade …",
    loadingRound: "Lade Runde …",
    yourName: "Dein Name",
    namePlaceholder: "z.B. Lena",
    shareLink: "Link teilen",
    linkCopied: "Link kopiert",
    copied: "Kopiert ✓",
    toHome: "Zur Startseite",
    startRound: "Runde starten",
    newRound: "Neue Runde",
    account: "Konto",
    abspann: "Abspann",
    tv: "Fernseher",
    roomCode: (code: string) => `Raum-Code ${code}`,
    roomCodeLabel: "Raum-Code",
    qrJoin: (url: string) => `QR-Code zum Beitreten: ${url}`,
    rateTitle: (title: string) => `${title} bewerten`,
    rateButton: "★ Bewerten",
    error: (status: number) => `Fehler ${status}`,
    yearUnknown: "Jahr unbekannt",
  },
  language: {
    label: "Sprache",
  },
  home: {
    tagline: "Jeder wischt durch Filme, die bei euch laufen. Am Ende steht der eine, auf den alle Bock haben.",
    abspannLink: "Abspann: eure schon gesehenen Filme",
    accountLink: "Konto: Crews und Abspann auf allen Geräten",
    tvLink: "Fernseher: Runde auf dem großen Bildschirm, auch per Home Assistant",
  },
  create: {
    title: "Filmabend starten",
    signedInAs: (email: string) => `Angemeldet als ${email}`,
    creating: "Runde wird erstellt …",
    create: "Runde erstellen",
  },
  joinByCode: {
    title: "Eingeladen worden?",
    hint: "Scann den QR-Code beim Host oder tipp den Code von der Karte ab.",
    join: "Beitreten",
  },
  providers: {
    title: "Welche Dienste habt ihr?",
    hint: "Wir schlagen nur Filme vor, die dort gerade im Abo laufen. Nichts gewählt = alle bekannten.",
    loading: "Lade Anbieter …",
    searchPlaceholder: "Dienst suchen, z. B. Crunchyroll",
    searchLabel: "Dienst suchen",
    showLess: "Weniger anzeigen",
    showMore: (n: number) => `Mehr anzeigen (+${n})`,
    other: "Sonstige / eigene Quelle",
    /** Suchbegriffe, unter denen "Sonstige / eigene Quelle" gefunden wird */
    otherSearch: "Sonstige eigene Quelle",
    notFound: "Kein Dienst gefunden.",
    favHint: (everywhere: boolean) =>
      `Mit ☆ merkst du dir einen Dienst als Favorit. Favoriten stehen oben und sind beim nächsten Mal schon ausgewählt${everywhere ? ", auf allen deinen Geräten" : ""}.`,
    anySourceHint: "Es kommen auch Filme, die bei keinem gewählten Dienst im Abo laufen, z. B. für eure eigene Sammlung oder zum Leihen.",
    favOnlyLocal: "Favorit ist nur auf diesem Gerät gespeichert, das Konto war gerade nicht erreichbar.",
    favLabel: (name: string) => `${name} als Favorit`,
    favRemove: "Favorit entfernen",
    favAdd: "Als Favorit merken",
  },
  stars: {
    labels: ["", "Schwach", "Ging so", "Okay", "Gut", "Großartig"],
    ofFive: (v: string) => `${v} von 5 Sternen`,
    none: "noch keine Sterne",
    group: "Sterne",
    count: (n: number) => `${n} ${plural(n, "Stern", "Sterne")}`,
  },
  confirm: {
    incompleteTitle: "Link unvollständig",
    incompleteText: "Öffne den Link aus der Mail nochmal komplett oder tipp den Code aus der Mail ein.",
    toLogin: "Zur Anmeldung",
    title: "Fast geschafft",
    text: "Tipp auf den Knopf, um dich auf diesem Gerät anzumelden.",
    busy: "Melde an …",
    button: "Jetzt anmelden",
    newLink: "Neuen Link anfordern",
  },
  genres: {
    title: "Worauf hast du Bock?",
    hint: "Wähl so viele Genres, wie du willst. Gar keins heißt: mir egal.",
    next: (n: number) => `Weiter mit ${n} ${plural(n, "Genre", "Genres")}`,
    any: "Mir ist alles recht",
  },
  join: {
    over: "Diese Runde ist schon vorbei.",
    title: "Rein in die Runde",
    hint: "Unter welchem Namen sehen dich die anderen?",
    busy: "Trete bei …",
    button: "Beitreten",
  },
  lobby: {
    invite: "Freunde reinholen",
    inviteHint: (n: number) => `${n} im Saal · QR scannen lassen`,
    scanAll: "Alle mal scannen",
    showOnTv: "Auf dem Fernseher zeigen",
    inRoom: (n: number) => `${n} im Saal`,
    readyCount: (n: number) => `${n} bereit`,
    host: "Host",
    ready: "bereit",
    choosing: "wählt noch",
    searching: "Filme werden gesucht …",
    start: "Swipen starten",
    startAnyway: "Du kannst auch starten, wenn noch nicht alle bereit sind.",
    waiting: "Warte, bis der Host startet …",
  },
  room: {
    expired: "Runden laufen nach 24 Stunden ab. Prüf den Code oder lass dir einen neuen Link schicken.",
  },
  results: {
    nobody: "Noch hat niemand Ja oder Wäre ok gesagt.",
    allLove: "alle ♥",
    allIn: "alle dabei",
    likes: (n: number) => `${n} ♥`,
    likesMaybes: (likes: number, maybes: number) => `${likes} ♥ · ${maybes} ok`,
    maybesNos: (maybes: number, nos: number) => `${maybes} ok${nos ? ` · ${nos} ✕` : ""}`,
    tonight: "Heute läuft",
    everyone: "Alle haben Bock.",
    allInText: (likes: number, maybes: number) => `Alle sind dabei: ${likes} haben Bock, ${maybes} fänden es ok.`,
    partial: (likes: number, total: number, maybes: number) => `${likes} von ${total} haben Bock, ${maybes} fänden es ok.`,
    runoffByRating: (votes: number) =>
      `Stichwahl unentschieden (${votes} ${plural(votes, "Stimme", "Stimmen")}), die bessere TMDB-Bewertung hat entschieden.`,
    runoffWon: (votes: number, total: number) => `In der Stichwahl gewonnen: ${votes} von ${total} Stimmen.`,
    trailer: "Trailer suchen",
    trailerQuery: (title: string, year: number | null) => `${title} ${year ?? ""} Trailer deutsch`,
    noMatchTitle: "Kein Treffer",
    noMatchText: "Niemand hat Ja oder Wäre ok gesagt. Startet eine neue Runde mit anderen Genres oder mehr Diensten.",
    ranking: "Rangliste",
    newRound: "Neue Runde starten",
    afterFilm: "Nach dem Film",
    howWasIt: "Wie war’s?",
    rateHint: "Gebt dem Film 1 bis 5 Sterne. Daraus lernt Cinemood, was eurer Crew gefällt, und schlägt beim nächsten Mal Passenderes vor.",
  },
  runoff: {
    tie: "Gleichstand!",
    title: "Stichwahl",
    hint: (n: number) => `${n} Filme liegen gleichauf. Tipp genau einen an. Wenn alle gewählt haben, steht der Gewinner fest.`,
    choose: (title: string) => `${title} wählen`,
    myPick: "Meine Wahl",
    progress: (votes: number, total: number) => `${votes} von ${total} haben gewählt`,
    secret: "Der Zwischenstand bleibt geheim, bis alle durch sind.",
    end: "Stichwahl jetzt beenden",
  },
  intro: {
    steps: [
      {
        title: "Rechts Bock, links Nö",
        text: (
          <>
            Wisch die Karte nach <b className="text-yes">rechts</b>, wenn du den Film sehen willst, nach <b className="text-no">links</b>, wenn nicht. Die
            Knöpfe unten gehen genauso.
          </>
        ) as ReactNode,
      },
      {
        title: "Nach oben: Wäre ok",
        text: (
          <>
            Nicht dein Favorit, aber du würdest mitgucken? Wisch nach <b className="text-accent">oben</b>. So findet ihr schneller einen Film, mit dem alle
            leben können.
          </>
        ) as ReactNode,
      },
      {
        title: "Verwischt? Zurück!",
        text: (
          <>
            Mit <b className="text-text">↺ Zurück</b> holst du die letzte Karte wieder. Am Laptop gehen auch die Pfeiltasten, die Rücktaste nimmt zurück.
          </>
        ) as ReactNode,
      },
    ],
    stepOf: (i: number, n: number) => `Kurz erklärt · ${i} von ${n}`,
    skip: "Überspringen",
    hints: "Hinweise",
    hint: (i: number, title: string) => `Hinweis ${i}: ${title}`,
    go: "Los geht’s",
    next: "Weiter",
  },
  swipe: {
    stampYes: "Bock",
    stampNo: "Nö",
    stampMaybe: "Wär ok",
    showIntro: "Kurze Einführung anzeigen",
    howItWorks: "Wie funktioniert’s?",
    back: "Zurück",
    undo: "Rückgängig",
    no: "Nein",
    maybe: "Wäre ok",
    yes: "Ja",
    hintMobile: "Wischen: ← Nein · ↑ Wäre ok · → Ja",
    hintDesktop: "Am Laptop: ← Nein, ↑ Wäre ok, → Ja. Rücktaste nimmt zurück.",
    doneTitle: "Du bist durch!",
    doneText: "Sobald die anderen fertig sind, steht der Gewinner fest. Der Zwischenstand läuft live mit.",
    progress: "Wer ist wie weit?",
    toAbspann: "Gewinner danach in den Abspann (schon gesehen)",
    finishTie: (n: number) => `Abstimmung beenden, dann Stichwahl (${n} Filme)`,
    finish: (title: string | null) => `Abstimmung beenden${title ? `: ${title}` : ""}`,
    tieHint: (n: number) => `${n} Filme liegen gleichauf. Danach wählt jede Person genau einen davon, damit nur einer gewinnt.`,
    genre: "Genre: ",
    tags: "Tags",
    runtime: (min: number) => {
      const h = Math.floor(min / 60);
      const m = min % 60;
      return h ? `${h} Std.${m ? ` ${m} Min.` : ""}` : `${m} Min.`;
    },
  },
  abspann: {
    title: "Abspann",
    intro: "Was eure Crew schon gesehen hat. Diese Filme schlagen wir euch nicht mehr vor.",
    noCrewTitle: "Noch keine Crew",
    noCrewText: "Deine Crew entsteht, sobald du als Host die erste Runde startest. Danach landen eure Filme hier.",
    otherDevice: (link: ReactNode) => (
      <>
        Eure Crew gibt es schon auf einem anderen Gerät? {link}, dann ist sie hier auch da.
      </>
    ),
    signInLink: "Melde dich an",
    add: "Film eintragen",
    searchPlaceholder: "Titel suchen …",
    already: "schon drin",
    addButton: "Eintragen",
    empty: "Noch leer. Nach eurem ersten Filmabend steht hier der Gewinner.",
    deleteRating: (name: string) => `Bewertung von ${name} löschen`,
    noRatings: "Noch niemand hat bewertet. Schickt den Link in eure Gruppe.",
    remove: (title: string) => `${title} entfernen`,
    removeButton: "Aus dem Abspann entfernen",
    taste: "Euer Geschmack",
    moreOf: "Mehr davon",
    rather: "Eher nicht",
    learned: (n: number) => `Gelernt aus ${n} ${plural(n, "bewertetem Film", "bewerteten Filmen")}. Passende Filme schlagen wir öfter vor.`,
    unclear: "Noch kein klares Bild. Bewertet ein paar Filme mehr, dann lernt Cinemood, was euch gefällt.",
    rateMore: "Bewertet eure Filme mit Sternen, dann lernt Cinemood, was euch gefällt, und schlägt Passenderes vor.",
  },
  account: {
    title: "Konto",
    intro:
      "Freiwillig und nur für Hosts: Mit Konto sind eure Crews, der Abspann und deine Lieblingsdienste auf jedem Gerät da. Gäste brauchen weiterhin nur ihren Namen.",
    signIn: "Anmelden",
    noPassword: "Ohne Passwort: Wir schicken dir einen Link und einen Code per Mail.",
    email: "E-Mail-Adresse",
    emailPlaceholder: "du@beispiel.de",
    sending: "Schicke Mail …",
    send: "Anmelde-Link schicken",
    checkInbox: "Schau in dein Postfach",
    sent: (email: ReactNode) => (
      <>
        Wir haben eine Mail an {email} geschickt. Tipp auf den Link oder gib hier den Code aus der Mail ein. Der Code ist
        praktisch, wenn die Mail auf einem anderen Gerät ankommt.
      </>
    ),
    code: "Code aus der Mail",
    checking: "Prüfe …",
    otherAddress: "Andere Adresse",
    resend: "Nochmal schicken",
    spam: "Keine Mail da? Schau auch im Spam-Ordner nach.",
    signedInAs: "Angemeldet als",
    adoptTitle: "Crew von diesem Gerät übernehmen?",
    adoptText: (name: ReactNode) => (
      <>
        Auf diesem Gerät gibt es die Crew {name}. Übernimm sie in dein Konto, dann sind sie und ihr Abspann auf all deinen
        Geräten da.
      </>
    ),
    quote: (name: string) => `„${name}“`,
    adopt: "Ins Konto übernehmen",
    crews: "Deine Crews",
    noCrews: "Noch keine. Deine Crew entsteht, sobald du die erste Runde startest.",
    activeHint: "Neue Runden und der Abspann nutzen die ausgewählte Crew.",
    activeCrew: "Aktive Crew",
    active: "aktiv",
    signOut: "Abmelden",
    signOutAll: "Auf allen Geräten abmelden",
  },
  tvSetup: {
    title: "Fernseher",
    intro:
      "Ein fester Link für euren Fernseher: Öffnet ihn dort im Browser, und schon steht eine neue Runde mit großem QR-Code bereit. Home Assistant kann den Link automatisch öffnen, es geht aber genauso von Hand.",
    noCrewTitle: "Erst eine Runde starten",
    noCrewText:
      "Der Fernseher gehört zu einer Crew. Auf diesem Gerät gibt es noch keine. Starte einmal eine Runde (oder melde dich im Konto an), danach kannst du hier den Fernseher einrichten.",
    crew: (name: string) => `Crew: ${name}`,
    providersTitle: "Welche Dienste zählen am Fernseher?",
    providersHint: "Gilt für Runden, die über den Fernseher-Link oder Home Assistant starten. Nichts gewählt = alle bekannten.",
    saving: "Speichert …",
    saved: "Gespeichert ✓",
    save: "Dienste speichern",
    setup: "Fernseher einrichten",
    linkTitle: "Euer Fernseher-Link",
    linkHint: "Wer diesen Link hat, kann für eure Crew eine Runde öffnen. Behandelt ihn wie einen Schlüssel und teilt ihn nicht öffentlich.",
    linkLabel: "Fernseher-Link",
    copy: "Link kopieren",
    open: "Jetzt öffnen",
    haTitle: "So geht’s mit Home Assistant",
    haSteps: [
      "Fernseher in Home Assistant einbinden (z. B. LG webOS, Android TV, Fire TV oder Samsung).",
      "Ein Skript „Starte Cinemood“ anlegen: Fernseher einschalten, kurz warten, dann diesen Link im Browser des Fernsehers öffnen.",
      "Das Skript per Sprachbefehl, Knopf oder Automation starten. Der Fernseher zeigt dann sofort den QR-Code.",
    ],
    haNote:
      "Wird der Link nochmal geöffnet, solange die Runde läuft, zeigt er dieselbe Runde. Ist sie vorbei, startet eine neue. Wer zuerst beitritt, leitet die Runde.",
    regenerate: "Neuen Link erzeugen (der alte geht dann nicht mehr)",
    disable: "Fernseher-Link ausschalten",
  },
  tv: {
    scan: "Handy raus und scannen",
    hostLeads: (name: string) => `${name} leitet die Runde und startet das Swipen, wenn alle da sind.`,
    firstLeads: "Wer zuerst beitritt, leitet die Runde.",
    nobody: "Noch niemand im Saal",
    inRoom: (n: number) => `${n} im Saal`,
    ready: "bereit",
    runoff: (n: number) => `Stichwahl zwischen ${n} Filmen`,
    swiping: "Es wird geswipt …",
    runoffHint: "Gleichstand an der Spitze. Jetzt auf dem Handy einen der Filme wählen.",
    lateJoin: (url: string) => `Wer noch mitmachen will: Link öffnen, ${url}`,
    tonight: "Heute läuft",
    noWinner: "Kein Gewinner",
    creating: "Neue Runde wird erstellt …",
    missingTitle: "Hier fehlt der Fernseher-Link",
    missingText: (link: ReactNode) => <>Den Link für euren Fernseher gibt es auf der Seite {link}.</>,
    failed: "Das hat nicht geklappt",
    retry: "Nochmal versuchen",
    preparing: "Runde wird vorbereitet …",
  },
  rate: {
    newLink: "Frag in deiner Crew nach einem neuen Link.",
    howWas: "Wie war",
    abspannOf: (crew: string) => `Abspann von ${crew}`,
    saving: "Speichere …",
    change: "Bewertung ändern",
    give: "Sterne vergeben",
    first: "Du bist die erste Person. ",
    already: (n: number) => `${n} ${plural(n, "hat", "haben")} schon bewertet. `,
    othersAfter: "Die Sterne der anderen siehst du nach deiner Bewertung.",
    average: "Schnitt der Crew",
    edit: "Ändern",
    you: " (du)",
    thanks: "Danke! Aus euren Sternen lernt Cinemood, was eurer Crew gefällt.",
    others: "Andere bewerten lassen",
    hideQr: "QR ausblenden",
    showQr: "QR-Code zeigen",
    qrAlt: "QR-Code zum Bewerten",
  },
};

export type Messages = typeof de;
