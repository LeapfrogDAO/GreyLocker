# Greylocker Deployment Guide

Welcome to the neon-lit frontier of Solana—where Greylocker, a fortress of privacy and power, rises from the blockchain’s depths. This guide is your blueprint to build, test, and deploy the Greylocker program, a revolutionary ecosystem where users stake GREY tokens, services pay for data access, and disputes are settled with slashing precision. Strap in, because we’re about to ignite a privacy revolution at 50,000 TPS.

---

## Prerequisites

Before you jack into the grid, ensure your rig is loaded with these tools:

1. **[Rust](https://www.rust-lang.org/tools/install)** - Latest stable version. The language of precision for Solana’s BPF bytecode.
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
2. **[Solana CLI Tools](https://docs.solanalabs.com/cli/install)** - Latest version. Your command-line uplink to the blockchain.
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
   ```
3. **[Anchor Framework](https://www.anchor-lang.com/docs/installation)** - Latest version (e.g., 0.28.0). The scaffolding for Solana’s smart contracts.
   ```bash
   cargo install --git https://github.com/coral-xyz/anchor anchor-cli --locked
   ```
4. **[Node.js](https://nodejs.org/)** - v16+ with npm/yarn. For testing and deployment scripts.
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   npm install -g yarn
   ```

Ensure your PATH includes these tools:
```bash
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

---

## Project Structure

Greylocker’s codebase is a cybernetic organism—structured for efficiency and power:

```
greylocker/
├── Anchor.toml              # Anchor config: cluster, program ID, scripts
├── programs/                # Core program logic
│   └── greylocker/
│       ├── Cargo.toml       # Rust dependencies (Anchor, SPL Token)
│       └── src/
│           ├── lib.rs       # Program entrypoint and logic
│           └── accounts.rs  # Account structs, enums, contexts
├── app/                     # Optional frontend (React, etc.)
│   ├── src/
│   └── package.json
├── tests/                   # Test suite
│   └── greylocker.ts
└── migrations/              # Deployment scripts
    └── deploy.ts
```

---

## Building the Program

Forge Greylocker’s steel heart with these steps:

1. **Initialize the Project**
   ```bash
   anchor init greylocker
   cd greylocker
   ```

2. **Configure `Anchor.toml`**
   Replace the default with this electrified config:
   ```toml
   [features]
   seeds = true
   skip-lint = false

   [programs.devnet]
   greylocker = "GREY1ockrXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" # Replace with your program ID

   [registry]
   url = "https://api.apr.dev"

   [provider]
   cluster = "devnet"
   wallet = "~/.config/solana/id.json"

   [scripts]
   test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"
   build = "anchor build"
   deploy = "anchor deploy --provider.cluster devnet && yarn run deploy"
   ```

3. **Generate a Program ID**
   ```bash
   solana-keygen new -o target/deploy/greylocker-keypair.json
   solana address -k target/deploy/greylocker-keypair.json
   ```
   Update `declare_id!("GREY1ockrXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")` in `lib.rs` with the generated ID.

4. **Install Dependencies**
   Update `programs/greylocker/Cargo.toml`:
   ```toml
   [package]
   name = "greylocker"
   version = "0.1.0"
   edition = "2021"

   [lib]
   crate-type = ["cdylib", "lib"]
   name = "greylocker"

   [dependencies]
   anchor-lang = "0.28.0"
   anchor-spl = "0.28.0"
   solana-program = "1.18.0"

   [features]
   default = ["cpi"]
   cpi = ["no-entrypoint"]
   ```

5. **Build the Beast**
   ```bash
   anchor build
   ```
   This compiles `lib.rs` and `accounts.rs` into BPF bytecode at `target/deploy/greylocker.so`.

---

## Testing the Program

Test Greylocker’s circuits with a suite that proves its mettle:

1. **Set Up the Test Environment**
   Install test dependencies:
   ```bash
   cd greylocker
   yarn add --dev typescript ts-mocha @types/mocha chai @solana/spl-token
   ```

2. **Create `tests/greylocker.ts`**
   This electrified test suite initializes the program and stakes tokens:
   ```typescript
   // tests/greylocker.ts
   import * as anchor from "@coral-xyz/anchor";
   import { Program } from "@coral-xyz/anchor";
   import { Greylocker } from "../target/types/greylocker";
   import { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
   import { assert } from "chai";

   describe("Greylocker Grid Tests", () => {
     const provider = anchor.AnchorProvider.env();
     anchor.setProvider(provider);
     const program = anchor.workspace.Greylocker as Program<Greylocker>;
     const wallet = provider.wallet as anchor.Wallet;

     let greyMint: anchor.web3.PublicKey;
     let treasuryAccount: anchor.web3.PublicKey;
     let greylockerState: anchor.web3.PublicKey;
     let greylockerStateBump: number;

     before(async () => {
       console.log("Initializing test environment...");
       greyMint = await createMint(
         provider.connection,
         wallet.payer,
         wallet.publicKey,
         null,
         9 // 9 decimals for GREY precision
       );
       console.log("GREY Mint forged:", greyMint.toString());

       const treasuryTokenAccount = await getOrCreateAssociatedTokenAccount(
         provider.connection,
         wallet.payer,
         greyMint,
         wallet.publicKey
       );
       treasuryAccount = treasuryTokenAccount.address;
       console.log("Treasury vault online:", treasuryAccount.toString());

       const [statePda, stateBump] = anchor.web3.PublicKey.findProgramAddressSync(
         [Buffer.from("greylocker-state")],
         program.programId
       );
       greylockerState = statePda;
       greylockerStateBump = stateBump;
       console.log("GreylockerState PDA activated:", greylockerState.toString());
     });

     it("Initializes the Greylocker grid", async () => {
       console.log("Igniting the grid...");
       await program.methods
         .initialize(greylockerStateBump)
         .accounts({
           initializer: wallet.publicKey,
           greyMint: greyMint,
           greylockerState: greylockerState,
           treasury: treasuryAccount,
           systemProgram: anchor.web3.SystemProgram.programId,
           tokenProgram: TOKEN_PROGRAM_ID,
           rent: anchor.web3.SYSVAR_RENT_PUBKEY,
         })
         .rpc();

       const stateAccount = await program.account.greylockerState.fetch(greylockerState);
       assert.equal(stateAccount.greyMint.toString(), greyMint.toString(), "Mint mismatch");
       assert.equal(stateAccount.treasury.toString(), treasuryAccount.toString(), "Treasury mismatch");
       assert.equal(stateAccount.paused, false, "Program paused unexpectedly");
       assert.equal(stateAccount.authority.toString(), wallet.publicKey.toString(), "Authority mismatch");
       assert.equal(stateAccount.governanceAuthority.toString(), wallet.publicKey.toString(), "Governance mismatch");

       const treasuryBalance = await provider.connection.getTokenAccountBalance(treasuryAccount);
       const expectedInitialSupply = (1_000_000_000 * 10**9 / 5).toString(); // 20% of 1B
       assert.equal(treasuryBalance.value.amount, expectedInitialSupply, "Initial supply incorrect");
       console.log("Grid online! Treasury balance:", treasuryBalance.value.uiAmount, "GREY");
     });

     it("Stakes GREY tokens—locking power into the grid", async () => {
       const user = anchor.web3.Keypair.generate();
       await provider.connection.requestAirdrop(user.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL);
       await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for airdrop confirmation

       const userTokenAccount = await getOrCreateAssociatedTokenAccount(
         provider.connection,
         wallet.payer,
         greyMint,
         user.publicKey
       );
       const stakeAmount = new anchor.BN(1000 * 10**9); // 1,000 GREY
       await mintTo(
         provider.connection,
         wallet.payer,
         greyMint,
         userTokenAccount.address,
         wallet.publicKey,
         stakeAmount.toNumber()
       );

       const [stakeAccountPda, stakeAccountBump] = anchor.web3.PublicKey.findProgramAddressSync(
         [Buffer.from("stake-account"), user.publicKey.toBuffer()],
         program.programId
       );
       const [stakeVaultPda, stakeVaultBump] = anchor.web3.PublicKey.findProgramAddressSync(
         [Buffer.from("stake-vault"), stakeAccountPda.toBuffer()],
         program.programId
       );

       const lockPeriod = new anchor.BN(30 * 24 * 60 * 60); // 30 days
       console.log("User staking", stakeAmount.toNumber() / 10**9, "GREY...");
       await program.methods
         .stake(stakeAmount, { security: {} }, lockPeriod)
         .accounts({
           greylockerState: greylockerState,
           user: user.publicKey,
           stakeAccount: stakeAccountPda,
           userTokenAccount: userTokenAccount.address,
           stakeVault: stakeVaultPda,
           greyMint: greyMint,
           systemProgram: anchor.web3.SystemProgram.programId,
           tokenProgram: TOKEN_PROGRAM_ID,
           rent: anchor.web3.SYSVAR_RENT_PUBKEY,
         })
         .signers([user])
         .rpc();

       const stakeAccount = await program.account.stakeAccount.fetch(stakeAccountPda);
       assert.equal(stakeAccount.owner.toString(), user.publicKey.toString(), "Stake owner mismatch");
       assert.ok(stakeAccount.stakeType.security !== undefined, "Stake type not Security");
       assert.equal(stakeAccount.amount.toString(), stakeAmount.toString(), "Stake amount mismatch");

       const vaultBalance = await provider.connection.getTokenAccountBalance(stakeVaultPda);
       assert.equal(vaultBalance.value.amount, stakeAmount.toString(), "Vault balance mismatch");
       console.log("Stake locked in! Vault balance:", vaultBalance.value.uiAmount, "GREY");
     });

     // TODO: Add tests for unstake, claim_rewards, register_service, etc.
   });
   ```

3. **Run the Tests**
   ```bash
   anchor test
   ```
   Watch the console for logs as Greylocker’s circuits hum to life, verifying initialization and staking.

---

## Deploying to Devnet

Launch Greylocker into Solana’s devnet—a proving ground for the grid:

1. **Prepare the Deployment Script**
   Create `migrations/deploy.ts`:
   ```typescript
   // migrations/deploy.ts
   import * as anchor from "@coral-xyz/anchor";
   import { Program } from "@coral-xyz/anchor";
   import { Greylocker } from "../target/types/greylocker";
   import { createMint, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";

   async function deployGreylocker() {
     const provider = anchor.AnchorProvider.env();
     anchor.setProvider(provider);
     const program = anchor.workspace.Greylocker as Program<Greylocker>;
     const wallet = provider.wallet as anchor.Wallet;

     console.log("Deploying Greylocker to devnet...");
     console.log("Program ID:", program.programId.toString());

     const greyMint = await createMint(
       provider.connection,
       wallet.payer,
       wallet.publicKey,
       null,
       9
     );
     console.log("GREY Mint forged:", greyMint.toString());

     const treasuryTokenAccount = await getOrCreateAssociatedTokenAccount(
       provider.connection,
       wallet.payer,
       greyMint,
       wallet.publicKey
     );
     const treasuryAccount = treasuryTokenAccount.address;
     console.log("Treasury vault online:", treasuryAccount.toString());

     const [greylockerState, greylockerStateBump] = anchor.web3.PublicKey.findProgramAddressSync(
       [Buffer.from("greylocker-state")],
       program.programId
     );
     console.log("GreylockerState PDA activated:", greylockerState.toString());

     console.log("Initializing Greylocker grid...");
     await program.methods
       .initialize(greylockerStateBump)
       .accounts({
         initializer: wallet.publicKey,
         greyMint: greyMint,
         greylockerState: greylockerState,
         treasury: treasuryAccount,
         systemProgram: anchor.web3.SystemProgram.programId,
         tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
         rent: anchor.web3.SYSVAR_RENT_PUBKEY,
       })
       .rpc();

     const stateAccount = await program.account.greylockerState.fetch(greylockerState);
     console.log("Grid online! Verification:");
     console.log("  GREY Mint:", stateAccount.greyMint.toString());
     console.log("  Treasury:", stateAccount.treasury.toString());
     console.log("  Authority:", stateAccount.authority.toString());
     console.log("  Governance:", stateAccount.governanceAuthority.toString());

     const treasuryBalance = await provider.connection.getTokenAccountBalance(treasuryAccount);
     console.log("Treasury balance:", treasuryBalance.value.uiAmount, "GREY");

     console.log("Deployment complete! Greylocker is live on devnet.");
   }

   deployGreylocker().then(
     () => process.exit(0),
     (err) => {
       console.error("Deployment failed:", err);
       process.exit(1);
     }
   );
   ```

2. **Update `package.json`**
   ```json
   {
     "scripts": {
       "test": "anchor test",
       "build": "anchor build",
       "deploy": "anchor deploy --provider.cluster devnet && yarn run ts-node migrations/deploy.ts"
     },
     "dependencies": {
       "@coral-xyz/anchor": "^0.28.0",
       "@solana/spl-token": "^0.3.8"
     },
     "devDependencies": {
       "typescript": "^5.0.0",
       "ts-node": "^10.9.1",
       "ts-mocha": "^10.0.0",
       "@types/mocha": "^10.0.1",
       "chai": "^4.3.7"
     }
   }
   ```

3. **Deploy to Devnet**
   ```bash
   # Fund your wallet with devnet SOL
   solana airdrop 5 --url devnet
   # Deploy the program binary
   anchor deploy --provider.cluster devnet
   # Initialize the program
   yarn deploy
   ```
   Watch the logs as Greylocker’s grid lights up devnet, minting GREY and seeding the treasury.

---

## Interacting with the Deployed Program

Jack into the live grid with this client-side uplink:

### Example: Registering a Service Provider
```typescript
// scripts/register-service.ts
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Greylocker } from "../target/types/greylocker";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";

async function registerService() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Greylocker as Program<Greylocker>;
  const wallet = provider.wallet as anchor.Wallet;

  const greyMint = new anchor.web3.PublicKey("YOUR_GREY_MINT_ADDRESS"); // From deployment logs
  const [greylockerState] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("greylocker-state")],
    program.programId
  );

  const userTokenAccount = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    wallet.payer,
    greyMint,
    wallet.publicKey
  );

  const [stakeAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("stake-account"), wallet.publicKey.toBuffer()],
    program.programId
  );
  const [stakeVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("stake-vault"), stakeAccountPda.toBuffer()],
    program.programId
  );

  const stakeAmount = new anchor.BN(10_000 * 10**9); // 10,000 GREY for Service stake
  const lockPeriod = new anchor.BN(90 * 24 * 60 * 60); // 90 days
  console.log("Staking 10,000 GREY for service role...");
  await program.methods
    .stake(stakeAmount, { service: {} }, lockPeriod)
    .accounts({
      greylockerState,
      user: wallet.publicKey,
      stakeAccount: stakeAccountPda,
      userTokenAccount: userTokenAccount.address,
      stakeVault: stakeVaultPda,
      greyMint,
      systemProgram: anchor.web3.SystemProgram.programId,
      tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .rpc();

  const [serviceProviderPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("service-provider"), wallet.publicKey.toBuffer()],
    program.programId
  );

  const serviceInfo = {
    name: "Neon Data Hub",
    description: "A privacy-first data aggregator",
    website: "https://neonhub.io",
    dataTypesRequested: [{ browsing: {} }, { location: {} }],
  };

  console.log("Registering Neon Data Hub...");
  await program.methods
    .registerService(serviceInfo)
    .accounts({
      greylockerState,
      user: wallet.publicKey,
      stakeAccount: stakeAccountPda,
      serviceProvider: serviceProviderPda,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  console.log("Service online at:", serviceProviderPda.toString());
}

registerService().then(
  () => console.log("Service registration complete!"),
  (err) => console.error("Error:", err)
);
```

Run it:
```bash
ts-node scripts/register-service.ts
```

---

## Setting Up Governance

Elevate Greylocker with on-chain governance:

1. **SPL Governance Integration**
   - Use Solana’s [SPL Governance](https://spl.solana.com/governance) to create a DAO for parameter updates and dispute resolution.
   - Replace `governance_authority` checks with a governance program ID.

2. **Custom DAO**
   - Extend `GreylockerState` with a `governance_program` field.
   - Implement a voting system in a separate program, linked via CPI calls.

---

## Mainnet Deployment

When the grid’s ready for the big leagues:

1. **Update `Anchor.toml`**
   ```toml
   [provider]
   cluster = "mainnet-beta"
   wallet = "~/.config/solana/id.json"
   ```

2. **Fund Your Wallet**
   - Acquire mainnet SOL via an exchange or faucet (e.g., 5-10 SOL for deployment).

3. **Deploy to Mainnet**
   ```bash
   anchor deploy --provider.cluster mainnet-beta
   yarn deploy
   ```
   - Replace devnet-specific airdrops with real funding in `deploy.ts`.

4. **Verify Deployment**
   - Use Solana Explorer to confirm the program and state accounts.

---

## Monitoring and Maintenance

Keep Greylocker’s grid humming:

1. **Monitoring Tools**
   - **Solana Explorer**: Track transactions at `https://explorer.solana.com`.
   - **Solscan**: Analyze token and account activity at `https://solscan.io`.

2. **Analytics**
   - Track staking totals, dispute resolutions, and data pool participation with off-chain scripts querying the program state.

3. **Documentation**
   - Expand this guide into a full developer portal with API docs and user guides.

4. **Community**
   - Launch a Discord or Telegram for support, with bots echoing program events.

---

## Advanced Enhancements

Push Greylocker beyond the horizon:

1. **Frontend Grid**
   - Build a React/Vue app visualizing stakes, services, and pools in a cyberpunk UI.
   - Example: `yarn create react-app app --template typescript`

2. **Identity Vaults**
   - Implement decentralized vaults using zk-SNARKs, integrating with `pay_access_fee`.

3. **Zero-Knowledge Proofs**
   - Add ZKP for data pool contributions, ensuring anonymity with libraries like `circom`.

4. **HESMS Agents**
   - Deploy cognitive AI agents via a sidecar program for vault security, using CPI to interact with Greylocker.

5. **Security Audit**
   - Engage firms like CertiK or OpenZeppelin before mainnet to harden the grid.

---

This deployment guide is your uplink to the Greylocker ecosystem—a living, breathing network of privacy and power on Solana. From devnet trials to mainnet dominance, you’re now equipped to launch, scale, and maintain this neon-lit juggernaut. Hack the grid, and let GREY reign supreme!
