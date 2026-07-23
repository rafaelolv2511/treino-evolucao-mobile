import {
  weeklySeriesForExercise, personalRecordBefore, isNewRecord, overallEvolutionPct,
  evolutionPctInPeriod, stagnantExercises, suggestLoad, estimateCalories,
  calendarWeekSummary, evolutionForPlan, HistoryBundle,
} from "./src/lib/calc";


let ok = 0, fail = 0;
const t = (nome: string, cond: boolean, extra = "") => {
  if (cond) { ok++; console.log(`  OK   ${nome}${extra ? " — " + extra : ""}`); }
  else { fail++; console.log(`  FALHA ${nome}${extra ? " — " + extra : ""}`); }
};

function mk(rows: {date:string; wk:number; key:string; done:boolean; ex:[string,string,number|null,number|null][]}[]): HistoryBundle {
  const h: HistoryBundle = { sessions: [], logs: [], sets: [] } as any;
  rows.forEach((r,i)=>{
    const sid=`s${i}`;
    h.sessions.push({id:sid,workout_date:r.date,week_number:r.wk,session_key:r.key,
      completed_at:r.done?`${r.date}T20:00:00Z`:null,duration_seconds:3600,calories_estimate:400} as any);
    r.ex.forEach(([id,g,load,reps],j)=>{
      const lid=`${sid}-${j}`;
      h.logs.push({id:lid,workout_session_id:sid,exercise_id:id,exercise_name_snapshot:id,primary_muscle_group_snapshot:g} as any);
      if(load!==null) for(let k=0;k<3;k++)
        h.sets.push({id:`${lid}-${k}`,exercise_log_id:lid,set_number:k+1,load_kg:load,reps_done:reps,rir_done:2,carried_forward:false} as any);
    });
  });
  return h;
}

console.log("\n1) CARGA HERDADA (não conta como evolução nem recorde)");
const herda = mk([
  {date:"2026-07-01",wk:1,key:"A",done:true,ex:[["supino","Peito",50,10]]},
  {date:"2026-07-08",wk:2,key:"A",done:true,ex:[["supino","Peito",null,null]]},
  {date:"2026-07-15",wk:3,key:"A",done:true,ex:[["supino","Peito",55,10]]},
]);
const pts = weeklySeriesForExercise("supino", herda);
t("semana 2 marcada como herdada", pts[1].inherited === true);
t("herdada repete a carga anterior", pts[1].loadKg === 50);
t("evolução usa só cargas reais (50→55 = 10%)", Math.round(overallEvolutionPct(["supino"],herda)!) === 10);

console.log("\n2) RECORDE PESSOAL (primeira carga nunca é PR)");
const rec = mk([
  {date:"2026-07-01",wk:1,key:"A",done:true,ex:[["supino","Peito",50,10]]},
  {date:"2026-07-08",wk:2,key:"A",done:true,ex:[["supino","Peito",60,8]]},
]);
t("PR antes da 1ª sessão = null", personalRecordBefore("supino", "s0", rec) === null);
t("PR antes da 2ª sessão = 50", personalRecordBefore("supino", "s1", rec) === 50);
t("60kg é novo recorde", isNewRecord(60, 50) === true);
t("50kg não é recorde", isNewRecord(50, 50) === false);
t("primeira carga nunca é recorde", isNewRecord(50, null) === false);

