// Store-app bridge: Apple / Google in-app purchase for the Full Game, full-screen status bar.
import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { StatusBar } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

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

if (window.CDN.native) {
  StatusBar.hide().catch(() => {});
  addEventListener('load', () => setTimeout(() => SplashScreen.hide().catch(() => {}), 300));
}
