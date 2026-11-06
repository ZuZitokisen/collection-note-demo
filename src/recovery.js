import {startUpdates} from './updates.js?recovery=0.5.9';
startUpdates({recovery:true,reload:()=>location.replace('./#settings')});
