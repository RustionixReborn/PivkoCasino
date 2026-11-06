/* ============ ДОБАВИТЬ ЮЗЕРА В FIREBASE ============
   Использование:
     node add-user.js <ник> <ключ> [баланс]
   Пример:
     node add-user.js petr pivo3000 5000
   Без аргументов — создаёт тестового юзера.
   (Этот файл — просто удобная утилита, сайту он не нужен.) */
const URL = 'https://pivkokazino-default-rtdb.firebaseio.com/';
const SECRET = 'AIzaSyCf7f9-a0T-4xtBbrXYvnAIAJjiAL--nTI';

const nick = process.argv[2] || 'test' + Math.floor(Math.random() * 1000);
const key = process.argv[3] || 'pivo' + Math.floor(Math.random() * 10000);
const balance = parseInt(process.argv[4], 10) || 1000;

(async () => {
  const user = {
    key, balance, gains: 0, games: 0, maxWin: 0, luck: 0, sound: true,
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