// weekNumberFrom vive em db.ts (que instancia o Supabase); replico a fórmula
// exata do arquivo para testar a regra sem subir o cliente.
const weekNumberFrom = (first: string, date: string) =>
  Math.floor((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${first}T12:00:00Z`)) / 86400000 / 7) + 1;
console.log("\n3) SEMANA DO PLANO (S1 = primeira data, blocos de 7 dias)");
t("S1 no dia 1", weekNumberFrom("2026-07-01","2026-07-01") === 1);
t("S1 no dia 7", weekNumberFrom("2026-07-01","2026-07-07") === 1);
t("S2 no dia 8", weekNumberFrom("2026-07-01","2026-07-08") === 2);
t("S3 no dia 15", weekNumberFrom("2026-07-01","2026-07-15") === 3);

console.log("\n4) SEMANA DE CALENDÁRIO (segunda→domingo, 1 check-in/dia)");
const cal = mk([
  {date:"2026-07-20",wk:2,key:"A",done:true,ex:[["a","X",10,10]]},
  {date:"2026-07-21",wk:2,key:"B",done:true,ex:[["b","X",10,10]]},
  {date:"2026-07-21",wk:2,key:"C",done:true,ex:[["c","X",10,10]]},
  {date:"2026-07-22",wk:2,key:"A",done:true,ex:[["a","X",12,10]]},
  {date:"2026-07-19",wk:1,key:"A",done:true,ex:[["a","X",10,10]]},
]);
const cw = calendarWeekSummary("2026-07-22", cal.sessions);
t("3 dias distintos na semana (2 sessões no mesmo dia = 1)", cw.concluidosNaSemana === 3, `retornou ${cw.concluidosNaSemana}`);
t("domingo anterior fica fora da semana", cw.concluidosNaSemana === 3 && cw.inicioSemanaISO === "2026-07-20");

console.log("\n5) ESTAGNAÇÃO (3+ semanas sem subir)");
const est = mk([
  {date:"2026-07-01",wk:1,key:"A",done:true,ex:[["supino","Peito",50,10]]},
  {date:"2026-07-08",wk:2,key:"A",done:true,ex:[["supino","Peito",50,10]]},
  {date:"2026-07-15",wk:3,key:"A",done:true,ex:[["supino","Peito",50,10]]},
]);
const planoFake: any = { planName:"P", sessions:[{sessionKey:"A",sessionName:"A",exercises:[
  {exerciseId:"supino",name:"Supino",primaryMuscleGroup:"Peito",sets:3,reps:"8-12",targetRIR:2,suggestedRestSeconds:90}],mobility:[]}] };
t("detecta exercício parado", stagnantExercises(planoFake, est).length > 0);
t("não acusa quem evoluiu", stagnantExercises(planoFake, herda).length === 0);

console.log("\n6) SUGESTÃO POR SÉRIES (motor novo)");
const sug = mk([{date:"2026-07-20",wk:1,key:"A",done:true,ex:[["supino","Peito",50,10]]}]);
t("sugere algo com histórico", suggestLoad("supino", sug, "8-12", 2) !== null);
t("sem histórico retorna null", suggestLoad("nada", sug, "8-12", 2) === null);

console.log("\n7) CALORIAS COM CARDIO");
const base = {weightKg:80,durationSeconds:3600,exerciseCount:8,loadedExerciseCount:8,totalSets:24,totalVolumeKg:8000,averageRir:1.5};
const semC = estimateCalories(base)!;
const comC = estimateCalories({...base,cardio:{type:"esteira",minutes:20,km:3.3}})!;
t("cardio aumenta a estimativa", comC > semC, `${semC} -> ${comC}`);
t("sem peso corporal retorna null", estimateCalories({...base,weightKg:null}) === null);
t("determinístico", estimateCalories(base) === semC);

console.log("\n8) EVOLUÇÃO NO RANKING (bug corrigido)");
const rk = mk([
  {date:"2026-07-13",wk:1,key:"A",done:true,ex:[["supino","Peito",50,10]]},
  {date:"2026-07-20",wk:2,key:"A",done:true,ex:[["supino","Peito",55,10]]},
]);
t("semana atual agora calcula", evolutionPctInPeriod(rk, d => d >= "2026-07-20") !== null);
t("valor correto (50→55 = 10%)", Math.round(evolutionPctInPeriod(rk, d => d >= "2026-07-20")!) === 10);
t("sem baseline continua null", evolutionPctInPeriod(mk([{date:"2026-07-20",wk:1,key:"A",done:true,ex:[["novo","X",50,10]]}]), d=>d>="2026-07-20") === null);

console.log("\n9) EVOLUÇÃO POR PLANO (aba Evolução — não podia mudar)");
const planoEv: any = { planName:"P", sessions:[{sessionKey:"A",sessionName:"A",exercises:[
  {exerciseId:"supino",name:"Supino",primaryMuscleGroup:"Peito",sets:3,reps:"8-12",targetRIR:2,suggestedRestSeconds:90}],mobility:[]}] };
const evp = evolutionForPlan(planoEv, herda);
t("evolução do plano ainda funciona", evp.overallPct !== null && Math.round(evp.overallPct!) === 10);

console.log(`\n=== ${ok} passaram, ${fail} falharam ===`);
process.exit(fail ? 1 : 0);
