// greylocker/programs/greylocker/src/accounts.rs
// The architectural blueprint of Greylocker—a neon-lit fortress of privacy on Solana

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

// ----- ACCOUNT STRUCTURES -----

/// The central hub of the Greylocker ecosystem, storing global state.
/// This is where the pulse of the privacy revolution beats.
#[account]
#[derive(Default)]
pub struct GreylockerState {
    pub grey_mint: Pubkey,            // The GREY token mint address (32 bytes)
    pub treasury: Pubkey,             // Treasury token account for initial distribution (32 bytes)
    pub paused: bool,                 // Emergency pause switch (1 byte)
    pub total_staked: u64,            // Total tokens staked across all types (8 bytes)
    pub total_supply: u64,            // Current circulating supply (8 bytes)
    pub max_supply: u64,              // Max supply cap: 1 billion GREY (8 bytes)
    pub authority: Pubkey,            // Program authority for admin actions (32 bytes)
    pub governance_authority: Pubkey, // Governance authority for parameter updates (32 bytes)
    pub governance_parameters: GovernanceParameters, // Tunable system parameters (72 bytes)
    pub bump: u8,                     // PDA bump seed for uniqueness (1 byte)
}

impl GreylockerState {
    // Space: 8 (discriminator) + 32 + 32 + 1 + 8 + 8 + 8 + 32 + 32 + 72 + 1 = 194 bytes
    pub const SPACE: usize = 8 + 32 + 32 + 1 + 8 + 8 + 8 + 32 + 32 + 72 + 1;
}

/// Governance parameters—levers of power for the Greylocker grid.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct GovernanceParameters {
    pub security_stake_minimum: u64,       // Min stake for security vaults (8 bytes)
    pub service_stake_minimum: u64,        // Min stake for service providers (8 bytes)
    pub data_validator_stake_minimum: u64, // Min stake for data validators (8 bytes)
    pub liquidity_stake_minimum: u64,      // Min stake for liquidity pools (8 bytes)
    pub security_reward_rate: u64,         // Annual reward rate for security (%) (8 bytes)
    pub data_validator_reward_rate: u64,   // Annual reward rate for validators (%) (8 bytes)
    pub liquidity_reward_rate: u64,        // Annual reward rate for liquidity (%) (8 bytes)
    pub slashing_percentage: u64,          // Slash percentage for violations (8 bytes)
    pub early_unstake_penalty: u64,        // Penalty for early unstaking (%) (8 bytes)
}

impl GovernanceParameters {
    // Space: 8 * 9 = 72 bytes
    pub const SPACE: usize = 8 * 9;
}

/// A user’s stake—a locked vault of power in the Greylocker network.
#[account]
#[derive(Default)]
pub struct StakeAccount {
    pub owner: Pubkey,                // Owner of the stake (32 bytes)
    pub stake_type: StakeType,        // Type: Security, Service, etc. (1 byte + padding = 8 bytes)
    pub amount: u64,                  // Staked GREY amount (8 bytes)
    pub lock_until: i64,              // Unlock timestamp (8 bytes)
    pub last_reward_claim: i64,       // Last reward claim timestamp (8 bytes)
    pub accumulated_rewards: u64,     // Unclaimed rewards (8 bytes)
    pub staked_at: i64,               // Stake creation timestamp (8 bytes)
    pub bump: u8,                     // PDA bump seed (1 byte)
}

impl StakeAccount {
    // Space: 8 (discriminator) + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 1 = 89 bytes
    pub const SPACE: usize = 8 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 1;
}

/// A service provider—data-hungry entities paying for access in GREY.
#[account]
#[derive(Default)]
pub struct ServiceProvider {
    pub owner: Pubkey,                // Service operator (32 bytes)
    pub stake_account: Pubkey,        // Linked stake account (32 bytes)
    pub service_info: ServiceInfo,    // Metadata (variable, ~308 bytes)
    pub registered_at: i64,           // Registration timestamp (8 bytes)
    pub total_access_fees_paid: u64,  // Total fees paid to users (8 bytes)
    pub reputation_score: u8,         // Reputation (0-100) (1 byte)
    pub bump: u8,                     // PDA bump seed (1 byte)
}

