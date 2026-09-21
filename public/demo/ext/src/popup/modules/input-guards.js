/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */
(function(){const n=/[\x00-\x1f\x7f]/g,o={myMc:e=>e.replace(/\D/g,"").slice(0,10),myPhone:e=>e.replace(/[^0-9+()\-. ]/g,""),myName:e=>e.replace(/[<>]/g,"").replace(n,""),tplName:e=>e.replace(/[<>]/g,"").replace(n,""),templateSubject:e=>e.replace(n," ")};function s(e,t){const c=e.value,a=t(c);if(a===c)return;const r=e.selectionStart;if(e.value=a,typeof r=="number"){const l=Math.max(0,r-(c.length-a.length));try{e.setSelectionRange(l,l)}catch{}}}document.addEventListener("DOMContentLoaded",()=>{Object.keys(o).forEach(e=>{const t=document.getElementById(e);t&&t.addEventListener("input",()=>s(t,o[e]))})})})();
