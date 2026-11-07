// Countries the app knows. This is the only source of country codes: data file URLs and the country panel are
// built from these keys, never from user input. Read by the app and by tools/update-airports.mjs.
// live: data/countries/XX.json exists and the country can be picked. icao: ICAO prefixes of the country.
// When two countries share a prefix the first one listed wins; the updater lists the others in index.json.
const COUNTRIES={
  CZ:{cs:'Česko',en:'Czechia',r:'central',icao:['LK'],live:1},
  SK:{cs:'Slovensko',en:'Slovakia',r:'central',icao:['LZ'],live:1},
  AT:{cs:'Rakousko',en:'Austria',r:'central',icao:['LO'],live:1},
  DE:{cs:'Německo',en:'Germany',r:'central',icao:['ED','ET'],live:1},
  PL:{cs:'Polsko',en:'Poland',r:'central',icao:['EP'],live:1},
  HU:{cs:'Maďarsko',en:'Hungary',r:'central',icao:['LH']},
  SI:{cs:'Slovinsko',en:'Slovenia',r:'central',icao:['LJ']},
  CH:{cs:'Švýcarsko',en:'Switzerland',r:'central',icao:['LS']},
  LI:{cs:'Lichtenštejnsko',en:'Liechtenstein',r:'central',icao:['LS']},
  FR:{cs:'Francie',en:'France',r:'west',icao:['LF']},
  BE:{cs:'Belgie',en:'Belgium',r:'west',icao:['EB']},
  NL:{cs:'Nizozemsko',en:'Netherlands',r:'west',icao:['EH']},
  LU:{cs:'Lucembursko',en:'Luxembourg',r:'west',icao:['EL']},
  GB:{cs:'Spojené království',en:'United Kingdom',r:'west',icao:['EG']},
  IE:{cs:'Irsko',en:'Ireland',r:'west',icao:['EI']},
  MC:{cs:'Monako',en:'Monaco',r:'west',icao:['LN']},
  IT:{cs:'Itálie',en:'Italy',r:'south',icao:['LI']},
  SM:{cs:'San Marino',en:'San Marino',r:'south',icao:['LI']},
  ES:{cs:'Španělsko',en:'Spain',r:'south',icao:['LE','GC','GE']},
  PT:{cs:'Portugalsko',en:'Portugal',r:'south',icao:['LP']},
  AD:{cs:'Andorra',en:'Andorra',r:'south',icao:['LE']},
  MT:{cs:'Malta',en:'Malta',r:'south',icao:['LM']},
  GR:{cs:'Řecko',en:'Greece',r:'south',icao:['LG']},
  CY:{cs:'Kypr',en:'Cyprus',r:'south',icao:['LC']},
  HR:{cs:'Chorvatsko',en:'Croatia',r:'south',icao:['LD']},
  DK:{cs:'Dánsko',en:'Denmark',r:'north',icao:['EK']},
  SE:{cs:'Švédsko',en:'Sweden',r:'north',icao:['ES']},
  NO:{cs:'Norsko',en:'Norway',r:'north',icao:['EN']},
  FI:{cs:'Finsko',en:'Finland',r:'north',icao:['EF']},
  IS:{cs:'Island',en:'Iceland',r:'north',icao:['BI']},
  EE:{cs:'Estonsko',en:'Estonia',r:'north',icao:['EE']},
  LV:{cs:'Lotyšsko',en:'Latvia',r:'north',icao:['EV']},
  LT:{cs:'Litva',en:'Lithuania',r:'north',icao:['EY']},
  RS:{cs:'Srbsko',en:'Serbia',r:'east',icao:['LY']},
  BA:{cs:'Bosna a Hercegovina',en:'Bosnia and Herzegovina',r:'east',icao:['LQ']},
  ME:{cs:'Černá Hora',en:'Montenegro',r:'east',icao:['LY']},
  MK:{cs:'Severní Makedonie',en:'North Macedonia',r:'east',icao:['LW']},
  AL:{cs:'Albánie',en:'Albania',r:'east',icao:['LA']},
  XK:{cs:'Kosovo',en:'Kosovo',r:'east',icao:['BK']},
  RO:{cs:'Rumunsko',en:'Romania',r:'east',icao:['LR']},
  BG:{cs:'Bulharsko',en:'Bulgaria',r:'east',icao:['LB']},
  MD:{cs:'Moldavsko',en:'Moldova',r:'east',icao:['LU']}
};
const COUNTRY_REGIONS=['central','west','south','north','east'];
const COUNTRY_PICKS={near:['SK','AT','DE','PL'],alps:['AT','CH','DE','IT','SI','FR','LI'],adriatic:['SI','HR','IT','ME','AL']};
// country of a foreign airfield code without loading its data: listed exception, "XX-" ident or ICAO prefix
function countryOfCode(code,exceptions){
  if(typeof code!=='string') return '';
  if(exceptions&&Object.prototype.hasOwnProperty.call(exceptions,code)&&Object.prototype.hasOwnProperty.call(COUNTRIES,exceptions[code])) return exceptions[code];
  const dash=/^([A-Z]{2})-/.exec(code);
  if(dash) return Object.prototype.hasOwnProperty.call(COUNTRIES,dash[1])?dash[1]:'';
  if(/^[A-Z]{4}$/.test(code)){ const p=code.slice(0,2); for(const c in COUNTRIES) if(COUNTRIES[c].icao.includes(p)) return c; }
  return '';
}