impl ServiceProvider {
    // Space: 8 (discriminator) + 32 + 32 + 308 + 8 + 8 + 1 + 1 = 398 bytes
    pub const SPACE: usize = 8 + 32 + 32 + ServiceInfo::SPACE + 8 + 8 + 1 + 1;
}

/// A data pool—anonymized data streams fueling the ecosystem.
#[account]
#[derive(Default)]
pub struct DataPool {
    pub pool_id: Pubkey,              // Unique ID (32 bytes)
    pub name: String,                 // Pool name (4 + 50 bytes = 54 bytes)
    pub data_type: DataType,          // Data type (variable, ~58 bytes)
    pub reward_rate: u64,             // GREY per data point (8 bytes)
    pub description: String,          // Description (4 + 200 bytes = 204 bytes)
    pub created_at: i64,              // Creation timestamp (8 bytes)
    pub total_participants: u64,      // Participant count (8 bytes)
    pub total_rewards_paid: u64,      // Total rewards distributed (8 bytes)
    pub active: bool,                 // Active status (1 byte)
    pub bump: u8,                     // PDA bump seed (1 byte)
}

impl DataPool {
    // Space: 8 (discriminator) + 32 + 54 + 58 + 8 + 204 + 8 + 8 + 8 + 1 + 1 = 390 bytes
    pub const SPACE: usize = 8 + 32 + 54 + 58 + 8 + 204 + 8 + 8 + 8 + 1 + 1;
}

/// A participant in a data pool—earning GREY for their contributions.
#[account]
#[derive(Default)]
pub struct Participant {
    pub user: Pubkey,                 // Participant address (32 bytes)
    pub pool_id: Pubkey,              // Linked pool ID (32 bytes)
    pub joined_at: i64,               // Join timestamp (8 bytes)
    pub total_rewards_received: u64,  // Total rewards earned (8 bytes)
    pub last_reward_at: i64,          // Last reward timestamp (8 bytes)
    pub bump: u8,                     // PDA bump seed (1 byte)
}

impl Participant {
    // Space: 8 (discriminator) + 32 + 32 + 8 + 8 + 8 + 1 = 97 bytes
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1;
}

/// Record of data access—proof of payment in the Greylocker grid.
#[account]
#[derive(Default)]
pub struct AccessRecord {
    pub service_provider: Pubkey,     // Service provider address (32 bytes)
    pub user: Pubkey,                 // User address (32 bytes)
    pub data_type: DataType,          // Accessed data type (variable, ~58 bytes)
    pub amount: u64,                  // Fee paid in GREY (8 bytes)
    pub granted_at: i64,              // Grant timestamp (8 bytes)
    pub expires_at: i64,              // Expiry timestamp (8 bytes)
    pub bump: u8,                     // PDA bump seed (1 byte)
}

impl AccessRecord {
    // Space: 8 (discriminator) + 32 + 32 + 58 + 8 + 8 + 8 + 1 = 155 bytes
    pub const SPACE: usize = 8 + 32 + 32 + 58 + 8 + 8 + 8 + 1;
}

/// A dispute—justice encoded in the blockchain’s neon veins.
#[account]
#[derive(Default)]
pub struct Dispute {
    pub dispute_id: Pubkey,           // Unique ID (32 bytes)
    pub reporter: Pubkey,             // Reporter address (32 bytes)
    pub reported_service: Pubkey,     // Service provider address (32 bytes)
    pub evidence: String,             // Evidence (4 + 1024 bytes = 1028 bytes)
    pub created_at: i64,              // Creation timestamp (8 bytes)
    pub status: DisputeStatus,        // Status (1 byte + padding = 8 bytes)
    pub resolution: Option<DisputeResolution>, // Resolution (1 + 1 byte = 2 bytes)
    pub resolved_at: Option<i64>,     // Resolution timestamp (1 + 8 bytes = 9 bytes)
    pub dispute_type: DisputeType,    // Dispute type (1 byte + padding = 8 bytes)
    pub bump: u8,                     // PDA bump seed (1 byte)
}

impl Dispute {
    // Space: 8 (discriminator) + 32 + 32 + 32 + 1028 + 8 + 8 + 2 + 9 + 8 + 1 = 1168 bytes
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 1028 + 8 + 8 + 2 + 9 + 8 + 1;
}

