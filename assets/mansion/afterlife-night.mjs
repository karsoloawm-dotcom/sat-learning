const KEY = "kwd:afterlifeNight";
const VERSION = 1;

function initial() {
  return {version:VERSION, started:false, surname:false, register:false, house:false, witness:false,
    service:false, form:"body", deaths:0, tugWon:false, ending:null};
}

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (raw?.version !== VERSION || raw.started !== true) return initial();
    const surname = raw.surname === true;
    const house = surname && raw.house === true;
    const witness = house && raw.witness === true;
    const deaths = Number.isInteger(raw.deaths) ? Math.max(0, Math.min(5, raw.deaths)) : 0;
    const ending = deaths === 5 ? "lost" : witness && ["release","seal"].includes(raw.ending) ? raw.ending : null;
    return {...initial(), started:true, surname, register:surname&&(raw.register===true||house),house,witness,deaths,ending,
      service:raw.service === true, form:!ending && raw.form === "doll" ? "doll" : "body",
      tugWon:deaths === 4 && raw.tugWon === true};
  } catch {
    return initial();
  }
}

export function createAfterlifeNight() {
  let state = load();
  function save(changes) {
    state = {...state,...changes};
    try { localStorage.setItem(KEY,JSON.stringify(state)); } catch {}
  }
  function recordDeath(form) {
    const deaths = Math.min(5,state.deaths+1);
    save({deaths, form:deaths === 5 ? "body" : form, ending:deaths === 5 ? "lost" : null});
    return deaths;
  }
  return {get state(){return state;}, save, recordDeath,
    restart(){save({...initial(),started:true});},
    get active(){return state.started&&!state.ending;}};
}
