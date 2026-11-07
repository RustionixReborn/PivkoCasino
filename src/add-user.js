/* ============ ДОБАВИТЬ ЮЗЕРА В FIREBASE ============
   Использование:
     node add-user.js <ник> <ключ> [баланс]
   Пример:
     MVP. pivo3000 ...   (см. подсказку ниже)

   ВАЖНО: эта утилита — только для ТВОЕЙ машины. Она пишет в базу напрямую,
   поэтому использует ADMIN-секрет (database secret), а НЕ даёт его в сайт.
   Секрет передаётся через переменную окружения FIREBASE_DB_SECRET — в коде его НЕТ.
   Как запустить (PowerShell):
     $env:FIREBASE_DB_SECRET = "сюда_реальный_secret_из_консоли"
     node add-user.js petr pivo3000 5000
*/
const URL = 'https://pivkozeta-default-rtdb.firebaseio.com/';
const SECRET = process.env.FIREBASE_DB_SECRET;
if (!SECRET) {
  console.error('❌ Не задан секрет. Сначала выполни:');
  console.error('   $env:FIREBASE_DB_SECRET = "твой_database_secret"');
  console.error('(Бери в Firebase Console → Настройки проекта → Аккаунты служб → Ключи БД. Храни локально, в код не вставляй.)');
  process.exit(1);
}

const nick = process.argv[2] || 'test' + Math.floor(Math.random() * 1000);
const key = process.argv[3] || 'pivo' + Math.floor(Math.random() * 10000);
const balance = parseInt(process.argv[4], 10) || 1000;

(async () => {
  const user = {
    key, balance, gains: 0, games: 0, maxWin: 0, luck: 0, sound: true, hidden: false,
    savedAt: new Date().toISOString(),
  };
  const r = await fetch(URL + 'users/' + encodeURIComponent(nick) + '.json?auth=' + SECRET, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });
  if (!r.ok) { console.error('ОШИБКА', r.status, await r.text()); process.exit(1); }
  console.log('✅ Аккаунт создан:');
  console.log('   users/' + nick);
  console.log('   ключ входа: ' + key);
  console.log('   баланс: ' + balance + ' ₽');
})();