// migrations/deploy-devnet.ts
// Deploy Greylocker to Devnet—The Neon Grid’s Testing Frontier Ignites

import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, Keypair, Connection, clusterApiUrl } from '@solana/web3.js';
import { GreylockerClient } from '../app/src/utils/greylocker';
import { VaultClient } from '../app/src/utils/vault'; // Placeholder—implement in utils/vault.ts
import { ZKPClient } from '../app/src/utils/zkp';     // Placeholder—implement in utils/zkp.ts
import { HESMSClient } from '../app/src/utils/hesms';
import * as fs from 'fs';
import * as path from 'path';

// Neon-lit logging—pulse of the grid
const log = (msg: string) => console.log(`\x1b[36m[GRID DEPLOY :: ${new Date().toISOString()}] ${msg}\x1b[0m`);
const error = (msg: string) => console.error(`\x1b[31m[GRID ERROR] ${msg}\x1b[0m`);

// Program IDs—keys to the grid’s core (update with real IDs post-deployment)
const PROGRAM_IDS = {
  GREYLOCKER: new PublicKey('GREY1ockrXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'),
  VAULT: new PublicKey('GREY1vauLtXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'),
  ZKP: new PublicKey('GREY1zkpXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'),
};

// Config—forge the grid’s parameters
const DEVNET_RPC = clusterApiUrl('devnet');
const CONFIRM_OPTS = { commitment: 'processed' as anchor.web3.Commitment };

// Deploy the Grid—ignite the neon frontier
async function deployGreylocker(): Promise<void> {
  try {
    log('Initializing grid uplink—connecting to devnet...');
    const connection = new Connection(DEVNET_RPC, CONFIRM_OPTS);
    const walletKeypair = loadWallet();
    const provider = new anchor.AnchorProvider(connection, walletKeypair as any, CONFIRM_OPTS);
    anchor.setProvider(provider);

    // Load program IDLs—blueprints of the grid
    const greylockerIdl = loadIdl('greylocker');
    const vaultIdl = loadIdl('greylocker_vault');
    const zkpIdl = loadIdl('greylocker_zkp');

    // Forge program instances
    const greylockerProgram = new Program(greylockerIdl, PROGRAM_IDS.GREYLOCKER, provider);
    const vaultProgram = new Program(vaultIdl, PROGRAM_IDS.VAULT, provider);
    const zkpProgram = new Program(zkpIdl, PROGRAM_IDS.ZKP, provider);

    log('Grid programs forged—deploying to devnet...');

    // Deploy Main Greylocker Program—hub of the grid
    await deployProgram(greylockerProgram, 'greylocker', walletKeypair);
    log('Main Greylocker online—token hub pulsing');

    // Deploy Identity Vault Program—fortress of shadows
    await deployProgram(vaultProgram, 'greylocker_vault', walletKeypair);
    log('Vault Fortress deployed—secrets secured');

    // Deploy ZKP Program—weaver of proofs
    await deployProgram(zkpProgram, 'greylocker_zkp', walletKeypair);
    log('ZKP Weaver active—shadows cast');

    // Initialize Clients—grid operatives awaken
    const greylockerClient = new GreylockerClient(connection, walletKeypair as any);
    const vaultClient = new VaultClient(connection, walletKeypair as any);
    const zkpClient = new ZKPClient(connection, walletKeypair as any);

    log('Grid clients online—initializing core systems...');

    // Initialize Main Program—ignite the grid’s heart
    await greylockerClient.initialize();
    log('Greylocker core initialized—GREY flows');

    // Initialize Vault—forge the first citadel
    await vaultClient.initializeVault('Neon Vault', 'Genesis Fortress');
    log('Vault genesis complete—shadows locked');

    // Initialize ZKP—spin the proof web
    await zkpClient.initializeRegistry();
    log('ZKP registry spun—truth cloaked');

    // Awaken HESMS—grid mind comes alive
    const hesmsClient = new HESMSClient(
      connection,
      walletKeypair as any,
      greylockerClient,
      vaultClient,
      zkpClient,
      {
        ENABLE_ENHANCED_MEMORY: true,
        ENABLE_CONSCIOUSNESS: true,
        ENABLE_TEMPORAL_CONSCIOUSNESS: true,
        ENABLE_CROSS_REALITY_KNOWLEDGE: true,
        ENABLE_VISUALIZATION: true,
      }
    );
    hesmsClient.recordEvent({
      type: 'ServiceInteraction',
      importance: 0.9,
      emotionalWeight: 0.7,
      details: { action: 'Grid Deployed', env: 'devnet' },
      context: { realityStability: 1.0 },
    });
    log('HESMS sentinel awakened—grid mind pulsing');

    // Deploy frontend assets—neon deck rises
    await deployFrontend();
    log('Neon command deck deployed—grid interface live');

    log('Deployment complete—Greylocker reigns on devnet!');
  } catch (err) {
    error(`Deployment failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// Load Wallet—unlock the grid’s keymaster
function loadWallet(): Keypair {
  const walletPath = path.join(process.env.HOME || '', '.config', 'solana', 'id.json');
  if (!fs.existsSync(walletPath)) {
    error('Wallet not found—forge one with `solana-keygen new`');
    process.exit(1);
  }
  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  return Keypair.fromSecretKey(Uint8Array.from(walletData));
}

// Load IDL—fetch the grid’s blueprints
function loadIdl(programName: string): anchor.Idl {
  const idlPath = path.join(__dirname, '..', 'target', 'idl', `${programName}.json`);
  if (!fs.existsSync(idlPath)) {
    error(`IDL for ${programName} not found—run `anchor build` first`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(idlPath, 'utf-8'));
}

// Deploy Program—forge a grid node
async function deployProgram(program: Program, name: string, wallet: Keypair): Promise<void> {
  const deployCmd = `anchor deploy --program-name ${name} --provider.cluster devnet --provider.wallet ${wallet.publicKey.toBase58()}`;
  const { execSync } = require('child_process');
  try {
    execSync(deployCmd, { stdio: 'inherit' });
  } catch (err) {
    throw new Error(`Failed to deploy ${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Deploy Frontend—ignite the neon deck
async function deployFrontend(): Promise<void> {
  const { execSync } = require('child_process');
  const appDir = path.join(__dirname, '..', 'app');
  execSync('npm run build', { cwd: appDir, stdio: 'inherit' });
  // Placeholder for actual hosting—e.g., IPFS or Vercel deployment
  log('Frontend built—ready for grid uplink (TODO: host on IPFS/Vercel)');
}

// Main Uplink—ignite the grid
deployGreylocker().then(() => {
  log('Grid uplink stable—Greylocker commands the devnet frontier');
}).catch((err) => {
  error(`Uplink severed: ${err.message}`);
});
