import {programs,groups,schedules} from './data.js';

const weekdays=['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];

/** Format one intake consistently for the local and hosted Telegram services. */
export function formatTrialMessage(d,receivedAt=new Date().toISOString()){
 const program=programs.find(item=>item.id===d.directionId);
 const group=groups.find(item=>item.id===d.groupId);
 const schedule=d.preferredTime?schedules.find(item=>item.id===d.preferredTime):null;
 const brand=program?.brandId==='valset'?'VALSET':'AK-LOEWEN';
 const direction=program?.nameKey==='boxen'?'Boxen':program?.nameKey==='sambo'?'Sambo & MMA':'VALSET';
 const groupLabel=group?.labelKey==='box-15'?'15+ Jahre':group?.labelKey==='sambo-9-15'?'9–15 Jahre':group?.labelKey==='sambo-16'?'16+ Jahre':group?.labelKey==='val-mama'?'Mama & Kind · 3–6 Jahre':group?.labelKey==='val-junior'?'Junior · 5–8 Jahre':group?.labelKey==='val-senior'?'Senior · 9–16 Jahre':d.groupId;
 const scheduleLabel=schedule?`${schedule.weekdayIds.map(day=>weekdays[day]).join(' · ')} ${schedule.startTime}–${schedule.endTime}${schedule.byArrangement?' · nach Vereinbarung':''}`:'—';
 return [
  `${brand} · Probetraining`,
  `Richtung: ${direction}`,
  `Gruppe: ${groupLabel}`,
  `Trainingszeit: ${scheduleLabel}`,
  `Name: ${d.name}`,
  `Alter: ${d.age}`,
  `Kontakt: Telefon ${d.phone||'—'} · E-Mail ${d.email||'—'} · Telegram ${d.telegram?`@${d.telegram}`:'—'}`,
  `Kommentar: ${d.comment||'—'}`,
  `Sprache: ${d.locale}`,
  `Datenschutz: ${d.consentVersion}`,
  `Request: ${d.requestId}`,
  `Eingang: ${receivedAt}`
 ].join('\n');
}
