export class DomainError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export function requireThat(ok, message, code = 'invalid-argument') {
  if (!ok) throw new DomainError(code, message);
}
export function id(value) {
  requireThat(typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value), 'Invalid record ID.');
  return value;
}
export function text(value, max = 200, optional = false) {
  requireThat(typeof value === 'string' && value.length <= max && (optional || value.trim().length > 0), 'Invalid text.');
  return value.trim();
}
export function number(value, min, max) {
  requireThat(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, 'Number outside allowed range.');
  return value;
}
export function email(value) {
  const result = text(value, 254).toLowerCase();
  requireThat(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result), 'Enter a valid email.');
  return result;
}
export function localDate(value) {
  requireThat(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'Invalid date.');
  const date = new Date(value + 'T00:00:00Z');
  requireThat(Number.isFinite(date.valueOf()) && date.toISOString().slice(0,10) === value, 'Invalid date.');
  return value;
}
export function workout(value, performed = false) {
  requireThat(value && Array.isArray(value.exercises) && value.exercises.length > 0 && value.exercises.length <= 20, 'Use 1–20 exercises.');
  const exerciseIds = new Set(); const setIds = new Set();
  return {id:id(value.id), name:text(value.name, 100), exercises:value.exercises.map(e => {
    const eid = id(e.id); requireThat(!exerciseIds.has(eid), 'Duplicate exercise ID.'); exerciseIds.add(eid);
    requireThat(Array.isArray(e.sets) && e.sets.length > 0 && e.sets.length <= 12, 'Use 1–12 sets.');
    return {id:eid, name:text(e.name,100), sets:e.sets.map(s => {
      const sid = id(s.id); requireThat(!setIds.has(sid), 'Duplicate set ID.'); setIds.add(sid);
      const result = {id:sid, reps:number(s.reps,0,1000), weightKg:number(s.weightKg,0,1000)};
      if (performed) { requireThat(typeof s.done === 'boolean', 'Invalid set completion.'); result.done=s.done; }
      return result;
    })};
  })};
}
export function program(value) {
  requireThat(Array.isArray(value.workouts) && value.workouts.length > 0 && value.workouts.length <= 10, 'Use 1–10 workouts.');
  const workouts = value.workouts.map(w=>workout(w));
  requireThat(new Set(workouts.map(w=>w.id)).size === workouts.length, 'Duplicate workout ID.');
  const result={name:text(value.name,100), description:text(value.description || '',1000,true), workouts};
  requireThat(JSON.stringify(result).length < 200000, 'Program too large.'); return result;
}
export function totals(session) {
  const sets=session.exercises.flatMap(e=>e.sets).filter(s=>s.done);
  return {sets:sets.length, volumeKg:Math.round(sets.reduce((n,s)=>n+s.reps*s.weightKg,0)*100)/100};
}
export function validateInvitation(invite, auth, now) {
  requireThat(invite && invite.status !== 'revoked' && invite.expiresAt > now, 'Invitation expired or revoked.', 'failed-precondition');
  requireThat(auth.email_verified === true && email(auth.email) === invite.email, 'Sign in with the verified invited email.', 'permission-denied');
  requireThat(invite.coachId !== auth.uid, 'You cannot coach yourself.');
  requireThat(invite.status === 'pending' || (invite.status === 'accepted' && invite.athleteId === auth.uid), 'Invitation already used.', 'failed-precondition');
}
export function sessionUpdate(previous, incoming, expectedRevision) {
  requireThat((previous?.revision || 0) === expectedRevision, 'This workout changed on another device. Export this device’s copy before resolving.', 'aborted');
  requireThat(!previous || previous.status === 'inProgress', 'Completed workouts are immutable.', 'failed-precondition');
  const clean=workout(incoming,true);
  requireThat(['inProgress','completed'].includes(incoming.status), 'Invalid workout state.');
  requireThat(incoming.status !== 'completed' || totals(clean).sets > 0, 'Log at least one set.');
  return {...clean,status:incoming.status,localDate:localDate(incoming.localDate),revision:expectedRevision+1};
}
