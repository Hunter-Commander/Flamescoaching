const uid=()=>crypto.randomUUID();
export function sampleWorkout(name='Upper body · Strength') {
  return {id:uid(),name,exercises:[['Barbell bench press',3,8,60],['Seated cable row',3,10,45],['Dumbbell shoulder press',3,10,18],['Lat pulldown',3,12,40]].map(([name,count,reps,weightKg])=>({id:uid(),name,sets:Array.from({length:count},()=>({id:uid(),reps,weightKg}))}))};
export function dateKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function seed(){
  const now=Date.now(), workout=sampleWorkout();
  const relationships=['Alex Morgan','Jordan Lee','Sam Rivera'].map((name,i)=>({id:`demo-relationship-${i}`,coachId:'demo-coach',coachName:'Your Coach',athleteId:`demo-athlete-${i}`,athleteName:name,status:'active',consent:{workouts:true,nutrition:true,checkIns:true},startedAt:now-30*86400000}));
  const sessions=Array.from({length:12},(_,i)=>{
    const days=14-i, athlete=i%3, w=sampleWorkout(i%2?'Lower body · Strength':'Upper body · Strength');
    return {...w,id:`demo-session-${i}`,athleteId:`demo-athlete-${athlete}`,relationshipId:`demo-relationship-${athlete}`,status:'completed',localDate:dateKey(new Date(now-days*86400000)),completedAt:now-days*86400000,revision:1,exercises:w.exercises.map(e=>({...e,sets:e.sets.map(s=>({...s,weightKg:Math.round(s.weightKg*(.8+i*.015)),done:true}))}))};
  });
  return {schemaVersion:1,programs:[{id:'demo-program',coachId:'demo-coach',name:'Foundation · Build & Strength',description:'A focused full-body block. Build consistency, then add load with intention.',workouts:[workout,sampleWorkout('Lower body · Strength'),sampleWorkout('Full body · Volume')],revision:1,status:'published',publishedVersionId:'v1'}],relationships,sessions,scheduled:relationships.flatMap(r=>[0,2,4].map((offset,i)=>({id:`demo-scheduled-${r.athleteId}-${i}`,athleteId:r.athleteId,relationshipId:r.id,workout:structuredClone(workout),programVersionId:'v1',prescriptionRevision:1,status:'planned',scheduledLocalDate:dateKey(new Date(now+offset*86400000))}))),messages:[{id:'demo-msg',relationshipId:'demo-relationship-0',senderId:'demo-athlete-0',text:'Feeling good after the last session. Ready for this week!',createdAt:now-3600000}],checkIns:[{id:'demo-checkin',relationshipId:'demo-relationship-1',athleteId:'demo-athlete-1',weightKg:76.4,energy:4,notes:'Training felt strong this week. Sleep has been more consistent.',status:'submitted',createdAt:now-86400000}],nutrition:{},outbox:[],invitations:[],activeSessionId:null};
}
