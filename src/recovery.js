import {startUpdates} from './updates.js?recovery=0.5.7';
startUpdates({recovery:true,reload:()=>location.replace('./#settings')});
