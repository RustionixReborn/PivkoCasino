/* ============ FIREBASE SDK: initializeApp + App Check (ReCaptchaEnterprise) ============ */
/* Инициализирует Firebase-приложение и App Check (Enforced) для Realtime Database.
   Экспонирует window.FIREBASE с методом getToken() — токен подставляется в REST-запросы
   к RTDB (см. firebase.js), чтоб App Check не резал обращения. */
window.FIREBASE = (function () {
  // Файл загружается после compat-SDK скриптов (см. index.html)
  if (typeof firebase === 'undefined') {
    console.warn('Firebase SDK не загружен — App Check отключён');
    return { app: null, appCheck: null, getToken: async function () { return null; } };
  }

  var firebaseConfig = {
    apiKey: 'AIzaSyCf7f9-a0T-4xtBbrXYvnAIAJjiAL--nTI',
    authDomain: 'pivkokazino.firebaseapp.com',
    databaseURL: 'https://pivkokazino-default-rtdb.firebaseio.com',
    projectId: 'pivkokazino',
    storageBucket: 'pivkokazino.firebasestorage.app',
    messagingSenderId: '511019585836',
    appId: '1:511019585836:web:062b16416d97e57c74dc89',
    measurementId: 'G-G43GM1HEZZ',
  };

  var app = firebase.initializeApp(firebaseConfig);

  // --- App Check (Enforced): ReCaptcha Enterprise провайдер ---
  var appCheck = null;
  try {
    var ac = firebase.appCheck();
    ac.initializeAppCheck(app, {
      provider: new firebase.appCheck.ReCaptchaEnterpriseProvider('6Ld4UhMuAAAAAPIxSrQDgQzVJ7FKeEnj2aV88wPV'),
      isTokenAutoRefreshEnabled: true,
    });
    appCheck = ac;
    console.log('App Check initialized (ReCaptchaEnterprise)');
  } catch (e) {
    console.warn('App Check init failed:', e);
  }

  // --- кэш токена: не дёргаем рекапчу на каждый запрос ---
  var cached = null, cachedAt = 0, fetching = null;
  var TTL = 30 * 60 * 1000; // 30 минут
  async function getToken() {
    if (!appCheck) return null;
    if (cached && Date.now() - cachedAt < TTL) return cached; // свежий
    if (fetching) return fetching; // уже получаем
    fetching = (async function () {
      try {
        var res = await appCheck.getToken();
        cached = res && res.token ? res.token : cached;
        cachedAt = Date.now();
        return cached;
      } catch (e) {
        return cached || null; // не смогли — вернём старый (если есть)
      } finally {
        fetching = null;
      }
    })();
    return fetching;
  }

  return { app: app, appCheck: appCheck, getToken: getToken };
})();