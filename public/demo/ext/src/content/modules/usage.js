/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */
(function(){function n(t,{value:S=null,detail:v=null}={}){if(t)try{const w=window.TB_ADAPTER&&window.TB_ADAPTER.id==="truckstop"?"TRUCKSTOP":"DAT";chrome.runtime.sendMessage({type:"usage_event",event:t,value:S,detail:v,platform:w},()=>{chrome.runtime.lastError})}catch{}}let i=0,o=Date.now(),c=Date.now(),e=null;const u=()=>document.visibilityState==="visible"&&Date.now()-c<3e5;function d(){c=Date.now(),!e&&document.visibilityState==="visible"&&l()}function s(){const t=Date.now();u()&&(i+=t-o),o=t,i>=9e5&&r("checkpoint")}function r(t){i<3e4||(n("BOARD_SESSION",{value:Math.round(i/1e3),detail:t}),i=0)}function l(){e||(o=Date.now(),e=setInterval(s,3e4))}function a(){e&&(clearInterval(e),e=null)}for(const t of["mousemove","keydown","click","scroll","wheel"])window.addEventListener(t,d,{passive:!0,capture:!0});document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){c=Date.now(),l();return}s(),a(),r("hidden")}),window.addEventListener("pagehide",()=>{s(),a(),r("closed")}),window.tbUsage=n;try{n("EXTENSION_READY",{detail:chrome.runtime.getManifest().version})}catch{}document.visibilityState==="visible"&&l()})();
