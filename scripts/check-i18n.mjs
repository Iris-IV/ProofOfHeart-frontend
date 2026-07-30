import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const messagesDir = path.join(__dirname, '../messages');
const srcDir = path.join(__dirname, '../src');

function getAllKeys(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, key) => {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      acc.push(...getAllKeys(value, newKey));
    } else {
      acc.push(newKey);
    }
    return acc;
  }, []);
}

function getAllFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (/\.(ts|tsx)$/.test(file)) {
      files.push(fullPath);
    }
  }
  return files;
}

function checkUnusedKeys() {
  const enPath = path.join(messagesDir, 'en.json');
  const enObj = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const allKeys = getAllKeys(enObj);

  const files = getAllFiles(srcDir);
  const fileContents = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

  const unusedKeys = [];

  for (const fullKey of allKeys) {
    const parts = fullKey.split('.');
    const key = parts[parts.length - 1];
    const namespace = parts.length > 1 ? parts[0] : '';

    // Check if the key appears in the source code
    // It could be t('key') or t("key") or next-intl dynamic keys
    // We'll just do a simple substring check for the key
    // For dynamic keys like step_connect_icon, they might not appear.
    // So if the key itself doesn't appear, we flag it.
    if (!fileContents.includes(key)) {
      unusedKeys.push(fullKey);
    }
  }

  // Filter out known dynamic keys to avoid false positives
  const knownDynamicPrefixes = ['step_'];
  const filteredUnused = unusedKeys.filter((k) => {
    const key = k.split('.').pop();
    return !knownDynamicPrefixes.some((prefix) => key.startsWith(prefix));
  });

  if (filteredUnused.length > 0) {
    console.warn('⚠️  Potentially unused translation keys found:');
    filteredUnused.forEach((k) => console.warn(`  - ${k}`));
  } else {
    console.log('✅ No unused translation keys detected.');
  }
}

checkUnusedKeys();