// ----- ENUM TYPES -----

/// Stake types—roles in the Greylocker ecosystem’s power structure.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum StakeType {
    #[default]
    Security,       // Enhances vault security
    Service,        // Powers service providers
    DataValidator,  // Validates data pools
    Liquidity,      // Fuels liquidity pools
}

/// Data types—categories of user data in the Greylocker network.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum DataType {
    Identity,       // Identity info
    Payment,        // Payment records
    Browsing,       // Browsing history
    Biometric,      // Biometric signatures
    Location,       // Location tracking
    Social,         // Social interactions
    Custom(String), // User-defined type (4 + 50 bytes = 54 bytes)
}

impl Default for DataType {
    fn default() -> Self {
        DataType::Browsing // Default for serialization
    }
}

impl DataType {
    pub const MAX_SPACE: usize = 4 + 50; // Max size for Custom variant
}

/// Dispute status—stages of justice in the Greylocker grid.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum DisputeStatus {
    #[default]
    Pending,        // Awaiting resolution
    Resolved,       // Justice served
}

/// Dispute resolution—verdicts in the neon-lit courtroom.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum DisputeResolution {
    #[default]
    Upheld,         // Violation confirmed, penalty applied
    Rejected,       // Dispute dismissed, no action
}

/// Dispute types—categories of misconduct in the ecosystem.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum DisputeType {
    #[default]
    DataMisuse,     // Misuse of user data
    TermsViolation, // Breach of service terms
    Impersonation,  // False identity
    Other,          // Miscellaneous violations
}

/// Governance parameters—tunable controls for the system’s pulse.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum GovernanceParameter {
    #[default]
    SecurityStakeMinimum,       // Min security stake
    ServiceStakeMinimum,        // Min service stake
    DataValidatorStakeMinimum,  // Min validator stake
    LiquidityStakeMinimum,      // Min liquidity stake
    SecurityRewardRate,         // Security reward rate
    DataValidatorRewardRate,    // Validator reward rate
    LiquidityRewardRate,        // Liquidity reward rate
    SlashingPercentage,         // Slash percentage
    EarlyUnstakePenalty,        // Early unstake penalty
}

/// Authority types—roles wielding power in Greylocker.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum AuthorityType {
    #[default]
    ProgramAuthority,     // Controls program operations
    GovernanceAuthority,  // Manages governance parameters
}

// ----- AUXILIARY STRUCTURES -----

/// Service metadata—identity of data-hungry entities.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct ServiceInfo {
    pub name: String,                          // Service name (4 + 50 bytes = 54 bytes)
    pub description: String,                   // Description (4 + 200 bytes = 204 bytes)
    pub website: String,                       // Website URL (4 + 50 bytes = 54 bytes)
    pub data_types_requested: Vec<DataType>,   // Requested data types (variable, ~4 + 50 bytes)
}

impl ServiceInfo {
    // Space: 54 + 204 + 54 + (4 + 50) = 308 bytes (assuming 1 data type for simplicity)
    pub const SPACE: usize = 54 + 204 + 54 + (4 + DataType::MAX_SPACE);
}

/// Data pool configuration—blueprint for incentivized data sharing.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct DataPoolInfo {
    pub name: String,           // Pool name (4 + 50 bytes = 54 bytes)
    pub data_type: DataType,    // Data type (variable, ~58 bytes)
    pub reward_rate: u64,       // Reward per data point (8 bytes)
    pub description: String,    // Description (4 + 200 bytes = 204 bytes)
}

impl DataPoolInfo {
    // Space: 54 + 58 + 8 + 204 = 324 bytes
    pub const SPACE: usize = 54 + 58 + 8 + 204;
}

// ----- CONTEXT STRUCTURES -----

/// Initialize the Greylocker grid—genesis of the privacy fortress.
#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub initializer: Signer<'info>,
    #[account(
        init,
        payer = initializer,
        mint::decimals = 9,
        mint::authority = greylocker_state
    )]
    pub grey_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = initializer,
        space = GreylockerState::SPACE,
        seeds = [b"greylocker-state"],
        bump
    )]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(
        init,
        payer = initializer,
        token::mint = grey_mint,
        token::authority = initializer
    )]
    pub treasury: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

