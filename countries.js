// Countries the app knows. This is the only source of country codes: data file URLs and the country panel are
// built from these keys, never from user input. Read by the app and by tools/update-airports.mjs.
// live: data/countries/XX.json exists and the country can be picked. icao: ICAO prefixes of the country.
// LI, MC and AD have heliports only in OurAirports, no airfield, so they are not live (they stay for the neighbours).
// When two countries share a prefix the first one listed wins; the updater lists the others in index.json.
// Territories (JE, GG, IM on EG, FO on EK, GI) are listed under their own name like any country, after the country
// that owns their prefix, so they never take its codes.
const COUNTRIES={
  CZ:{cs:'Česko',en:'Czechia',r:'central',icao:['LK'],live:1},
  SK:{cs:'Slovensko',en:'Slovakia',r:'central',icao:['LZ'],live:1},
  AT:{cs:'Rakousko',en:'Austria',r:'central',icao:['LO'],live:1},
  DE:{cs:'Německo',en:'Germany',r:'central',icao:['ED','ET'],live:1},
  PL:{cs:'Polsko',en:'Poland',r:'central',icao:['EP'],live:1},
  HU:{cs:'Maďarsko',en:'Hungary',r:'central',icao:['LH'],live:1},
  SI:{cs:'Slovinsko',en:'Slovenia',r:'central',icao:['LJ'],live:1},
  CH:{cs:'Švýcarsko',en:'Switzerland',r:'central',icao:['LS'],live:1},
  LI:{cs:'Lichtenštejnsko',en:'Liechtenstein',r:'central',icao:['LS']},
  FR:{cs:'Francie',en:'France',r:'west',icao:['LF'],live:1},
  BE:{cs:'Belgie',en:'Belgium',r:'west',icao:['EB'],live:1},
  NL:{cs:'Nizozemsko',en:'Netherlands',r:'west',icao:['EH'],live:1},
  LU:{cs:'Lucembursko',en:'Luxembourg',r:'west',icao:['EL'],live:1},
  GB:{cs:'Spojené království',en:'United Kingdom',r:'west',icao:['EG'],live:1},
  IE:{cs:'Irsko',en:'Ireland',r:'west',icao:['EI'],live:1},
  MC:{cs:'Monako',en:'Monaco',r:'west',icao:['LN']},
  JE:{cs:'Jersey',en:'Jersey',r:'west',icao:['EG'],live:1},
  GG:{cs:'Guernsey',en:'Guernsey',r:'west',icao:['EG'],live:1},
  IM:{cs:'Ostrov Man',en:'Isle of Man',r:'west',icao:['EG'],live:1},
  IT:{cs:'Itálie',en:'Italy',r:'south',icao:['LI'],live:1},
  SM:{cs:'San Marino',en:'San Marino',r:'south',icao:['LI'],live:1},
  ES:{cs:'Španělsko',en:'Spain',r:'south',icao:['LE','GC','GE'],live:1},
  PT:{cs:'Portugalsko',en:'Portugal',r:'south',icao:['LP'],live:1},
  AD:{cs:'Andorra',en:'Andorra',r:'south',icao:['LE']},
  GI:{cs:'Gibraltar',en:'Gibraltar',r:'south',icao:['LX'],live:1},
  MT:{cs:'Malta',en:'Malta',r:'south',icao:['LM'],live:1},
  GR:{cs:'Řecko',en:'Greece',r:'south',icao:['LG'],live:1},
  CY:{cs:'Kypr',en:'Cyprus',r:'south',icao:['LC'],live:1},
  HR:{cs:'Chorvatsko',en:'Croatia',r:'south',icao:['LD'],live:1},
  DK:{cs:'Dánsko',en:'Denmark',r:'north',icao:['EK'],live:1},
  SE:{cs:'Švédsko',en:'Sweden',r:'north',icao:['ES'],live:1},
  NO:{cs:'Norsko',en:'Norway',r:'north',icao:['EN'],live:1},
  FI:{cs:'Finsko',en:'Finland',r:'north',icao:['EF'],live:1},
  IS:{cs:'Island',en:'Iceland',r:'north',icao:['BI'],live:1},
  FO:{cs:'Faerské ostrovy',en:'Faroe Islands',r:'north',icao:['EK'],live:1},
  EE:{cs:'Estonsko',en:'Estonia',r:'north',icao:['EE'],live:1},
  LV:{cs:'Lotyšsko',en:'Latvia',r:'north',icao:['EV'],live:1},
  LT:{cs:'Litva',en:'Lithuania',r:'north',icao:['EY'],live:1},
  RS:{cs:'Srbsko',en:'Serbia',r:'east',icao:['LY'],live:1},
  BA:{cs:'Bosna a Hercegovina',en:'Bosnia and Herzegovina',r:'east',icao:['LQ'],live:1},
  ME:{cs:'Černá Hora',en:'Montenegro',r:'east',icao:['LY'],live:1},
  MK:{cs:'Severní Makedonie',en:'North Macedonia',r:'east',icao:['LW'],live:1},
  AL:{cs:'Albánie',en:'Albania',r:'east',icao:['LA'],live:1},
  XK:{cs:'Kosovo',en:'Kosovo',r:'east',icao:['BK'],live:1},
  RO:{cs:'Rumunsko',en:'Romania',r:'east',icao:['LR'],live:1},
  BG:{cs:'Bulharsko',en:'Bulgaria',r:'east',icao:['LB'],live:1},
  MD:{cs:'Moldavsko',en:'Moldova',r:'east',icao:['LU'],live:1}
};
const COUNTRY_REGIONS=['central','west','south','north','east'];
// land neighbours within this list (a neighbour outside it, e.g. UA or TR, is left out)
const COUNTRY_NEIGHBOURS={
  CZ:['DE','AT','SK','PL'], SK:['CZ','AT','HU','PL'], AT:['DE','CZ','SK','HU','SI','IT','CH','LI'],
  DE:['DK','PL','CZ','AT','CH','FR','LU','BE','NL'], PL:['DE','CZ','SK','LT'], HU:['AT','SK','SI','HR','RS','RO'],
  SI:['AT','IT','HU','HR'], CH:['DE','FR','IT','AT','LI'], LI:['CH','AT'],
  FR:['BE','LU','DE','CH','IT','MC','ES','AD'], BE:['FR','LU','DE','NL'], NL:['DE','BE'], LU:['BE','DE','FR'],
  GB:['IE'], IE:['GB'], MC:['FR'], JE:[], GG:[], IM:[],
  IT:['FR','CH','AT','SI','SM'], SM:['IT'], ES:['FR','AD','PT','GI'], PT:['ES'], AD:['FR','ES'], GI:['ES'], MT:[],
  GR:['AL','MK','BG'], CY:[], HR:['SI','HU','RS','BA','ME'],
  DK:['DE'], SE:['NO','FI'], NO:['SE','FI'], FI:['SE','NO'], IS:[], FO:[], EE:['LV'], LV:['EE','LT'], LT:['LV','PL'],
  RS:['HU','RO','BG','MK','XK','ME','BA','HR'], BA:['HR','RS','ME'], ME:['HR','BA','RS','XK','AL'],
  MK:['RS','XK','AL','GR','BG'], AL:['ME','XK','MK','GR'], XK:['RS','ME','AL','MK'],
  RO:['HU','RS','BG','MD'], BG:['RO','RS','MK','GR'], MD:['RO']
};
// country of a foreign airfield code without loading its data: listed exception, "XX-" ident or ICAO prefix
function countryOfCode(code,exceptions){
  if(typeof code!=='string') return '';
  if(exceptions&&Object.prototype.hasOwnProperty.call(exceptions,code)&&Object.prototype.hasOwnProperty.call(COUNTRIES,exceptions[code])) return exceptions[code];
  const dash=/^([A-Z]{2})-/.exec(code);
  if(dash) return Object.prototype.hasOwnProperty.call(COUNTRIES,dash[1])?dash[1]:'';
  // ICAO codes and the longer national codes built on them (LKCDUB, ETT1)
  if(/^[A-Z]{2}[A-Z0-9]{2,4}$/.test(code)){ const p=code.slice(0,2); for(const c in COUNTRIES) if(COUNTRIES[c].icao.includes(p)) return c; }
  return '';
}
// language of the browser -> home country; only the language list, never the IP address or location.
// A region in the tag wins (de-AT, en-GB, fr-BE); "en" alone or en-US tells nothing.
const LANG_COUNTRY={cs:'CZ',sk:'SK',pl:'PL',de:'DE',hu:'HU',sl:'SI',hr:'HR',fr:'FR',it:'IT',nl:'NL',es:'ES',pt:'PT',el:'GR',
  da:'DK',sv:'SE',nb:'NO',nn:'NO',no:'NO',fi:'FI',is:'IS',et:'EE',lv:'LV',lt:'LT',sr:'RS',bs:'BA',mk:'MK',sq:'AL',ro:'RO',
  bg:'BG',mt:'MT',ga:'IE',lb:'LU'};
function guessHome(langs,allowed){
  for(const tag of (Array.isArray(langs)?langs:[])){
    if(typeof tag!=='string') continue;
    const [lng,...rest]=tag.split('-'), region=rest.find(x=>/^[A-Za-z]{2}$/.test(x));
    const byRegion=region&&region.toUpperCase(), byLang=LANG_COUNTRY[lng.toLowerCase()];
    if(byRegion&&allowed.includes(byRegion)) return byRegion;
    if(byLang&&allowed.includes(byLang)&&(!byRegion||!Object.prototype.hasOwnProperty.call(COUNTRIES,byRegion))) return byLang;
  }
  return '';
}
