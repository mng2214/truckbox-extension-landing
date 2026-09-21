/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */
(function(){const o="https://truckbox.app/business/start";function t(){const n=document.getElementById("deviceSignedOutNotice");n&&chrome.storage.local.get(["signedOutReason","backendToken"],e=>{n.hidden=!(e&&e.signedOutReason==="other_device"&&!e.backendToken)})}document.addEventListener("DOMContentLoaded",()=>{const n=document.getElementById("deviceNoticeTeamLink");n&&n.addEventListener("click",e=>{e.preventDefault(),chrome.tabs.create({url:o})}),t(),chrome.storage.onChanged.addListener((e,d)=>{d==="local"&&(e.signedOutReason||e.backendToken)&&t()})})})();