/// Governance mint—fuel the ecosystem with fresh GREY.
#[derive(Accounts)]
pub struct GovernanceMint<'info> {
    #[account(
        mut,
        seeds = [b"greylocker-state"],
        bump = greylocker_state.bump,
        constraint = governance_authority.key() == greylocker_state.governance_authority @ GreylockerError::NotAuthorized
    )]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(mut)]
    pub grey_mint: Account<'info, Mint>,
    #[account(mut, token::mint = grey_mint)]
    pub recipient: Account<'info, TokenAccount>,
    #[account(mut)]
    pub governance_authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

/// Stake GREY—lock in your power and join the grid.
#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(
        mut,
        seeds = [b"greylocker-state"],
        bump = greylocker_state.bump
    )]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = StakeAccount::SPACE,
        seeds = [b"stake-account", user.key().as_ref()],
        bump
    )]
    pub stake_account: Account<'info, StakeAccount>,
    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ GreylockerError::NotAuthorized,
        constraint = user_token_account.mint == grey_mint.key() @ GreylockerError::InvalidMint
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = user,
        seeds = [b"stake-vault", stake_account.key().as_ref()],
        bump,
        token::mint = grey_mint,
        token::authority = stake_account
    )]
    pub stake_vault: Account<'info, TokenAccount>,
    pub grey_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

/// Unstake GREY—reclaim your tokens, but beware the penalty.
#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(
        mut,
        seeds = [b"greylocker-state"],
        bump = greylocker_state.bump
    )]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"stake-account", user.key().as_ref()],
        bump = stake_account.bump,
        constraint = stake_account.owner == user.key() @ GreylockerError::NotAuthorized
    )]
    pub stake_account: Account<'info, StakeAccount>,
    #[account(
        mut,
        seeds = [b"stake-vault", stake_account.key().as_ref()],
        bump,
        token::mint = grey_mint,
        token::authority = stake_account
    )]
    pub stake_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ GreylockerError::NotAuthorized,
        constraint = user_token_account.mint == grey_mint.key() @ GreylockerError::InvalidMint
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub grey_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

/// Claim staking rewards—reap the neon-lit profits of loyalty.
#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(
        mut,
        seeds = [b"greylocker-state"],
        bump = greylocker_state.bump
    )]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"stake-account", user.key().as_ref()],
        bump = stake_account.bump,
        constraint = stake_account.owner == user.key() @ GreylockerError::NotAuthorized
    )]
    pub stake_account: Account<'info, StakeAccount>,
    #[account(
        mut,
        constraint = user_token_account.owner == user.key() @ GreylockerError::NotAuthorized,
        constraint = user_token_account.mint == grey_mint.key() @ GreylockerError::InvalidMint
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub grey_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

/// Register a service provider—step into the data economy’s spotlight.
#[derive(Accounts)]
pub struct RegisterService<'info> {
    #[account(
        mut,
        seeds = [b"greylocker-state"],
        bump = greylocker_state.bump
    )]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        seeds = [b"stake-account", user.key().as_ref()],
        bump = stake_account.bump,
        constraint = stake_account.owner == user.key() @ GreylockerError::NotAuthorized,
        constraint = stake_account.stake_type == StakeType::Service @ GreylockerError::InvalidStakeType
    )]
    pub stake_account: Account<'info, StakeAccount>,
    #[account(
        init,
        payer = user,
        space = ServiceProvider::SPACE,
        seeds = [b"service-provider", user.key().as_ref()],
        bump
    )]
    pub service_provider: Account<'info, ServiceProvider>,
    pub system_program: Program<'info, System>,
}

