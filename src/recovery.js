import {startUpdates} from './updates.js?recovery=0.5.4';
startUpdates({recovery:true,reload:()=>location.replace('./#settings')});
