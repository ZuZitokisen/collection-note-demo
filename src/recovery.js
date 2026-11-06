import {startUpdates} from './updates.js?recovery=0.5.8';
startUpdates({recovery:true,reload:()=>location.replace('./#settings')});