/// Pay access fee—services reward users for their data in GREY.
#[derive(Accounts)]
pub struct PayAccessFee<'info> {
    #[account(
        seeds = [b"greylocker-state"],
        bump = greylocker_state.bump
    )]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(
        mut,
        seeds = [b"service-provider", service_owner.key().as_ref()],
        bump = service_provider.bump,
        constraint = service_provider.owner == service_owner.key() @ GreylockerError::NotAuthorized
    )]
    pub service_provider: Account<'info, ServiceProvider>,
    #[account(mut)]
    pub service_owner: Signer<'info>,
    #[account(
        mut,
        constraint = service_token_account.owner == service_owner.key() @ GreylockerError::NotAuthorized,
        constraint = service_token_account.mint == grey_mint.key() @ GreylockerError::InvalidMint
    )]
    pub service_token_account: Account<'info, TokenAccount>,
    /// CHECK: User address, validated by token account ownership
    pub user: AccountInfo<'info>,
    #[account(
        mut,
        constraint = user_token_account.mint == grey_mint.key() @ GreylockerError::InvalidMint
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = service_owner,
        space = AccessRecord::SPACE,
        seeds = [b"access-record", service_provider.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub access_record: Account<'info, AccessRecord>,
    pub grey_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

/// Create a data pool—launch a new stream of anonymized data rewards.
#[derive(Accounts)]
#[instruction(data_pool_index: u8)]
pub struct CreateDataPool<'info> {
    #[account(
        seeds = [b"greylocker-state"],
        bump = greylocker_state.bump,
        constraint = governance_authority.key() == greylocker_state.governance_authority @ GreylockerError::NotAuthorized
    )]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(mut)]
    pub governance_authority: Signer<'info>,
    #[account(
        init,
        payer = governance_authority,
        space = DataPool::SPACE,
        seeds = [b"data-pool", &[data_pool_index]],
        bump
    )]
    pub data_pool: Account<'info, DataPool>,
    pub system_program: Program<'info, System>,
}

/// Join a data pool—opt in and start earning GREY.
#[derive(Accounts)]
pub struct JoinDataPool<'info> {
    #[account(
        seeds = [b"greylocker-state"],
        bump = greylocker_state.bump
    )]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub data_pool: Account<'info, DataPool>,
    #[account(
        init,
        payer = user,
        space = Participant::SPACE,
        seeds = [b"participant", user.key().as_ref(), data_pool.key().as_ref()],
        bump
    )]
    pub participant: Account<'info, Participant>,
    pub system_program: Program<'info, System>,
}

/// Pay data reward—compensate users for their pool contributions.
#[derive(Accounts)]
pub struct PayDataReward<'info> {
    #[account(
        mut,
        seeds = [b"greylocker-state"],
        bump = greylocker_state.bump
    )]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(mut)]
    pub caller: Signer<'info>,
    /// CHECK: Vault authority, validated in instruction logic
    pub vault_authority: AccountInfo<'info>,
    /// CHECK: User being rewarded, validated by participant account
    pub user: AccountInfo<'info>,
    #[account(
        mut,
        constraint = user_token_account.mint == grey_mint.key() @ GreylockerError::InvalidMint
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub data_pool: Account<'info, DataPool>,
    #[account(
        mut,
        seeds = [b"participant", user.key().as_ref(), data_pool.key().as_ref()],
        bump = participant.bump,
        constraint = participant.user == user.key() @ GreylockerError::NotAuthorized,
        constraint = participant.pool_id == data_pool.key() @ GreylockerError::UserNotInDataPool
    )]
    pub participant: Account<'info, Participant>,
    #[account(mut)]
    pub grey_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

/// Create a dispute—call out violations in the Greylocker grid.
#[derive(Accounts)]
#[instruction(dispute_index: u8)]
pub struct CreateDispute<'info> {
    #[account(
        seeds = [b"greylocker-state"],
        bump = greylocker_state.bump
    )]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(mut)]
    pub reporter: Signer<'info>,
    #[account(
        mut,
        seeds = [b"service-provider", service_provider.owner.as_ref()],
        bump = service_provider.bump
    )]
    pub service_provider: Account<'info, ServiceProvider>,
    #[account(
        init,
        payer = reporter,
        space = Dispute::SPACE,
        seeds = [b"dispute", reporter.key().as_ref(), service_provider.key().as_ref(), &[dispute_index]],
        bump
    )]
    pub dispute: Account<'info, Dispute>,
    pub system_program: Program<'info, System>,
}

