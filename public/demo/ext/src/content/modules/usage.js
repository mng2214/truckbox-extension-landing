/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */
(function(){function e(n,{value:a=null,detail:s=null}={}){if(n)try{const l=window.TB_ADAPTER&&window.TB_ADAPTER.id==="truckstop"?"TRUCKSTOP":"DAT";chrome.runtime.sendMessage({type:"usage_event",event:n,value:a,detail:s,platform:l},()=>{chrome.runtime.lastError})}catch{}}let t=null;function i(){t||document.visibilityState!=="visible"||(e("BOARD_HEARTBEAT"),t=setInterval(()=>{document.visibilityState==="visible"&&e("BOARD_HEARTBEAT")},3e5))}function r(){t&&(clearInterval(t),t=null)}document.addEventListener("visibilitychange",()=>{document.visibilityState==="visible"?i():r()}),window.tbUsage=e;try{e("EXTENSION_READY",{detail:chrome.runtime.getManifest().version})}catch{}i()})();
