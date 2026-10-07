const { readBackup, restore, validateSnapshot } = require('../backend/backups');
(async () => {
  const args = process.argv.slice(2);
  if (args.includes('--help') || !args.length) {
    console.log(
      'Usage: npm run restore -- --file <backup.json> --database <new_database> [--dry-run]\nRestore never overwrites an existing database or changes .env. Dry-run validates the backup without connecting to MySQL.',
    );
    return;
  }
  const allowed = new Set(['--file', '--database', '--dry-run']);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!allowed.has(key) || Object.hasOwn(options, key))
      throw new Error('Unknown or repeated option. Run with --help.');
    if (key === '--dry-run') options[key] = true;
    else {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error('Missing option value.');
      options[key] = value;
    }
  }
  if (!options['--file']) throw new Error('Choose a backup file with --file.');
  const snapshot = await readBackup(options['--file']);
  if (options['--dry-run']) {
    console.log(JSON.stringify({ valid: true, records: validateSnapshot(snapshot) }, null, 2));
    return;
  }
  if (!options['--database']) throw new Error('Choose a new database with --database.');
  console.log(JSON.stringify(await restore(snapshot, options['--database']), null, 2));
  console.log(
    'Recovery is complete. Your current database and .env were not changed. To use the recovered copy, set DB_NAME in .env to the new name and restart Waypoint.',
  );
})().catch((error) => {
  console.error('Restore failed:', error.message);
  process.exitCode = 1;
});
