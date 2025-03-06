// app/src/utils/greylocker.ts
// The Greylocker Client—a neon uplink to Solana’s privacy grid

import * as anchor from '@coral-xyz/anchor';
import { Program, web3, BN, Idl } from '@coral-xyz/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import { WalletContextState } from '@solana/wallet-adapter-react';
import { GreylockerIDL } from '../idl/greylocker';

// Program and token addresses—replace with deployed values
export const GREYLOCKER_PROGRAM_ID = new web3.PublicKey('GREY1ockrXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
export const GREY_TOKEN_MINT = new web3.PublicKey('GREY1tokenXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');

// Enums—categories of power in the Greylocker grid
export enum StakeType {
  Security = 'security',
  Service = 'service',
  DataValidator = 'dataValidator',
  Liquidity = 'liquidity',
}

export enum DataType {
  Identity = 'identity',
  Payment = 'payment',
  Browsing = 'browsing',
  Biometric = 'biometric',
  Location = 'location',
  Social = 'social',
  Custom = 'custom',
}

export enum DisputeType {
  DataMisuse = 'dataMisuse',
  TermsViolation = 'termsViolation',
  Impersonation = 'impersonation',
  Other = 'other',
}

export enum DisputeResolution {
  Upheld = 'upheld',
  Rejected = 'rejected',
}

export enum GovernanceParameter {
  SecurityStakeMinimum = 'securityStakeMinimum',
  ServiceStakeMinimum = 'serviceStakeMinimum',
  DataValidatorStakeMinimum = 'dataValidatorStakeMinimum',
  LiquidityStakeMinimum = 'liquidityStakeMinimum',
  SecurityRewardRate = 'securityRewardRate',
  DataValidatorRewardRate = 'dataValidatorRewardRate',
  LiquidityRewardRate = 'liquidityRewardRate',
  SlashingPercentage = 'slashingPercentage',
  EarlyUnstakePenalty = 'earlyUnstakePenalty',
}

// Interfaces—blueprints for the grid’s data streams
export interface ServiceInfo {
  name: string;
  description: string;
  website: string;
  dataTypesRequested: DataType[];
}

export interface DataPoolInfo {
  name: string;
  dataType: DataType;
  rewardRate: number;
  description: string;
}

// Main Greylocker client class—your uplink to the neon grid
export class GreylockerClient {
  program: Program;
  connection: web3.Connection;
  wallet: WalletContextState;
  greylockerState: web3.PublicKey;
  greylockerStateBump: number;

  constructor(connection: web3.Connection, wallet: WalletContextState, idl?: Idl) {
    this.connection = connection;
    this.wallet = wallet;

    // Forge the provider—connect wallet to Solana’s pulse
    const provider = new anchor.AnchorProvider(connection, wallet as any, {
      commitment: 'processed',
      preflightCommitment: 'processed',
    });
    anchor.setProvider(provider);

    // Load the program—ignite the grid’s core
    const resolvedIdl = idl || GreylockerIDL;
    this.program = new Program(resolvedIdl, GREYLOCKER_PROGRAM_ID, provider);

    // Locate the GreylockerState PDA—the grid’s beating heart
    const [statePda, stateBump] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('greylocker-state')],
      GREYLOCKER_PROGRAM_ID
    );
    this.greylockerState = statePda;
    this.greylockerStateBump = stateBump;
  }

  // Ensure wallet is connected—guard the uplink
  private ensureWalletConnected(): void {
    if (!this.wallet.publicKey || !this.wallet.signTransaction) {
      throw new Error('Wallet not connected or signing unavailable');
    }
  }

  // Initialize the program—genesis of the Greylocker grid
  async initialize(): Promise<string> {
    this.ensureWalletConnected();

    const treasuryAccount = await this.getOrCreateTokenAccount(this.wallet.publicKey);
    const tx = await this.program.methods
      .initialize(this.greylockerStateBump)
      .accounts({
        initializer: this.wallet.publicKey,
        greyMint: GREY_TOKEN_MINT,
        greylockerState: this.greylockerState,
        treasury: treasuryAccount,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    console.log(`Grid initialized! Tx: ${tx}`);
    return tx;
  }

  // Mint GREY tokens—forge new power for the ecosystem (governance only)
  async governanceMint(recipientAddress: web3.PublicKey, amount: number): Promise<string> {
    this.ensureWalletConnected();

    const recipientTokenAccount = await this.getOrCreateTokenAccount(recipientAddress);
    const amountBN = new BN(amount * 10 ** 9);

    const tx = await this.program.methods
      .governanceMint(amountBN)
      .accounts({
        greylockerState: this.greylockerState,
        greyMint: GREY_TOKEN_MINT,
        recipient: recipientTokenAccount,
        governanceAuthority: this.wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log(`GREY minted: ${amount} to ${recipientAddress.toBase58()} | Tx: ${tx}`);
    return tx;
  }

  // Stake GREY—lock power into the grid’s neon veins
  async stake(amount: number, stakeType: StakeType, lockPeriodInDays: number): Promise<string> {
    this.ensureWalletConnected();

    const lockPeriod = new BN(lockPeriodInDays * 24 * 60 * 60);
    const amountBN = new BN(amount * 10 ** 9);
    const userTokenAccount = await this.getOrCreateTokenAccount(this.wallet.publicKey);
    const [stakeAccountPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('stake-account'), this.wallet.publicKey.toBuffer()],
      GREYLOCKER_PROGRAM_ID
    );
    const [stakeVaultPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('stake-vault'), stakeAccountPda.toBuffer()],
      GREYLOCKER_PROGRAM_ID
    );

    const stakeTypeObj: any = { [stakeType]: {} };
    const tx = await this.program.methods
      .stake(amountBN, stakeTypeObj, lockPeriod)
      .accounts({
        greylockerState: this.greylockerState,
        user: this.wallet.publicKey,
        stakeAccount: stakeAccountPda,
        userTokenAccount,
        stakeVault: stakeVaultPda,
        greyMint: GREY_TOKEN_MINT,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    console.log(`Staked ${amount} GREY as ${stakeType} for ${lockPeriodInDays} days | Tx: ${tx}`);
    return tx;
  }

  // Unstake GREY—reclaim power from the grid
  async unstake(amount: number): Promise<string> {
    this.ensureWalletConnected();

    const amountBN = new BN(amount * 10 ** 9);
    const userTokenAccount = await this.getOrCreateTokenAccount(this.wallet.publicKey);
    const [stakeAccountPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('stake-account'), this.wallet.publicKey.toBuffer()],
      GREYLOCKER_PROGRAM_ID
    );
    const [stakeVaultPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('stake-vault'), stakeAccountPda.toBuffer()],
      GREYLOCKER_PROGRAM_ID
    );

    const tx = await this.program.methods
      .unstake(amountBN)
      .accounts({
        greylockerState: this.greylockerState,
        user: this.wallet.publicKey,
        stakeAccount: stakeAccountPda,
        stakeVault: stakeVaultPda,
        userTokenAccount,
        greyMint: GREY_TOKEN_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log(`Unstaked ${amount} GREY | Tx: ${tx}`);
    return tx;
  }

  // Claim staking rewards—harvest the grid’s neon bounty
  async claimStakeRewards(): Promise<string> {
    this.ensureWalletConnected();

    const userTokenAccount = await this.getOrCreateTokenAccount(this.wallet.publicKey);
    const [stakeAccountPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('stake-account'), this.wallet.publicKey.toBuffer()],
      GREYLOCKER_PROGRAM_ID
    );

    const tx = await this.program.methods
      .claimRewards() // Updated to match IDL method name
      .accounts({
        greylockerState: this.greylockerState,
        user: this.wallet.publicKey,
        stakeAccount: stakeAccountPda,
        userTokenAccount,
        greyMint: GREY_TOKEN_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log(`Rewards claimed | Tx: ${tx}`);
    return tx;
  }

  // Register a service—join the data-hungry ranks
  async registerService(serviceInfo: ServiceInfo): Promise<string> {
    this.ensureWalletConnected();

    const [stakeAccountPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('stake-account'), this.wallet.publicKey.toBuffer()],
      GREYLOCKER_PROGRAM_ID
    );
    const [serviceProviderPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('service-provider'), this.wallet.publicKey.toBuffer()],
      GREYLOCKER_PROGRAM_ID
    );

    const dataTypesRequested = serviceInfo.dataTypesRequested.map((type) => ({ [type]: {} }));
    const tx = await this.program.methods
      .registerService({
        name: serviceInfo.name,
        description: serviceInfo.description,
        website: serviceInfo.website,
        dataTypesRequested,
      })
      .accounts({
        greylockerState: this.greylockerState,
        user: this.wallet.publicKey,
        stakeAccount: stakeAccountPda,
        serviceProvider: serviceProviderPda,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();
    console.log(`Service "${serviceInfo.name}" registered | Tx: ${tx}`);
    return tx;
  }

  // Pay access fee—trade GREY for data shadows
  async payAccessFee(
    userAddress: web3.PublicKey,
    amount: number,
    dataType: DataType,
    durationInHours: number
  ): Promise<string> {
    this.ensureWalletConnected();

    const amountBN = new BN(amount * 10 ** 9);
    const duration = new BN(durationInHours * 60 * 60);
    const serviceTokenAccount = await this.getOrCreateTokenAccount(this.wallet.publicKey);
    const userTokenAccount = await this.getOrCreateTokenAccount(userAddress);
    const [serviceProviderPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('service-provider'), this.wallet.publicKey.toBuffer()],
      GREYLOCKER_PROGRAM_ID
    );
    const [accessRecordPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('access-record'), serviceProviderPda.toBuffer(), userAddress.toBuffer()],
      GREYLOCKER_PROGRAM_ID
    );

    const dataTypeObj: any = { [dataType]: {} };
    const tx = await this.program.methods
      .payAccessFee(amountBN, dataTypeObj)
      .accounts({
        greylockerState: this.greylockerState,
        serviceProvider: serviceProviderPda,
        serviceOwner: this.wallet.publicKey,
        serviceTokenAccount,
        user: userAddress,
        userTokenAccount,
        accessRecord: accessRecordPda,
        greyMint: GREY_TOKEN_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
        rent: web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    console.log(`Paid ${amount} GREY for ${dataType} access | Tx: ${tx}`);
    return tx;
  }

  // Create a data pool—spawn a neon stream of rewards (governance only)
  async createDataPool(poolInfo: DataPoolInfo, poolIndex: number): Promise<string> {
    this.ensureWalletConnected();

    const rewardRateBN = new BN(poolInfo.rewardRate * 10 ** 9);
    const [dataPoolPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('data-pool'), Buffer.from([poolIndex])],
      GREYLOCKER_PROGRAM_ID
    );

    const dataTypeObj: any = { [poolInfo.dataType]: {} };
    const tx = await this.program.methods
      .createDataPool({
        name: poolInfo.name,
        dataType: dataTypeObj,
        rewardRate: rewardRateBN,
        description: poolInfo.description,
      })
      .accounts({
        greylockerState: this.greylockerState,
        governanceAuthority: this.wallet.publicKey,
        dataPool: dataPoolPda,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();
    console.log(`Data pool "${poolInfo.name}" created | Tx: ${tx}`);
    return tx;
  }

  // Join a data pool—plug into the reward stream
  async joinDataPool(dataPoolAddress: web3.PublicKey): Promise<string> {
    this.ensureWalletConnected();

    const [participantPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('participant'), this.wallet.publicKey.toBuffer(), dataPoolAddress.toBuffer()],
      GREYLOCKER_PROGRAM_ID
    );

    const tx = await this.program.methods
      .joinDataPool()
      .accounts({
        greylockerState: this.greylockerState,
        user: this.wallet.publicKey,
        dataPool: dataPoolAddress,
        participant: participantPda,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();
    console.log(`Joined data pool ${dataPoolAddress.toBase58()} | Tx: ${tx}`);
    return tx;
  }

  // Pay data reward—feed the grid’s contributors (vault role only)
  async payDataReward(
    userAddress: web3.PublicKey,
    poolAddress: web3.PublicKey,
    amount: number
  ): Promise<string> {
    this.ensureWalletConnected();

    const amountBN = new BN(amount * 10 ** 9);
    const userTokenAccount = await this.getOrCreateTokenAccount(userAddress);
    const [participantPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('participant'), userAddress.toBuffer(), poolAddress.toBuffer()],
      GREYLOCKER_PROGRAM_ID
    );

    const tx = await this.program.methods
      .payDataReward(amountBN)
      .accounts({
        greylockerState: this.greylockerState,
        caller: this.wallet.publicKey,
        vaultAuthority: this.wallet.publicKey, // Replace with actual vault authority in production
        user: userAddress,
        userTokenAccount,
        dataPool: poolAddress,
        participant: participantPda,
        greyMint: GREY_TOKEN_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log(`Paid ${amount} GREY to ${userAddress.toBase58()} for pool ${poolAddress.toBase58()} | Tx: ${tx}`);
    return tx;
  }

  // Create a dispute—ignite a neon blade of justice
  async createDispute(
    serviceProviderAddress: web3.PublicKey,
    evidence: string,
    disputeType: DisputeType,
    disputeIndex: number
  ): Promise<string> {
    this.ensureWalletConnected();

    const [disputePda] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from('dispute'),
        this.wallet.publicKey.toBuffer(),
        serviceProviderAddress.toBuffer(),
        Buffer.from([disputeIndex]),
      ],
      GREYLOCKER_PROGRAM_ID
    );

    const disputeTypeObj: any = { [disputeType]: {} };
    const tx = await this.program.methods
      .createDispute(evidence, disputeTypeObj)
      .accounts({
        greylockerState: this.greylockerState,
        reporter: this.wallet.publicKey,
        serviceProvider: serviceProviderAddress,
        dispute: disputePda,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();
    console.log(`Dispute created against ${serviceProviderAddress.toBase58()} | Tx: ${tx}`);
    return tx;
  }

  // Resolve a dispute—wield the plasma blade of verdict (governance only)
  async resolveDispute(
    disputeAddress: web3.PublicKey,
    resolution: DisputeResolution,
    serviceProviderAddress: web3.PublicKey,
    stakeAccountAddress: web3.PublicKey,
    reporterAddress: web3.PublicKey
  ): Promise<string> {
    this.ensureWalletConnected();

    const reporterTokenAccount = await this.getOrCreateTokenAccount(reporterAddress);
    const [stakeVaultPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('stake-vault'), stakeAccountAddress.toBuffer()],
      GREYLOCKER_PROGRAM_ID
    );

    const resolutionObj: any = { [resolution]: {} };
    const tx = await this.program.methods
      .resolveDispute(resolutionObj)
      .accounts({
        greylockerState: this.greylockerState,
        resolver: this.wallet.publicKey,
        dispute: disputeAddress,
        serviceProvider: serviceProviderAddress,
        stakeAccount: stakeAccountAddress,
        stakeVault: stakeVaultPda,
        reporterTokenAccount,
        greyMint: GREY_TOKEN_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log(`Dispute ${disputeAddress.toBase58()} resolved as ${resolution} | Tx: ${tx}`);
    return tx;
  }

  // Update governance parameter—tune the grid’s pulse (governance only)
  async updateGovernanceParameter(parameter: GovernanceParameter, value: number): Promise<string> {
    this.ensureWalletConnected();

    const valueBN = new BN(parameter.includes('Rate') ? value : value * 10 ** 9);
    const parameterObj: any = { [parameter]: {} };

    const tx = await this.program.methods
      .updateGovernanceParameter(parameterObj, valueBN)
      .accounts({
        greylockerState: this.greylockerState,
        governanceAuthority: this.wallet.publicKey,
      })
      .rpc();
    console.log(`Governance parameter ${parameter} updated to ${value} | Tx: ${tx}`);
    return tx;
  }

  // Pause the program—freeze the grid in neon stasis (authority only)
  async pauseProgram(): Promise<string> {
    this.ensureWalletConnected();

    const tx = await this.program.methods
      .pause()
      .accounts({
        greylockerState: this.greylockerState,
        pauser: this.wallet.publicKey,
      })
      .rpc();
    console.log(`Grid paused | Tx: ${tx}`);
    return tx;
  }

  // Unpause the program—reactivate the neon flow (authority only)
  async unpauseProgram(): Promise<string> {
    this.ensureWalletConnected();

    const tx = await this.program.methods
      .unpause()
      .accounts({
        greylockerState: this.greylockerState,
        pauser: this.wallet.publicKey,
      })
      .rpc();
    console.log(`Grid reactivated | Tx: ${tx}`);
    return tx;
  }

  // Fetch program state—peek into the grid’s core
  async getProgramState(): Promise<any> {
    const state = await this.program.account.greylockerState.fetch(this.greylockerState);
    return {
      ...state,
      totalStaked: formatTokenAmount(state.totalStaked),
      totalSupply: formatTokenAmount(state.totalSupply),
      maxSupply: formatTokenAmount(state.maxSupply),
      governanceParameters: {
        ...state.governanceParameters,
        securityStakeMinimum: formatTokenAmount(state.governanceParameters.securityStakeMinimum),
        serviceStakeMinimum: formatTokenAmount(state.governanceParameters.serviceStakeMinimum),
        dataValidatorStakeMinimum: formatTokenAmount(state.governanceParameters.dataValidatorStakeMinimum),
        liquidityStakeMinimum: formatTokenAmount(state.governanceParameters.liquidityStakeMinimum),
        earlyUnstakePenalty: formatTokenAmount(state.governanceParameters.earlyUnstakePenalty),
      },
    };
  }

  // Fetch stake account—inspect a user’s locked power
  async getStakeAccount(userAddress: web3.PublicKey = this.wallet.publicKey!): Promise<any | null> {
    if (!userAddress) throw new Error('User address not provided');

    const [stakeAccountPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('stake-account'), userAddress.toBuffer()],
      GREYLOCKER_PROGRAM_ID
    );

    try {
      const account = await this.program.account.stakeAccount.fetch(stakeAccountPda);
      return {
        ...account,
        amount: formatTokenAmount(account.amount),
        accumulatedRewards: formatTokenAmount(account.accumulatedRewards),
        lockUntil: new Date(account.lockUntil.toNumber() * 1000).toISOString(),
        stakedAt: new Date(account.stakedAt.toNumber() * 1000).toISOString(),
        lastRewardClaim: new Date(account.lastRewardClaim.toNumber() * 1000).toISOString(),
      };
    } catch (error) {
      console.error('Stake account not found:', error);
      return null;
    }
  }

  // Fetch service provider—reveal a data seeker’s profile
  async getServiceProvider(ownerAddress: web3.PublicKey = this.wallet.publicKey!): Promise<any | null> {
    if (!ownerAddress) throw new Error('Owner address not provided');

    const [serviceProviderPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('service-provider'), ownerAddress.toBuffer()],
      GREYLOCKER_PROGRAM_ID
    );

    try {
      const provider = await this.program.account.serviceProvider.fetch(serviceProviderPda);
      return {
        ...provider,
        totalAccessFeesPaid: formatTokenAmount(provider.totalAccessFeesPaid),
        registeredAt: new Date(provider.registeredAt.toNumber() * 1000).toISOString(),
      };
    } catch (error) {
      console.error('Service provider not found:', error);
      return null;
    }
  }

  // Fetch all data pools—map the grid’s reward streams
  async getAllDataPools(): Promise<any[]> {
    const pools = await this.program.account.dataPool.all();
    return pools.map((pool) => ({
      publicKey: pool.publicKey.toBase58(),
      ...pool.account,
      rewardRate: formatTokenAmount(pool.account.rewardRate),
      totalRewardsPaid: formatTokenAmount(pool.account.totalRewardsPaid),
      createdAt: new Date(pool.account.createdAt.toNumber() * 1000).toISOString(),
    }));
  }

  // Fetch participant—check a user’s pool status
  async getParticipant(userAddress: web3.PublicKey, poolAddress: web3.PublicKey): Promise<any | null> {
    const [participantPda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from('participant'), userAddress.toBuffer(), poolAddress.toBuffer()],
      GREYLOCKER_PROGRAM_ID
    );

    try {
      const participant = await this.program.account.participant.fetch(participantPda);
      return {
        ...participant,
        totalRewardsReceived: formatTokenAmount(participant.totalRewardsReceived),
        joinedAt: new Date(participant.joinedAt.toNumber() * 1000).toISOString(),
        lastRewardAt: new Date(participant.lastRewardAt.toNumber() * 1000).toISOString(),
      };
    } catch (error) {
      console.error('Participant not found:', error);
      return null;
    }
  }

  // Fetch dispute—examine a neon blade of justice
  async getDispute(disputeAddress: web3.PublicKey): Promise<any | null> {
    try {
      const dispute = await this.program.account.dispute.fetch(disputeAddress);
      return {
        ...dispute,
        createdAt: new Date(dispute.createdAt.toNumber() * 1000).toISOString(),
        resolvedAt: dispute.resolvedAt ? new Date(dispute.resolvedAt.toNumber() * 1000).toISOString() : null,
      };
    } catch (error) {
      console.error('Dispute not found:', error);
      return null;
    }
  }

  // Get GREY balance—count a user’s neon wealth
  async getGreyBalance(ownerAddress: web3.PublicKey = this.wallet.publicKey!): Promise<number> {
    if (!ownerAddress) throw new Error('Owner address not provided');

    try {
      const tokenAccount = await getAssociatedTokenAddress(GREY_TOKEN_MINT, ownerAddress);
      const balance = await this.connection.getTokenAccountBalance(tokenAccount);
      return balance.value.uiAmount || 0;
    } catch (error) {
      console.error('Error fetching GREY balance:', error);
      return 0;
    }
  }

  // Helper: Get or create token account—ensure the grid’s conduits are open
  private async getOrCreateTokenAccount(owner: web3.PublicKey): Promise<web3.PublicKey> {
    const tokenAccount = await getAssociatedTokenAddress(GREY_TOKEN_MINT, owner);
    const accountInfo = await this.connection.getAccountInfo(tokenAccount);

    if (!accountInfo) {
      const tx = new web3.Transaction().add(
        createAssociatedTokenAccountInstruction(
          this.wallet.publicKey!,
          tokenAccount,
          owner,
          GREY_TOKEN_MINT
        )
      );
      const signature = await this.wallet.sendTransaction(tx, this.connection);
      await this.connection.confirmTransaction(signature, 'processed');
      console.log(`Created token account for ${owner.toBase58()} | Tx: ${signature}`);
    }

    return tokenAccount;
  }
}

// Helpers—tools to navigate the neon grid
export function formatTokenAmount(amount: BN | number): number {
  return typeof amount === 'number' ? amount / 10 ** 9 : amount.toNumber() / 10 ** 9;
}

export function secondsToDays(seconds: number | BN): number {
  const sec = typeof seconds === 'number' ? seconds : seconds.toNumber();
  return Math.floor(sec / (24 * 60 * 60));
}

export function daysToSeconds(days: number): number {
  return days * 24 * 60 * 60;
}

export function formatTimestamp(timestamp: number | BN): string {
  const time = typeof timestamp === 'number' ? timestamp : timestamp.toNumber();
  return new Date(time * 1000).toISOString();
}

// Utility: Check if user has governance authority
export async function hasGovernanceAuthority(
  client: GreylockerClient,
  address: web3.PublicKey = client.wallet.publicKey!
): Promise<boolean> {
  try {
    const state = await client.getProgramState();
    return state.governanceAuthority.toBase58() === address.toBase58();
  } catch (error) {
    console.error('Error checking governance authority:', error);
    return false;
  }
}
