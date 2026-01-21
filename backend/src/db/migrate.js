const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    if (command === 'fresh') {
      // Run full schema (drops and recreates everything)
      console.log('🚀 Running fresh migration (full schema)...');
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      await pool.query(schema);
      console.log('✅ Fresh migration completed successfully!');
      
    } else if (command === 'run') {
      // Run a specific migration file
      const migrationFile = args[1];
      if (!migrationFile) {
        console.error('❌ Please specify a migration file. Usage: npm run migrate:run <filename>');
        console.log('   Example: npm run migrate:run 001_add_retirement_accounts.sql');
        process.exit(1);
      }
      
      const migrationPath = path.join(__dirname, 'migrations', migrationFile);
      if (!fs.existsSync(migrationPath)) {
        console.error(`❌ Migration file not found: ${migrationPath}`);
        process.exit(1);
      }
      
      console.log(`🚀 Running migration: ${migrationFile}...`);
      const migration = fs.readFileSync(migrationPath, 'utf-8');
      await pool.query(migration);
      console.log(`✅ Migration ${migrationFile} completed successfully!`);
      
    } else if (command === 'all') {
      // Run all pending migrations in order
      console.log('🚀 Running all migrations...');
      const migrationsDir = path.join(__dirname, 'migrations');
      
      if (!fs.existsSync(migrationsDir)) {
        console.log('No migrations directory found. Creating...');
        fs.mkdirSync(migrationsDir);
        console.log('✅ No migrations to run.');
        return;
      }
      
      const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
      
      if (files.length === 0) {
        console.log('✅ No migrations to run.');
        return;
      }
      
      for (const file of files) {
        console.log(`  📄 Running ${file}...`);
        const migrationPath = path.join(migrationsDir, file);
        const migration = fs.readFileSync(migrationPath, 'utf-8');
        await pool.query(migration);
        console.log(`  ✓ ${file} completed`);
      }
      console.log('✅ All migrations completed successfully!');
      
    } else {
      // Default: show help
      console.log(`
📊 Portfolio Tracker Database Migration Tool

Usage:
  npm run migrate              Show this help message
  npm run migrate:fresh        Run full schema (drops and recreates all tables)
  npm run migrate:all          Run all migrations in the migrations folder
  npm run migrate:run <file>   Run a specific migration file

Examples:
  npm run migrate:fresh
  npm run migrate:all
  npm run migrate:run 001_add_retirement_accounts.sql

Available migrations:
`);
      const migrationsDir = path.join(__dirname, 'migrations');
      if (fs.existsSync(migrationsDir)) {
        const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
        if (files.length > 0) {
          files.forEach(f => console.log(`  - ${f}`));
        } else {
          console.log('  (no migrations found)');
        }
      } else {
        console.log('  (migrations folder not found)');
      }
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.detail) console.error('   Detail:', error.detail);
    throw error;
  } finally {
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));
