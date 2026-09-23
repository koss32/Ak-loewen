export const locales = ['de','ru','uk','tr'];
export const localeNames = {de:'Deutsch',ru:'Русский',uk:'Українська',tr:'Türkçe'};
export const programs = [
 {id:'boxen',brandId:'ak',nameKey:'boxen',descriptionKey:'boxDesc',groupIds:['box-15'],monthlyPriceEUR:75,bookingChannel:'telegram-form'},
 {id:'sambo-mma',brandId:'ak',nameKey:'sambo',descriptionKey:'samboDesc',groupIds:['sambo-9-15','sambo-16'],monthlyPriceEUR:60,bookingChannel:'telegram-form'},
 {id:'valset',brandId:'valset',nameKey:'valset',descriptionKey:'valDesc',groupIds:['val-mama','val-junior','val-senior'],monthlyPriceEUR:50,bookingChannel:'telegram-form'}
];
export const groups = [
 {id:'box-15',programId:'boxen',labelKey:'boxGroup',minAge:15,maxAge:null,scheduleIds:['box-week']},
 {id:'sambo-9-15',programId:'sambo-mma',labelKey:'samboYoung',minAge:9,maxAge:15,scheduleIds:['sambo-young-week','sambo-young-sat']},
 {id:'sambo-16',programId:'sambo-mma',labelKey:'samboAdult',minAge:16,maxAge:null,scheduleIds:['sambo-adult-week','sambo-adult-sat']},
 {id:'val-mama',programId:'valset',labelKey:'mamaGroup',descriptionKey:'mamaDesc',minAge:3,maxAge:6,scheduleIds:['val-mama-week'],ageBoundaryPolicy:'trainer-discretion'},
 {id:'val-junior',programId:'valset',labelKey:'juniorGroup',descriptionKey:'juniorDesc',minAge:5,maxAge:8,scheduleIds:['val-junior-week'],ageBoundaryPolicy:'trainer-discretion'},
 {id:'val-senior',programId:'valset',labelKey:'seniorGroup',descriptionKey:'seniorDesc',minAge:9,maxAge:16,scheduleIds:['val-senior-week'],ageBoundaryPolicy:'trainer-discretion'}
];
export const schedules = [
 {id:'box-week',weekdayIds:[1,3,5],startTime:'18:30',endTime:'20:00'},
 {id:'sambo-young-week',weekdayIds:[2,4],startTime:'16:30',endTime:'18:00'},
 {id:'sambo-young-sat',weekdayIds:[6],startTime:'10:00',endTime:'11:30'},
 {id:'sambo-adult-week',weekdayIds:[2,4],startTime:'18:30',endTime:'20:00'},
 {id:'sambo-adult-sat',weekdayIds:[6],startTime:'12:00',endTime:'13:30',byArrangement:true},
 {id:'val-mama-week',weekdayIds:[1,3,5],startTime:'15:00',endTime:'16:00'},
 {id:'val-junior-week',weekdayIds:[1,3,5],startTime:'16:00',endTime:'17:00'},
 {id:'val-senior-week',weekdayIds:[1,3,5],startTime:'17:00',endTime:'18:00'}
].map(s=>({...s,timezone:'Europe/Berlin'}));
export const trainers = [
 {id:'anar',programId:'sambo-mma',name:'Anar Karimov',languages:['ru','tr','uk'],image:'anar',portraitStatus:'approved',bioKey:'anarBio',approachKey:'anarApproach',achievementKey:'anarAchievement',biographyStatus:'owner-supplied',achievementsStatus:'owner-supplied'},
 {id:'namig',programId:'boxen',name:'Namih Aliyev',languages:[],image:'namig',portraitStatus:'approved',instagram:'https://www.instagram.com/aliyev__11',bioKey:'namigBio',approachKey:'namigApproach',biographyStatus:'owner-supplied',achievementsStatus:'not-listed'}
];
export const contacts = {
 email:'aklggmbh@gmail.com',telegram:'https://t.me/ak_loewenbot',instagram:'https://www.instagram.com/VALSET_SOLINGEN/',
 anarPhone:'+380 99 203 00 00',anarTelegram:'https://t.me/+380992030000',
 whatsappUA:'https://wa.me/380967542528',whatsappDE:'https://wa.me/4915158873852',map:'https://maps.app.goo.gl/q7yJ8i5ee1tLey8j8',trainingAddress:'Werwolf 8, 42651 Solingen'
};
export const legal = {
 entityName:'AK-LOEWEN gGmbH',manager:'Dietrich Schmelzer',registeredAddress:'Parallelstraße 6, 42719 Solingen',country:'Deutschland',
 phone:'+49 157 30447730',registerCourt:'Amtsgericht Wuppertal',registerNumber:'HRB 36478',
 publicationStatus:'published',consentVersion:'telegram-2026-09-15-v1'
};
