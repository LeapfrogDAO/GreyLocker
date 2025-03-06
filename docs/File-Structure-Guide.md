# Greylocker Complete File Structure Guide

Welcome to the neon-charged blueprint of Greylocker—a sprawling fortress of privacy and power on Solana’s blockchain. This guide unveils the complete file structure for the Greylocker ecosystem, weaving together three mighty programs: the Main Greylocker Program, the Identity Vault Program, and the Zero-Knowledge Proofs (ZKP) Program. From the root’s pulsing configs to the programs’ steel-clad logic, every directory and file is a node in a grid where data flows encrypted, GREY tokens shimmer, and shadows prove truth. Jack in—this is your map to the machine.

---

## Root Project Structure

The Greylocker root is the grid’s foundation—a nexus of configuration, code, and control:

```
greylocker/
├── Anchor.toml              # Anchor config—defines clusters and program IDs
├── package.json            # Node.js config—scripts and dependencies
├── tsconfig.json           # TypeScript config—compiles the grid’s scripts
├── .gitignore              # Ignores transient files—keeps the grid clean
├── README.md               # The grid’s manifesto—overview and entry point
├── programs/               # Core logic—Main, Vault, and ZKP programs
│   ├── greylocker/         # Main Greylocker—tokenomics and governance
│   ├── greylocker_vault/   # Identity Vault—encrypted data citadels
│   └── greylocker_zkp/     # ZKP—shadow-weaving cryptography
├── app/                    # Frontend—neon-lit UI for the grid
│   └── src/
├── tests/                  # Test suite—proving the grid’s integrity
├── migrations/             # Deployment scripts—launching the grid
└── docs/                   # Documentation—blueprints and lore
```

---

## 1. Main Greylocker Program Files

The Main Greylocker Program is the grid’s central hub—where GREY flows, stakes lock, and governance rules.

```
greylocker/programs/greylocker/
├── Cargo.toml              # Rust config—dependencies and metadata
└── src/
    ├── lib.rs              # Program logic—entrypoint and instructions
    └── accounts.rs         # Account definitions—structs and contexts
```

### File Contents

- **`Cargo.toml`** - Save as `greylocker/programs/greylocker/Cargo.toml`:
  ```toml
  [package]
  name = "greylocker"
  version = "0.1.0"
  description = "Core privacy-first data control platform on Solana"
  edition = "2021"

  [lib]
  crate-type = ["cdylib", "lib"]
  name = "greylocker"

  [features]
  no-entrypoint = []
  no-idl = []
  no-log-ix-name = []
  cpi = ["no-entrypoint"]
  default = []

  [dependencies]
  anchor-lang = "0.28.0"
  anchor-spl = "0.28.0"
  solana-program = "1.18.0"
  ```
  - **Purpose**: Configures the Rust environment, pulling in Anchor for program structure and SPL Token for GREY operations.

- **`lib.rs`** - Save artifact `greylocker-implementation` as `greylocker/programs/greylocker/src/lib.rs`:
  - **Purpose**: The program’s beating heart—defines instructions like `stake`, `pay_access_fee`, and `resolve_dispute`, orchestrating the grid’s pulse.

- **`accounts.rs`** - Save artifact `greylocker-accounts` as `greylocker/programs/greylocker/src/accounts.rs`:
  - **Purpose**: The grid’s skeleton—structs (`GreylockerState`, `StakeAccount`), enums (`StakeType`, `DataType`), and contexts (`Stake`, `PayAccessFee`) for state management.

---

## 2. Identity Vault Program Files

The Identity Vault Program is the grid’s fortress—locking user data in neon-lit citadels.

```
greylocker/programs/greylocker_vault/
├── Cargo.toml              # Rust config—dependencies and metadata
└── src/
    └── lib.rs              # Program logic—vault operations
```

### File Contents

