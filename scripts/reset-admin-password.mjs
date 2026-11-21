#!/usr/bin/env node
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

function parseArgs(argv) {
  const args = { username: 'admin', password: '' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if ((a === '--username' || a === '-u') && argv[i + 1]) {
      args.username = String(argv[++i]).trim();
    } else if ((a === '--password' || a === '-p') && argv[i + 1]) {
      args.password = String(argv[++i]).trim();
    } else if (!a.startsWith('-') && !args.password) {
      args.password = String(a).trim();
    }
  }
  return args;
}

function hashSecret(plain) {
  const clean = String(plain || '').trim();
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(clean, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function promptQuestion(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function applyAdminResetToState(state, targetUsername, newHash) {
  const next = state && typeof state === 'object' ? { ...state } : {};
  const users = Array.isArray(next.users) ? [...next.users] : [];
  const lowerTarget = targetUsername.toLowerCase();

  let idx = users.findIndex(
    (u) => String(u?.username || '').trim().toLowerCase() === lowerTarget
  );

  // Fallback to first admin account if requested username wasn't found and default 'admin' was used
  if (idx === -1 && lowerTarget === 'admin') {
    idx = users.findIndex((u) => u?.role === 'admin');
  }

  if (idx === -1) {
    const newAdmin = {
      id: `user-admin-${Date.now()}`,
      fullName: 'مدیر کل سیستم',
      username: lowerTarget || 'admin',
      role: 'admin',
      roleTitle: 'مدیر کل فروشگاه',
      phone: '',
      password: newHash,
      pin: newHash,
      isActive: true,
      avatarColor: 'bg-emerald-600',
      permissions: {
        canCreateInvoice: true,
        canEditInvoice: true,
        canDeleteInvoice: true,
        canViewInvoices: true,
        canManageInventory: true,
        canViewBuyPrices: true,
        canManageCustomers: true,
        canViewReports: true,
        canManageSettings: true,
        canManageUsers: true,
        canSettleDebts: true,
      },
    };
    users.unshift(newAdmin);
    idx = 0;
  } else {
    users[idx] = {
      ...users[idx],
      password: newHash,
      pin: newHash,
      isActive: true,
    };
  }

  next.users = users;
  next.revision = (typeof next.revision === 'number' ? next.revision : 1) + 1;
  next.updatedAt = new Date().toISOString();
  next.lastUpdated = Date.now();
  next.checksum = crypto.createHash('sha256').update(JSON.stringify(next, null, 2)).digest('hex');
  return { state: next, updatedUser: users[idx] };
}

async function main() {
  const args = parseArgs(process.argv);
  const username = (args.username || 'admin').trim();
  let newPassword = (args.password || '').trim();

  if (!newPassword) {
    newPassword = await promptQuestion(`🔑 رمز عبور جدید برای کاربر «${username}» را وارد کنید (حداقل ۴ کاراکتر): `);
  }

  if (!newPassword || newPassword.length < 4) {
    console.error('❌ خطا: رمز عبور جدید باید حداقل ۴ کاراکتر باشد.');
    process.exit(1);
  }

  const newHash = hashSecret(newPassword);
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const dbFile = path.join(dataDir, 'database.json');

  let updatedLocal = false;
  let updatedPg = false;
  let updatedUsername = username;

  // 1. Update local database.json if present
  if (fs.existsSync(dbFile)) {
    const raw = fs.readFileSync(dbFile, 'utf-8');
    const parsed = JSON.parse(raw);
    const { state: nextState, updatedUser } = applyAdminResetToState(parsed, username, newHash);
    updatedUsername = updatedUser.username || username;
    const tmpFile = `${dbFile}.tmp.${process.pid}`;
    fs.writeFileSync(tmpFile, JSON.stringify(nextState, null, 2), 'utf-8');
    fs.renameSync(tmpFile, dbFile);
    updatedLocal = true;
    console.log(`✅ فایل محلی (${dbFile}) برای کاربر «${updatedUsername}» به‌روزرسانی شد.`);
  } else {
    console.log(`ℹ️ فایل محلی (${dbFile}) یافت نشد؛ بررسی PostgreSQL...`);
  }

  // 2. Update PostgreSQL system_state if configured (matches server/db.ts row id 'main_store_data')
  const hasPgEnv = Boolean(process.env.DATABASE_URL || process.env.PGHOST || process.env.PGDATABASE);
  if (hasPgEnv) {
    try {
      const pgModule = await import('pg');
      const Pool = pgModule.default?.Pool || pgModule.Pool;
      const pool = new Pool(
        process.env.DATABASE_URL
          ? { connectionString: process.env.DATABASE_URL }
          : {
              host: process.env.PGHOST || 'postgres',
              port: Number(process.env.PGPORT || 5432),
              user: process.env.PGUSER || 'mana_user',
              password: process.env.PGPASSWORD || '',
              database: process.env.PGDATABASE || 'mana_db',
            }
      );

      try {
        const res = await pool.query(
          "SELECT id, data, revision FROM system_state WHERE id IN ('main_store_data', 'main') ORDER BY updated_at DESC LIMIT 1"
        );
        if (res.rows.length > 0 && res.rows[0].data) {
          const rowId = res.rows[0].id;
          const pgState = res.rows[0].data;
          const { state: nextState, updatedUser } = applyAdminResetToState(pgState, username, newHash);
          updatedUsername = updatedUser.username || updatedUsername;
          const nextRev = Math.max(Number(res.rows[0].revision || 1) + 1, Number(nextState.revision || 1));
          nextState.revision = nextRev;
          nextState.checksum = crypto.createHash('sha256').update(JSON.stringify(nextState, null, 2)).digest('hex');

          await pool.query(
            "UPDATE system_state SET data = $1::jsonb, revision = $2, checksum = $3, updated_at = NOW() WHERE id = $4",
            [JSON.stringify(nextState), nextRev, nextState.checksum, rowId]
          );
          updatedPg = true;
          console.log(`✅ پایگاه‌داده PostgreSQL (system_state:${rowId}) برای کاربر «${updatedUsername}» به‌روزرسانی شد (revision=${nextRev}).`);

          // Keep local file revision synced with PostgreSQL if local file exists
          if (fs.existsSync(dbFile)) {
            const tmpFile = `${dbFile}.tmp.${process.pid}`;
            fs.writeFileSync(tmpFile, JSON.stringify(nextState, null, 2), 'utf-8');
            fs.renameSync(tmpFile, dbFile);
          }
        } else {
          console.log('ℹ️ رکورد main_store_data در جدول system_state پایگاه‌داده PostgreSQL یافت نشد.');
        }
      } finally {
        await pool.end();
      }
    } catch (pgErr) {
      console.warn('⚠️ امکان اتصال یا به‌روزرسانی PostgreSQL فراهم نشد:', pgErr?.message || pgErr);
    }
  }

  if (!updatedLocal && !updatedPg) {
    console.error('❌ هیچ پایگاه‌داده‌ای (نه database.json و نه PostgreSQL) برای به‌روزرسانی یافت نشد.');
    process.exit(1);
  }

  console.log(`\n🎉 رمز عبور کاربر «${updatedUsername}» با موفقیت با الگوریتم امن scrypt بازنشانی شد.`);
}

main().catch((err) => {
  console.error('❌ خطای غیرمنتظره:', err?.message || err);
  process.exit(1);
});