/// Resolve a dispute—deliver justice in the neon-lit courtroom.
#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(
        seeds = [b"greylocker-state"],
        bump = greylocker_state.bump,
        constraint = resolver.key() == greylocker_state.governance_authority @ GreylockerError::NotAuthorized
    )]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(mut)]
    pub resolver: Signer<'info>,
    #[account(
        mut,
        constraint = dispute.status == DisputeStatus::Pending @ GreylockerError::DisputeAlreadyResolved
    )]
    pub dispute: Account<'info, Dispute>,
    #[account(
        mut,
        seeds = [b"service-provider", service_provider.owner.as_ref()],
        bump = service_provider.bump,
        constraint = dispute.reported_service == service_provider.key() @ GreylockerError::InvalidDispute
    )]
    pub service_provider: Account<'info, ServiceProvider>,
    #[account(
        mut,
        seeds = [b"stake-account", service_provider.owner.as_ref()],
        bump,
        constraint = stake_account.owner == service_provider.owner @ GreylockerError::NotAuthorized
    )]
    pub stake_account: Account<'info, StakeAccount>,
    #[account(
        mut,
        seeds = [b"stake-vault", stake_account.key().as_ref()],
        bump,
        token::mint = grey_mint,
        token::authority = stake_account
    )]
    pub stake_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = reporter_token_account.mint == grey_mint.key() @ GreylockerError::InvalidMint
    )]
    pub reporter_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub grey_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

/// Update governance parameters—tune the ecosystem’s pulse.
#[derive(Accounts)]
pub struct UpdateGovernanceParameter<'info> {
    #[account(
        mut,
        seeds = [b"greylocker-state"],
        bump = greylocker_state.bump,
        constraint = governance_authority.key() == greylocker_state.governance_authority @ GreylockerError::NotAuthorized
    )]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(mut)]
    pub governance_authority: Signer<'info>,
}

/// Pause the program—freeze the grid in an emergency.
#[derive(Accounts)]
pub struct Pause<'info> {
    #[account(
        mut,
        seeds = [b"greylocker-state"],
        bump = greylocker_state.bump,
        constraint = pauser.key() == greylocker_state.authority || pauser.key() == greylocker_state.governance_authority @ GreylockerError::NotAuthorized
    )]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(mut)]
    pub pauser: Signer<'info>,
}

/// Unpause the program—reactivate the neon grid.
#[derive(Accounts)]
pub struct Unpause<'info> {
    #[account(
        mut,
        seeds = [b"greylocker-state"],
        bump = greylocker_state.bump,
        constraint = pauser.key() == greylocker_state.authority || pauser.key() == greylocker_state.governance_authority @ GreylockerError::NotAuthorized
    )]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(mut)]
    pub pauser: Signer<'info>,
}

/// Update authority—shift the reins of power.
#[derive(Accounts)]
#[instruction(authority_type: AuthorityType)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        seeds = [b"greylocker-state"],
        bump = greylocker_state.bump
    )]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(
        constraint = (
            authority_type == AuthorityType::ProgramAuthority && 
            current_authority.key() == greylocker_state.authority ||
            authority_type == AuthorityType::GovernanceAuthority && 
            current_authority.key() == greylocker_state.governance_authority
        ) @ GreylockerError::NotAuthorized
    )]
    pub current_authority: Signer<'info>,
}

// ----- ERRORS -----

/// Errors—warnings from the Greylocker grid’s sentinels.
#[error_code]
pub enum GreylockerError {
    #[msg("Program is paused")]
    ProgramPaused,
    #[msg("Insufficient stake amount")]
    InsufficientStakeAmount,
    #[msg("Tokens are still locked")]
    TokensStillLocked,
    #[msg("Not authorized")]
    NotAuthorized,
    #[msg("Invalid stake type")]
    InvalidStakeType,
    #[msg("Maximum supply reached")]
    MaxSupplyReached,
    #[msg("Arithmetic error")]
    ArithmeticError,
    #[msg("Invalid mint")]
    InvalidMint,
    #[msg("Service not registered")]
    ServiceNotRegistered,
    #[msg("Data pool not found")]
    DataPoolNotFound,
    #[msg("Data pool is inactive")]
    DataPoolInactive,
    #[msg("User not in data pool")]
    UserNotInDataPool,
    #[msg("Dispute already resolved")]
    DisputeAlreadyResolved,
    #[msg("Invalid dispute")]
    InvalidDispute,
    #[msg("Invalid slashing percentage")]
    InvalidSlashingPercentage,
    #[msg("Invalid parameter value")]
    InvalidParameterValue,
    #[msg("No rewards to claim")]
    NoRewardsToClaim,
}