- **`Cargo.toml`** - Save as `greylocker/programs/greylocker_vault/Cargo.toml`:
  ```toml
  [package]
  name = "greylocker_vault"
  version = "0.1.0"
  description = "Decentralized identity vault for Greylocker ecosystem"
  edition = "2021"

  [lib]
  crate-type = ["cdylib", "lib"]
  name = "greylocker_vault"

  [features]
  no-entrypoint = []
  no-idl = []
  no-log-ix-name = []
  cpi = ["no-entrypoint"]
  default = []

  [dependencies]
  anchor-lang = "0.28.0"
  anchor-spl = "0.28.0"
  solana-program = "1.18.0"
  ```
  - **Purpose**: Sets up the Vault’s Rust environment, integrating with SPL Token for GREY payments.

- **`lib.rs`** - Save artifact `identity-vault-implementation` as `greylocker/programs/greylocker_vault/src/lib.rs`:
  - **Purpose**: The vault’s core logic—`initialize_vault`, `store_data`, `grant_access`, and more, securing data with encryption and IPFS.

---

## 3. Zero-Knowledge Proofs Program Files

The ZKP Program is the grid’s shadow weaver—casting cryptographic proofs without revealing secrets.

```
greylocker/programs/greylocker_zkp/
├── Cargo.toml              # Rust config—dependencies and metadata
└── src/
    └── lib.rs              # Program logic—ZKP operations
```

### File Contents

- **`Cargo.toml`** - Save as `greylocker/programs/greylocker_zkp/Cargo.toml`:
  ```toml
  [package]
  name = "greylocker_zkp"
  version = "0.1.0"
  description = "Zero-knowledge proofs for Greylocker privacy"
  edition = "2021"

  [lib]
  crate-type = ["cdylib", "lib"]
  name = "greylocker_zkp"

  [features]
  no-entrypoint = []
  no-idl = []
  no-log-ix-name = []
  cpi = ["no-entrypoint"]
  default = []

  [dependencies]
  anchor-lang = "0.28.0"
  solana-program = "1.18.0"
  ```
  - **Purpose**: Configures the ZKP Rust environment, ready for future cryptographic libraries (e.g., `ark-groth16`).

- **`lib.rs`** - Save artifact `zkp-implementation` as `greylocker/programs/greylocker_zkp/src/lib.rs`:
  - **Purpose**: The shadow’s code—`submit_proof`, `verify_proof`, `generate_credential`, weaving privacy into the grid.

---

## 4. Root Configuration Files

The root files are the grid’s control panel—configuring its pulse and reach:

- **`Anchor.toml`** - Save as `greylocker/Anchor.toml`:
  ```toml
  [features]
  seeds = true
  skip-lint = false

  [programs.devnet]
  greylocker = "GREY1ockrXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  greylocker_vault = "GREY1vauLtXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  greylocker_zkp = "GREY1zkpXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

  [programs.mainnet]
  greylocker = "GREY1ockrXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  greylocker_vault = "GREY1vauLtXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  greylocker_zkp = "GREY1zkpXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

  [registry]
  url = "https://api.apr.dev"

  [provider]
  cluster = "devnet"
  wallet = "~/.config/solana/id.json"

  [scripts]
  test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"
  build = "anchor build"
  deploy = "anchor deploy --provider.cluster devnet"
  ```
  - **Purpose**: Defines program IDs, clusters, and scripts—your command center for deployment.

- **`package.json`** - Save as `greylocker/package.json`:
  ```json
  {
    "name": "greylocker",
    "version": "0.1.0",
    "description": "Privacy-first data control ecosystem on Solana",
    "scripts": {
      "test": "anchor test",
      "build": "anchor build",
      "deploy": "anchor deploy",
      "deploy:devnet": "anchor deploy --provider.cluster devnet",
      "deploy:mainnet": "anchor deploy --provider.cluster mainnet-beta",
      "start": "cd app && yarn start"
    },
    "dependencies": {
      "@coral-xyz/anchor": "^0.28.0",
      "@solana/spl-token": "^0.3.8",
      "@solana/web3.js": "^1.91.0"
    },
    "devDependencies": {
      "@types/bn.js": "^5.1.1",
      "@types/chai": "^4.3.4",
      "@types/mocha": "^10.0.1",
      "chai": "^4.3.7",
      "mocha": "^10.2.0",
      "ts-mocha": "^10.0.0",
      "typescript": "^5.0.0"
    }
  }
  ```
  - **Purpose**: Manages Node.js dependencies and scripts—your toolkit for the grid.

