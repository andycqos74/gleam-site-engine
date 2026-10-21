// Gives an account a new temporary password (and makes it an active administrator), for when nobody can sign in.
// In Portainer: Containers > the web container > Console > Connect, then run
//   node src/reset-admin.js you@example.org
// The new password is printed once; you'll be asked to choose your own after signing in.
import { openDb, now } from './db.js';
import { loadConfig } from './config.js';
import { hashPassword, randomPassword } from './auth.js';

const email = (process.argv[2] || '').trim();
const db = openDb(loadConfig().dataDir);

if (!email) {
  console.log('Usage: node src/reset-admin.js <email>\n\nAccounts:');
  for (const u of db.prepare('SELECT email, role, active FROM users ORDER BY id').all()) {
    console.log(`  ${u.email}  ${u.role}${u.active ? '' : ' (access removed)'}`);
  }
  process.exit(1);
}

const password = randomPassword();
const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (user) {
  db.prepare("UPDATE users SET hash = ?, role = 'admin', active = 1, must_change = 1 WHERE id = ?").run(hashPassword(password), user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
} else {
  db.prepare("INSERT INTO users (email, name, role, hash, must_change, created_at) VALUES (?, 'Administrator', 'admin', ?, 1, ?)")
    .run(email, hashPassword(password), now());
}
console.log(`${email} can now sign in at /admin with this temporary password:\n\n  ${password}\n`);
db.close();
