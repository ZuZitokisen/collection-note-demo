import {startUpdates} from './updates.js?recovery=0.5.10';
startUpdates({recovery:true,reload:()=>location.replace('./#settings')});
