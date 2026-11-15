// Store-app bridge: Apple / Google in-app purchase for the Full Game, full-screen status bar.
import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { StatusBar } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Share } from '@capacitor/share';

const ID = 'cashdiamond_full_game';
const T = PURCHASE_TYPE.INAPP;
const good = p => p.productIdentifier === ID && (Capacitor.getPlatform() !== 'android' || p.purchaseState === '1' || p.purchaseState == null);

window.CDN = {
  native: Capacitor.isNativePlatform(),
  platform: Capacitor.getPlatform(),
  store: Capacitor.getPlatform() === 'ios' ? 'App Store' : 'Google Play',
  async price() {
    const { products } = await NativePurchases.getProducts({ productIdentifiers: [ID], productType: T });
    return products && products[0] ? products[0].priceString : null;
  },
  async buy() {
    const t = await NativePurchases.purchaseProduct({ productIdentifier: ID, productType: T, quantity: 1 });
    return !!t && good({ ...t, productIdentifier: t.productIdentifier || ID });
  },
  async owned() {
    const { purchases } = await NativePurchases.getPurchases({ productType: T });
    return (purchases || []).some(good);
  },
  async restore() {
    await NativePurchases.restorePurchases();
    return this.owned();
  },
};

// Online Vs "Share invite link" uses Capacitor.Plugins.Share when the WebView has no navigator.share
if (window.CDN.native && window.Capacitor) (window.Capacitor.Plugins = window.Capacitor.Plugins || {}).Share = Share;

if (window.CDN.native) {
  StatusBar.hide().catch(() => {});
  addEventListener('load', () => setTimeout(() => SplashScreen.hide().catch(() => {}), 300));
}

// ---- Rewarded ads (Google AdMob). Rewarded only: the player taps to watch. Never during play, no banners,
// no interstitials. IDs come from ads.config.json (Google TEST ids until Edgar's real ones are pasted there).
// Consent (UMP, EEA/UK) and Apple's tracking prompt are asked only the first time a player taps "Watch",
// so Full Game owners and players who never watch never see them.
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';
import ADS from '../ads.config.json';

const AD_UNIT = Capacitor.getPlatform() === 'ios' ? ADS.iosRewarded : ADS.androidRewarded;
let adInit = null, adReady = null, adAsked = (() => { try { return !!localStorage.getItem('cd_ad_asked') } catch (e) { return false } })();
const adStart = () => adInit || (adInit = AdMob.initialize({
  tagForChildDirectedTreatment: !!ADS.childDirected, tagForUnderAgeOfConsent: !!ADS.childDirected,
  ...(ADS.childDirected ? { maxAdContentRating: 'General' } : {}),
}).catch(e => { adInit = null; throw e }));
async function adConsent() { // Google UMP consent form (EEA / UK), then Apple's App Tracking Transparency prompt
  let info = await AdMob.requestConsentInfo();
  if (info.isConsentFormAvailable && info.status === 'REQUIRED') info = await AdMob.showConsentForm();
  if (Capacitor.getPlatform() === 'ios') {
    const t = await AdMob.trackingAuthorizationStatus().catch(() => ({ status: 'authorized' }));
    if (t.status === 'notDetermined') await AdMob.requestTrackingAuthorization().catch(() => {});
  }
  adAsked = true; try { localStorage.setItem('cd_ad_asked', '1') } catch (e) {}
  return info.canRequestAds !== false;
}
const adLoad = () => adReady || (adReady = adStart()
  .then(() => AdMob.prepareRewardVideoAd({ adId: AD_UNIT }))
  .catch(e => { adReady = null; throw e }));

window.CDN.ads = {
  available: window.CDN.native,
  test: /^ca-app-pub-3940256099942544\//.test(AD_UNIT),
  // Warm up an ad in the background, but only for players who already answered the consent questions.
  async warm() { if (!adAsked) return; try { const i = await AdMob.requestConsentInfo(); if (i.canRequestAds) adLoad().catch(() => {}) } catch (e) {} },
  // Show one rewarded video. Resolves true only if Google says the player earned the reward.
  async show() {
    if (!adAsked && !(await adConsent())) return false;
    await adLoad();
    let earned = false;
    const hs = [];
    try {
      return await new Promise((done, fail) => {
        // The plugin only resolves when a reward is earned, so the ad being closed is what ends the wait.
        hs.push(AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { earned = true }));
        hs.push(AdMob.addListener(RewardAdPluginEvents.Dismissed, () => setTimeout(() => done(earned), 250)));
        hs.push(AdMob.addListener(RewardAdPluginEvents.FailedToShow, e => fail(e)));
        AdMob.showRewardVideoAd().then(r => { if (r) earned = true }, fail);
      });
    } finally {
      adReady = null; hs.forEach(h => h.then(x => x.remove()).catch(() => {}));
      adLoad().catch(() => {}); // next ad ready for next time
    }
  },
  async privacy() { // "Ad privacy choices" link (required by UMP when the player is in a consent region)
    try { const i = await AdMob.requestConsentInfo(); if (i.privacyOptionsRequirementStatus !== 'REQUIRED') return false; await AdMob.showPrivacyOptionsForm(); return true } catch (e) { return false }
  },
  async privacyNeeded() { try { return (await AdMob.requestConsentInfo()).privacyOptionsRequirementStatus === 'REQUIRED' } catch (e) { return false } },
};
