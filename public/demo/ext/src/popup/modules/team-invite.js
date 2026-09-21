/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */
(function(){const a="https://truckbox.app/business/accounts";function n(){const t=document.getElementById("teamInviteNotice");t&&chrome.runtime.sendMessage({type:"team_invites"},e=>{if(chrome.runtime.lastError||!e||!e.ok||!Array.isArray(e.data)||!e.data.length){t.hidden=!0;return}t.textContent=e.data[0].organizationName+" invited you to their team \u2192 Review",t.hidden=!1})}document.addEventListener("DOMContentLoaded",()=>{const t=document.getElementById("teamInviteNotice");t&&t.addEventListener("click",e=>{e.preventDefault(),chrome.tabs.create({url:a})}),n(),chrome.storage.onChanged.addListener((e,o)=>{o==="local"&&e.backendToken&&n()})})})();
