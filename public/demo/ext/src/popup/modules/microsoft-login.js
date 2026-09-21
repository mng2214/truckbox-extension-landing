/*!
 * Truck Box — Copyright (c) 2025-2026 TruckBox LLC. All rights reserved.
 * Proprietary and confidential. Not open source, not public domain.
 * No license is granted: this file may not be copied, reused, modified, redistributed,
 * or used as input or training data for any AI or code-generation system.
 * Licensing: info@truckbox.app
 */
(function(){function i(){setTimeout(async()=>{typeof updateAuthStatus=="function"&&await updateAuthStatus(),typeof loadUserSubscriptionStatus=="function"&&await loadUserSubscriptionStatus(),typeof loadSessionId=="function"&&loadSessionId()},250)}document.addEventListener("DOMContentLoaded",()=>{const t=document.getElementById("loginMicrosoft");t&&(chrome.runtime.sendMessage({type:"auth_providers"},e=>{if(chrome.runtime.lastError||!e?.ok||!e.data?.microsoft)return;t.hidden=!1;const n=document.getElementById("setupDesc");n&&(n.textContent="Sign in with Google or Microsoft to send emails from your Gmail or Outlook account.")}),t.addEventListener("click",()=>{t.disabled=!0,setSignInLabel(t,"Signing in..."),chrome.runtime.sendMessage({type:"auth_login_microsoft"},e=>{t.disabled=!1,setSignInLabel(t,"Sign in with Microsoft");const n=!chrome.runtime.lastError&&e?.ok,o=n?"Signed in successfully":e?.error==="email_taken"?"This email already has a TruckBox account. Sign in with Google, then link Microsoft in the cabinet Settings.":"Sign-in failed";typeof say=="function"&&say(o,!n),i()})}))})})();