- **`tsconfig.json`** - Save as `greylocker/tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "target": "es2018",
      "module": "commonjs",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "outDir": "./dist",
      "rootDir": "./",
      "types": ["mocha", "chai"]
    },
    "include": ["tests/**/*", "migrations/**/*", "app/**/*"],
    "exclude": ["node_modules"]
  }
  ```
  - **Purpose**: Configures TypeScript—ensuring the grid’s scripts compile with precision.

- **`.gitignore`** - Save as `greylocker/.gitignore`:
  ```
  node_modules/
  target/
  dist/
  .anchor/
  *.log
  .DS_Store
  ```
  - **Purpose**: Keeps the grid clean—ignoring transient files.

- **`README.md`** - Save artifact `greylocker-summary` as `greylocker/README.md`:
  - **Purpose**: The grid’s manifesto—introduces Greylocker and guides new operatives.

---

## 5. Test Files

The test suite is the grid’s proving ground—ensuring every circuit holds:

```
greylocker/tests/
├── greylocker.ts           # Tests Main Greylocker—staking, services, disputes
├── vault.ts                # Tests Identity Vault—data storage, access
└── zkp.ts                  # Tests ZKP—proofs, credentials
```

### File Contents

- **`greylocker.ts`** - Save artifact from deployment guide tests, enhanced with full coverage:
  - **Purpose**: Verifies `initialize`, `stake`, `unstake`, `claim_rewards`, `register_service`, etc.

- **`vault.ts`** - Save as `greylocker/tests/vault.ts`:
  ```typescript
  import * as anchor from '@coral-xyz/anchor';
  import { assert } from 'chai';

  describe('Greylocker Vault Tests', () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.GreylockerVault;

    it('Initializes vault', async () => {
      const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), provider.wallet.publicKey.toBuffer()],
        program.programId
      );
      await program.methods
        .initializeVault('Test Vault', 'Secure Storage')
        .accounts({
          user: provider.wallet.publicKey,
          vault: vaultPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      const vault = await program.account.vault.fetch(vaultPda);
      assert.equal(vault.name, 'Test Vault');
    });

    // Add more tests: store_data, grant_access, etc.
  });
  ```
  - **Purpose**: Tests vault ops—creation, data storage, access granting.

- **`zkp.ts`** - Save as `greylocker/tests/zkp.ts`:
  ```typescript
  import * as anchor from '@coral-xyz/anchor';
  import { assert } from 'chai';

  describe('Greylocker ZKP Tests', () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.GreylockerZkp;

    it('Initializes ZKP registry', async () => {
      const [registryPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from('zkp-registry'), provider.wallet.publicKey.toBuffer()],
        program.programId
      );
      await program.methods
        .initializeRegistry()
        .accounts({
          user: provider.wallet.publicKey,
          zkpRegistry: registryPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      const registry = await program.account.zkpRegistry.fetch(registryPda);
      assert.equal(registry.owner.toBase58(), provider.wallet.publicKey.toBase58());
    });

    // Add more tests: submit_proof, verify_proof, etc.
  });
  ```
  - **Purpose**: Tests ZKP ops—registry setup, proof submission, credential use.

---

## 6. Migration Scripts

The migrations launch the grid into orbit:

```
greylocker/migrations/
├── deploy.ts               # Deploys Main Greylocker
├── deploy-vault.ts         # Deploys Identity Vault
└── deploy-zkp.ts           # Deploys ZKP
```

### File Contents

- **`deploy.ts`** - From deployment guide, enhanced for integration.
- **`deploy-vault.ts`** - Save as `greylocker/migrations/deploy-vault.ts`:
  ```typescript
  import * as anchor from '@coral-xyz/anchor';
  const programId = new anchor.web3.PublicKey('GREY1vauLtXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
  async function deployVault() {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.GreylockerVault as anchor.Program;
    console.log(`Deploying Vault to ${provider.connection.rpcEndpoint} at ${programId.toBase58()}`);
  }
  deployVault().catch(console.error);
  ```
