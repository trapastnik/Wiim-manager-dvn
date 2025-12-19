import storage from './storage.js';

console.log('=== TESTING CLEANUP FUNCTION ===\n');

// Show current state
console.log('BEFORE CLEANUP:');
const configBefore = storage.getPlaybackConfig();
console.log('playerSelections:', Object.keys(configBefore.playerSelections || {}).length);
console.log('playerGroups:', (configBefore.playerGroups || []).length);
console.log();

// Run cleanup
console.log('RUNNING CLEANUP...\n');
const result = storage.cleanupPlaybackState();

console.log('RESULT:');
console.log(JSON.stringify(result, null, 2));
console.log();

// Show after state
console.log('AFTER CLEANUP:');
const configAfter = storage.getPlaybackConfig();
console.log('playerSelections:', Object.keys(configAfter.playerSelections || {}).length);
console.log('playerGroups:', (configAfter.playerGroups || []).length);
