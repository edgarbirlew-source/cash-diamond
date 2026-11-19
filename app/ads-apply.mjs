// Write the AdMob settings from ads.config.json into the Android manifest and the iOS Info.plist.
// Runs on every build (npm run build), so ads.config.json is the only place an ID is ever typed.
import { readFileSync, writeFileSync } from 'node:fs';
const c = JSON.parse(readFileSync(new URL('./ads.config.json', import.meta.url)));
const TEST = /^ca-app-pub-3940256099942544[~/]/;
for (const k of ['androidAppId', 'iosAppId']) if (!/^ca-app-pub-\d{16}~\d{10}$/.test(c[k])) throw new Error('bad ' + k);
for (const k of ['androidRewarded', 'iosRewarded']) if (!/^ca-app-pub-\d{16}\/\d{10}$/.test(c[k])) throw new Error('bad ' + k);

// Google's own SKAdNetwork id first, then the buyer ids Google lists (developers.google.com/admob/ios/privacy/strategies, 2026-11-13)
const SKAN = 'cstr6suwn9 4fzdc2evr5 2fnua5tdw4 ydx93a7ass p78axxw29g v72qych5uu ludvb6z3bs cp8zw746q7 3sh42y64q3 c6k4g5qg8m s39g8k73mm wg4vff78zm 3qy4746246 f38h382jlk hs6bdukanm mlmmfzh3r3 v4nxqhlyqp wzmmz9fp6w su67r6k2v3 yclnxrl5pm t38b2kh725 7ug5zh24hu gta9lk7p23 vutu7akeur y5ghdn5j9k v9wttpbfk9 n38lu8286q 47vhws6wlr kbd757ywx3 9t245vhmpl a2p9lx4jpn 22mmun2rn5 44jx6755aq k674qkevps 4468km3ulz 2u9pt9hc89 8s468mfl3y klf5c3l5u5 ppxm28t8ap kbmxgpxpgc uw77j35x4d 578prtvx9j 4dzt52r2t5 tl55sbb4fm c3frkrj4fj e5fvkxwrpn 8c4e2ghe7u 3rd42ekr43 97r2b46745 3qcr597p9d'.split(' ');

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const between = (text, a, b, body) => {
  const re = new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return re.test(text) ? text.replace(re, a + body + b) : null;
};

// Android: <meta-data com.google.android.gms.ads.APPLICATION_ID> inside <application>
const man = 'android/app/src/main/AndroidManifest.xml';
let m = readFileSync(man, 'utf8');
const mBody = `\n        <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="${c.androidAppId}"/>\n        `;
m = between(m, '<!-- admob:start -->', '<!-- admob:end -->', mBody) ??
  m.replace('</application>', `<!-- admob:start -->${mBody}<!-- admob:end -->\n    </application>`);
writeFileSync(man, m);

// iOS: GADApplicationIdentifier, SKAdNetwork ids, and the App Tracking Transparency text only when the game is NOT child-directed
// (kids apps must never show Apple's tracking prompt).
const pl = 'ios/App/App/Info.plist';
let p = readFileSync(pl, 'utf8');
const pBody = `
\t<key>GADApplicationIdentifier</key>
\t<string>${c.iosAppId}</string>
${c.childDirected || !c.trackingText ? '' : `\t<key>NSUserTrackingUsageDescription</key>\n\t<string>${esc(c.trackingText)}</string>\n`}\t<key>SKAdNetworkItems</key>
\t<array>
${SKAN.map(id => `\t\t<dict><key>SKAdNetworkIdentifier</key><string>${id}.skadnetwork</string></dict>`).join('\n')}
\t</array>
\t`;
p = between(p, '<!-- admob:start -->', '<!-- admob:end -->', pBody) ??
  p.replace(/<\/dict>\s*<\/plist>\s*$/, `<!-- admob:start -->${pBody}<!-- admob:end -->\n</dict>\n</plist>\n`);
writeFileSync(pl, p);

console.log('ads config applied:', TEST.test(c.androidRewarded) || TEST.test(c.iosRewarded) ? 'GOOGLE TEST ADS' : 'REAL AD UNITS');