- **`deploy-zkp.ts`** - Save as `greylocker/migrations/deploy-zkp.ts`:
  ```typescript
  import * as anchor from '@coral-xyz/anchor';
  const programId = new anchor.web3.PublicKey('GREY1zkpXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
  async function deployZKP() {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.GreylockerZkp as anchor.Program;
    console.log(`Deploying ZKP to ${provider.connection.rpcEndpoint} at ${programId.toBase58()}`);
  }
  deployZKP().catch(console.error);
  ```

---

## 7. Documentation Files

The docs are the grid’s lore—blueprints for its architects:

```
greylocker/docs/
├── architecture-overview.md    # System design—Greylocker’s blueprint
├── architecture-diagram.md     # Visual map—neon grid layout
├── deployment-guide.md         # Launch manual—ignite the grid
├── integration-guide.md        # Integration lore—unify the triad
└── file-structure-guide.md     # This file—structure of the grid
```

### File Contents

- **`architecture-overview.md`** - Save artifact `greylocker-architecture`.
- **`architecture-diagram.md`** - Placeholder for a visual (e.g., Mermaid diagram).
- **`deployment-guide.md`** - Save artifact `greylocker-deployment`.
- **`integration-guide.md`** - Save artifact `greylocker-integration-guide`.
- **`file-structure-guide.md`** - This document.

---

## 8. Frontend Application Files

The app is the grid’s neon interface—where users command its power:

```
greylocker/app/
├── src/
│   ├── components/             # React components—UI building blocks
│   │   ├── StakePanel.tsx      # Staking controls
│   │   ├── VaultManager.tsx    # Vault management UI
│   │   └── ZKPCreator.tsx      # ZKP generation UI
│   ├── hooks/                  # Custom hooks—state management
│   │   └── useGreylocker.ts    # Greylocker client hook
│   ├── pages/                  # Page routes—user journeys
│   │   ├── Dashboard.tsx       # Main dashboard
│   │   └── Settings.tsx        # User settings
│   ├── utils/                  # Utility scripts—client logic
│   │   ├── greylocker.ts       # Main client—artifact `greylocker-client`
│   │   ├── vault.ts            # Vault client
│   │   └── zkp.ts              # ZKP client
│   └── idl/                    # IDL files—program interfaces
│       ├── greylocker.json     # Main IDL
│       ├── greylocker_vault.json # Vault IDL
│       └── greylocker_zkp.json # ZKP IDL
├── public/                     # Static assets—logos, icons
│   ├── index.html              # Entry HTML
│   └── favicon.ico             # Grid icon
└── package.json                # App-specific config
```

### File Contents

- **`app/package.json`** - Save as `greylocker/app/package.json`:
  ```json
  {
    "name": "greylocker-app",
    "version": "0.1.0",
    "private": true,
    "dependencies": {
      "@coral-xyz/anchor": "^0.28.0",
      "@solana/wallet-adapter-react": "^0.15.0",
      "@solana/web3.js": "^1.91.0",
      "react": "^18.2.0",
      "react-dom": "^18.2.0"
    },
    "scripts": {
      "start": "react-scripts start",
      "build": "react-scripts build",
      "test": "react-scripts test"
    }
  }
  ```
- **`utils/vault.ts`** - Placeholder for Vault client (similar to `greylocker.ts`).
- **`utils/zkp.ts`** - Placeholder for ZKP client (similar to `greylocker.ts`).

---

## Getting Started Commands

Launch the grid with these commands:

```bash
cd greylocker
yarn install
anchor build
anchor test
yarn deploy:devnet
cd app && yarn start
```

---

## Integration with External Code

The app ties the triad together:
- **Main Client**: `greylocker.ts`—handles staking, services, disputes.
- **Vault Client**: `vault.ts`—manages data storage and access.
- **ZKP Client**: `zkp.ts`—generates proofs and credentials.
