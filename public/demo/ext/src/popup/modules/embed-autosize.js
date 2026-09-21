/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */
(function(){if(window.parent===window)return;const e=()=>{const t=document.querySelector(".wrap"),o=t?Math.ceil(t.getBoundingClientRect().height):document.documentElement.scrollHeight;window.parent.postMessage({source:"truckbox-popup",type:"height",height:o},"*")},n=document.querySelector(".wrap")||document.body;window.ResizeObserver&&new ResizeObserver(e).observe(n),window.addEventListener("load",e),document.readyState==="loading"?document.addEventListener("DOMContentLoaded",e):e()})();
