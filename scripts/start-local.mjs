import { networkInterfaces } from 'os';
import { spawn } from 'child_process';
import chalk from 'chalk';

// Find the local LAN IP address, prioritizing common LAN ranges
function getLocalIp() {
  const interfaces = networkInterfaces();
  const candidates = [];
  
  for (const name of Object.keys(interfaces)) {
    // Skip virtual/VPN interfaces if possible (e.g., Hamachi, WSL, Tailscale)
    if (name.toLowerCase().includes('vbox') || 
        name.toLowerCase().includes('virtual') || 
        name.toLowerCase().includes('hamachi') || 
        name.toLowerCase().includes('wsl') ||
        name.toLowerCase().includes('tailscale')) continue;

    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        // Prioritize 192.168.x.x or 10.x.x.x or 172.16-31.x.x
        if (iface.address.startsWith('192.168.') || 
            iface.address.startsWith('10.') || 
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(iface.address)) {
          return iface.address;
        }
        candidates.push(iface.address);
      }
    }
  }
  return candidates[0] || 'localhost';
}

const localIp = getLocalIp();
const webPort = 3000;
const partyPort = 1999;

console.clear();
console.log(chalk.bold.hex('#FF5F1F')('\n  🏠 LOCALHOST PRESENTATION ENGINE'));
console.log(chalk.gray('  ─────────────────────────────────────────────────'));
console.log(chalk.white(`\n  🚀 Starting servers on your local network...`));
console.log(chalk.white(`  📍 Your Local IP: ${chalk.cyan.bold(localIp)}`));

console.log(chalk.white('\n  🖥️  ') + chalk.bold('HOST DASHBOARD:'));
console.log(chalk.cyan(`     http://${localIp}:${webPort}/host/new`));

console.log(chalk.white('\n  📱 ') + chalk.bold('AUDIENCE JOIN LINK:'));
console.log(chalk.cyan(`     http://${localIp}:${webPort}/join`));

console.log(chalk.gray('\n  ─────────────────────────────────────────────────'));
console.log(chalk.yellow('  ⚠️  Note: Ensure all devices are on the same Wi-Fi.'));
console.log(chalk.gray('  ─────────────────────────────────────────────────\n'));

const env = {
  ...process.env,
  NEXT_PUBLIC_MODE: 'local',
  NEXT_PUBLIC_APP_URL: `http://${localIp}:${webPort}`,
  NEXT_PUBLIC_PARTYKIT_HOST: `${localIp}:${partyPort}`,
  PARTYKIT_SERVER_URL: `http://${localIp}:${partyPort}`,
};

// Use npm.cmd on Windows, or npm on others
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const cmd = spawn(npmCmd, [
  'run', 'dev'
], { 
  stdio: 'inherit',
  env,
  shell: true 
});

cmd.on('close', (code) => {
  process.exit(code);
});
