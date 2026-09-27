const LATIN_GENRES = new Set([
  "latin", "latin pop", "reggaeton", "urbano", "latin urban", "latin trap",
  "salsa", "bachata", "merengue", "cumbia", "reggae en espanol",
  "latin hip hop", "latin rock", "latin alternative", "latin metal",
  "bossa nova", "mpb", "forró", "sertanejo", "pagode", "funk carioca",
  "funk", "axé", "brega", "forró eletrônico", "sertanejo universitário",
  "piseiro", "pisadinha", "forró pivoti",
  "spanish pop", "spanish rock", "spanish hip hop",
  "brazilian pop", "brazilian rock", "brazilian hip hop", "brazilian funk",
  "portuguese pop", "portuguese rock",
  "tropical", "tropipop", "vallenato", "grupero", "norteño", "banda",
  "corrido", "ranchera", "mariachi",
  "kizomba", "kuduro", "semba", "tarraxinha",
  "afrobeat", "afropop",
]);

const LATIN_KEYWORDS = [
  "reggaeton", "salsa", "bachata", "merengue", "cumbia",
  "forró", "sertanejo", "pagode", "funk", "brega", "axé",
  "vallenato", "grupero", "norteño", "banda", "corrido",
  "kizomba", "kuduro", "tropical",
];

export function isLatinGenre(genres: string[]): boolean {
  const normalized = genres.map((g) => g.toLowerCase().trim());
  for (const g of normalized) {
    if (LATIN_GENRES.has(g)) return true;
    for (const kw of LATIN_KEYWORDS) {
      if (g.includes(kw)) return true;
    }
  }
  return false;
}

const LATIN_ARTISTS = new Set([
  "bad bunny", "j balvin", "ozuna", "daddy yankee", "maluma",
  "karol g", "regina chapter", "nicky jam", "wisin", "yandel",
  "arcángel", "don omar", "luis fonsi", "sebastian yatra",
  "camilo", "feid", "rauw alejandro", "myke towers", "pablo alborán",
  "rosalía", "aitana", "lola indigo", "alvaro soler",
  "anitta", "pedro sampaio", "ludmilla", "anitta",
  "romeo santos", "romeo santos", "Prince Royce",
  "jorge blanco", "luis miguel",
  "manu chao", "calle 13", "canserbero",
  "wisin", "natti natasha", "becky g",
  "shakira", "enrique iglesias", "ricky martin",
  "josé josé", "juana la cubana",
  "marcos belo", "jorge vercillo", "jorge vercillo",
  "gusttavo lima", "joão gomes", "matuê",
  "luan santana", "zezé di camargo", "chitaozinho",
  "marilia mendonça", "ana castela", "bela fernandes",
  "pabllo vittar", "pocah", "dilsinho",
  "daniela mercury", "ivete sangalo", "carlinhos brown",
  "armandinho", "skank", "jota quest",
  "los hermanos", "legião urbana", "charlie brown jr",
  "titãs", "os параламас", "os paralamas do sucesso",
  "marisa monte", "daniela cristina", "donna carol",
  "frejat", "roberto carlos", "jorge ben jor",
  "caetano veloso", "gilberto gil", "tom jobim",
  "vinicius de morais", "toquinho",
  "david bowie", "enrique iglesias",
  "bad gyal", "la zowi", "ptazeta",
  "omar montes", "fendi el rey",
]);

export function isLatinArtist(artistName: string): boolean {
  return LATIN_ARTISTS.has(artistName.toLowerCase().trim());
}
