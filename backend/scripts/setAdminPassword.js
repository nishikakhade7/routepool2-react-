// Print the ADMIN_PASSWORD_HASH line for backend/.env:
//   node scripts/setAdminPassword.js 'the password'
// The plaintext is never stored - only this scrypt hash.
const { hashPassword } = require('../src/utils/password');

const password = process.argv[2];
if (!password || password.length < 8) {
  console.error('Usage: node scripts/setAdminPassword.js <password of 8+ characters>');
  process.exit(1);
}
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`);