// ----- EVENTS -----

/// Initialize event—birth of the Greylocker grid.
#[event]
pub struct InitializeEvent {
    pub grey_mint: Pubkey,
    pub treasury: Pubkey,
    pub initial_supply: u64,
    pub max_supply: u64,
    pub governance_authority: Pubkey,
}

/// Governance mint event—new GREY enters the ecosystem.
#[event]
pub struct GovernanceMintEvent {
    pub recipient: Pubkey,
    pub amount: u64,
    pub new_total_supply: u64,
}

/// Stake event—a user locks in their power.
#[event]
pub struct StakeEvent {
    pub user: Pubkey,
    pub stake_account: Pubkey,
    pub stake_type: StakeType,
    pub amount: u64,
    pub lock_until: i64,
}

/// Unstake event—freedom reclaimed, penalties paid.
#[event]
pub struct UnstakeEvent {
    pub user: Pubkey,
    pub stake_account: Pubkey,
    pub amount: u64,
    pub penalty_amount: u64,
    pub return_amount: u64,
    pub early_unstake: bool,
}

/// Claim rewards event—profits harvested from the grid.
#[event]
pub struct ClaimRewardsEvent {
    pub user: Pubkey,
    pub stake_account: Pubkey,
    pub rewards_amount: u64,
    pub new_total_supply: u64,
}

/// Register service event—a new player joins the data game.
#[event]
pub struct RegisterServiceEvent {
    pub service_provider: Pubkey,
    pub owner: Pubkey,
    pub stake_account: Pubkey,
    pub service_name: String,
}

/// Pay access fee event—GREY flows for data access.
#[event]
pub struct PayAccessFeeEvent {
    pub service_provider: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub data_type: DataType,
    pub expires_at: i64,
}

/// Create data pool event—a new data stream is born.
#[event]
pub struct CreateDataPoolEvent {
    pub pool_id: Pubkey,
    pub name: String,
    pub data_type: DataType,
    pub reward_rate: u64,
}

/// Join data pool event—a user plugs into the stream.
#[event]
pub struct JoinDataPoolEvent {
    pub user: Pubkey,
    pub pool_id: Pubkey,
    pub pool_name: String,
}

/// Pay data reward event—GREY rewards data contributors.
#[event]
pub struct PayDataRewardEvent {
    pub user: Pubkey,
    pub pool_id: Pubkey,
    pub amount: u64,
    pub new_total_supply: u64,
}

/// Create dispute event—a call for justice echoes through the grid.
#[event]
pub struct CreateDisputeEvent {
    pub dispute_id: Pubkey,
    pub reporter: Pubkey,
    pub reported_service: Pubkey,
    pub dispute_type: DisputeType,
}

/// Resolve dispute event—verdict delivered, consequences enforced.
#[event]
pub struct ResolveDisputeEvent {
    pub dispute_id: Pubkey,
    pub resolver: Pubkey,
    pub resolution: DisputeResolution,
    pub service_provider: Pubkey,
    pub reputation_score: u8,
}

/// Slash event—punishment carved into the blockchain.
#[event]
pub struct SlashEvent {
    pub stake_account: Pubkey,
    pub dispute_id: Pubkey,
    pub slash_amount: u64,
    pub burn_amount: u64,
    pub reporter_amount: u64,
}

/// Update governance parameter event—the system’s pulse is tuned.
#[event]
pub struct UpdateGovernanceParameterEvent {
    pub parameter: GovernanceParameter,
    pub new_value: u64,
    pub authority: Pubkey,
}

/// Pause event—the grid freezes under authority’s command.
#[event]
pub struct PauseEvent {
    pub authority: Pubkey,
}

/// Unpause event—the grid reactivates, alive once more.
#[event]
pub struct UnpauseEvent {
    pub authority: Pubkey,
}

/// Update authority event—power shifts in the neon shadows.
#[event]
pub struct UpdateAuthorityEvent {
    pub authority_type: AuthorityType,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}
