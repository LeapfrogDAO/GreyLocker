// lib.rs - The beating heart of Greylocker, a privacy-first Solana ecosystem
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, Burn, MintTo};
use solana_program::{
    program::{invoke, invoke_signed},
    system_instruction,
    sysvar::{clock::Clock, rent::Rent},
};

// Declare the program ID (replace with your actual deployed ID)
declare_id!("GREY1ockrXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

#[program]
pub mod greylocker {
    use super::*;

    /// Initialize the Greylocker program and mint the GREY token
    /// This is the genesis moment—where the privacy revolution begins!
    pub fn initialize(ctx: Context<Initialize>, bump: u8) -> Result<()> {
        let state = &mut ctx.accounts.greylocker_state;
        
        // Set up core state
        state.grey_mint = ctx.accounts.grey_mint.key();
        state.treasury = ctx.accounts.treasury.key();
        state.paused = false;
        state.total_staked = 0;
        state.total_supply = 0;
        state.max_supply = 1_000_000_000 * 10u64.pow(9); // 1B GREY, 9 decimals
        state.authority = ctx.accounts.initializer.key();
        state.governance_authority = ctx.accounts.initializer.key();
        state.bump = bump;

        // Initialize governance parameters with defaults
        state.governance_parameters = GovernanceParameters {
            security_stake_minimum: 100 * 10u64.pow(9),         // 100 GREY
            service_stake_minimum: 10_000 * 10u64.pow(9),      // 10K GREY
            data_validator_stake_minimum: 5_000 * 10u64.pow(9), // 5K GREY
            liquidity_stake_minimum: 1_000 * 10u64.pow(9),     // 1K GREY
            security_reward_rate: 5,                           // 5% APR
            data_validator_reward_rate: 10,                    // 10% APR
            liquidity_reward_rate: 8,                          // 8% APR
            slashing_percentage: 50,                           // 50% slash
            early_unstake_penalty: 10,                         // 10% penalty
            reward_update_interval: 7 * 24 * 60 * 60,          // 7 days in seconds
        };

        // Mint 20% of max supply to treasury (200M GREY)
        let initial_mint = state.max_supply / 5;
        let seeds = &[b"greylocker-state", &[bump]];
        let signer = &[&seeds[..]];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.grey_mint.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                    authority: ctx.accounts.greylocker_state.to_account_info(),
                },
                signer,
            ),
            initial_mint,
        )?;

        state.total_supply = initial_mint;

        emit!(InitializeEvent {
            grey_mint: state.grey_mint,
            treasury: state.treasury,
            initial_supply: initial_mint,
            max_supply: state.max_supply,
            governance_authority: state.governance_authority,
        });

        Ok(())
    }

    /// Stake GREY tokens—lock in your power and join the ecosystem!
    pub fn stake(ctx: Context<Stake>, amount: u64, stake_type: StakeType, lock_period: i64) -> Result<()> {
        require!(!ctx.accounts.greylocker_state.paused, GreylockerError::ProgramPaused);

        let state = &ctx.accounts.greylocker_state;
        let min_stake = match stake_type {
            StakeType::Security => state.governance_parameters.security_stake_minimum,
            StakeType::Service => state.governance_parameters.service_stake_minimum,
            StakeType::DataValidator => state.governance_parameters.data_validator_stake_minimum,
            StakeType::Liquidity => state.governance_parameters.liquidity_stake_minimum,
        };
        require!(amount >= min_stake, GreylockerError::InsufficientStakeAmount);

        let clock = Clock::get()?;
        let stake_account = &mut ctx.accounts.stake_account;
        stake_account.owner = ctx.accounts.user.key();
        stake_account.stake_type = stake_type;
        stake_account.amount = amount;
        stake_account.lock_until = clock.unix_timestamp + lock_period;
        stake_account.last_reward_claim = clock.unix_timestamp;
        stake_account.accumulated_rewards = 0;
        stake_account.staked_at = clock.unix_timestamp;
        stake_account.bump = *ctx.bumps.get("stake_account").unwrap();

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.stake_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        ctx.accounts.greylocker_state.total_staked = state.total_staked
            .checked_add(amount)
            .ok_or(GreylockerError::ArithmeticError)?;

        emit!(StakeEvent {
            user: ctx.accounts.user.key(),
            stake_account: stake_account.key(),
            stake_type,
            amount,
            lock_until: stake_account.lock_until,
        });

        Ok(())
    }

    /// Unstake GREY tokens—claim your freedom, but beware the penalty!
    pub fn unstake(ctx: Context<Unstake>, amount: u64) -> Result<()> {
        require!(!ctx.accounts.greylocker_state.paused, GreylockerError::ProgramPaused);

        let clock = Clock::get()?;
        let stake_account = &mut ctx.accounts.stake_account;
        require!(stake_account.owner == ctx.accounts.user.key(), GreylockerError::NotAuthorized);
        require!(amount <= stake_account.amount, GreylockerError::InsufficientStakeAmount);

        let early_unstake = clock.unix_timestamp < stake_account.lock_until;
        let penalty = if early_unstake {
            amount
                .checked_mul(ctx.accounts.greylocker_state.governance_parameters.early_unstake_penalty as u64)
                .and_then(|val| val.checked_div(100))
                .ok_or(GreylockerError::ArithmeticError)?
        } else {
            0
        };
        let return_amount = amount.checked_sub(penalty).ok_or(GreylockerError::ArithmeticError)?;

        // Calculate and update rewards before unstaking
        let rewards = Self::calculate_rewards(&ctx.accounts.greylocker_state, stake_account, clock.unix_timestamp)?;
        stake_account.accumulated_rewards = stake_account.accumulated_rewards
            .checked_add(rewards)
            .ok_or(GreylockerError::ArithmeticError)?;
        stake_account.last_reward_claim = clock.unix_timestamp;

        stake_account.amount = stake_account.amount
            .checked_sub(amount)
            .ok_or(GreylockerError::ArithmeticError)?;
        ctx.accounts.greylocker_state.total_staked = ctx.accounts.greylocker_state.total_staked
            .checked_sub(amount)
            .ok_or(GreylockerError::ArithmeticError)?;

        let stake_seeds = &[b"stake-account", stake_account.owner.as_ref(), &[stake_account.bump]];
        let signer = &[&stake_seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.stake_vault.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.stake_account.to_account_info(),
                },
                signer,
            ),
            return_amount,
        )?;

        if penalty > 0 {
            token::burn(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: ctx.accounts.grey_mint.to_account_info(),
                        from: ctx.accounts.stake_vault.to_account_info(),
                        authority: ctx.accounts.stake_account.to_account_info(),
                    },
                    signer,
                ),
                penalty,
            )?;
            ctx.accounts.greylocker_state.total_supply = ctx.accounts.greylocker_state.total_supply
                .checked_sub(penalty)
                .ok_or(GreylockerError::ArithmeticError)?;
        }

        emit!(UnstakeEvent {
            user: ctx.accounts.user.key(),
            stake_account: stake_account.key(),
            amount,
            penalty_amount: penalty,
            return_amount,
            early_unstake,
        });

        Ok(())
    }

    /// Claim staking rewards—reap the fruits of your loyalty!
    pub fn claim_stake_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        require!(!ctx.accounts.greylocker_state.paused, GreylockerError::ProgramPaused);

        let clock = Clock::get()?;
        let stake_account = &mut ctx.accounts.stake_account;
        require!(stake_account.owner == ctx.accounts.user.key(), GreylockerError::NotAuthorized);

        let rewards = Self::calculate_rewards(&ctx.accounts.greylocker_state, stake_account, clock.unix_timestamp)?;
        let total_rewards = stake_account.accumulated_rewards
            .checked_add(rewards)
            .ok_or(GreylockerError::ArithmeticError)?;
        require!(total_rewards > 0, GreylockerError::NoRewardsToClaim);

        let new_total_supply = ctx.accounts.greylocker_state.total_supply
            .checked_add(total_rewards)
            .ok_or(GreylockerError::ArithmeticError)?;
        require!(new_total_supply <= ctx.accounts.greylocker_state.max_supply, GreylockerError::MaxSupplyReached);

        stake_account.accumulated_rewards = 0;
        stake_account.last_reward_claim = clock.unix_timestamp;

        let state_seeds = &[b"greylocker-state", &[ctx.accounts.greylocker_state.bump]];
        let signer = &[&state_seeds[..]];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.grey_mint.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.greylocker_state.to_account_info(),
                },
                signer,
            ),
            total_rewards,
        )?;

        ctx.accounts.greylocker_state.total_supply = new_total_supply;

        emit!(ClaimRewardsEvent {
            user: ctx.accounts.user.key(),
            stake_account: stake_account.key(),
            rewards_amount: total_rewards,
            new_total_supply,
        });

        Ok(())
    }

    /// Register as a service provider—step into the arena!
    pub fn register_service(ctx: Context<RegisterService>, service_info: ServiceInfo) -> Result<()> {
        require!(!ctx.accounts.greylocker_state.paused, GreylockerError::ProgramPaused);

        let stake_account = &ctx.accounts.stake_account;
        require!(stake_account.stake_type == StakeType::Service, GreylockerError::InvalidStakeType);
        require!(
            stake_account.amount >= ctx.accounts.greylocker_state.governance_parameters.service_stake_minimum,
            GreylockerError::InsufficientStakeAmount
        );

        let clock = Clock::get()?;
        let service_provider = &mut ctx.accounts.service_provider;
        service_provider.owner = ctx.accounts.user.key();
        service_provider.stake_account = stake_account.key();
        service_provider.service_info = service_info;
        service_provider.registered_at = clock.unix_timestamp;
        service_provider.total_access_fees_paid = 0;
        service_provider.reputation_score = 70; // Neutral-positive start
        service_provider.bump = *ctx.bumps.get("service_provider").unwrap();

        emit!(RegisterServiceEvent {
            service_provider: service_provider.key(),
            owner: service_provider.owner,
            stake_account: stake_account.key(),
            service_name: service_provider.service_info.name.clone(),
        });

        Ok(())
    }

    /// Pay access fee—services reward users for their data!
    pub fn pay_access_fee(ctx: Context<PayAccessFee>, amount: u64, data_type: DataType, duration: i64) -> Result<()> {
        require!(!ctx.accounts.greylocker_state.paused, GreylockerError::ProgramPaused);

        let service_provider = &mut ctx.accounts.service_provider;
        require!(service_provider.owner == ctx.accounts.service_owner.key(), GreylockerError::NotAuthorized);

        service_provider.total_access_fees_paid = service_provider.total_access_fees_paid
            .checked_add(amount)
            .ok_or(GreylockerError::ArithmeticError)?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.service_token_account.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.service_owner.to_account_info(),
                },
            ),
            amount,
        )?;

        let clock = Clock::get()?;
        if ctx.accounts.access_record.owner != System::id() {
            let access_record = &mut ctx.accounts.access_record;
            access_record.service_provider = service_provider.key();
            access_record.user = ctx.accounts.user.key();
            access_record.data_type = data_type;
            access_record.amount = amount;
            access_record.granted_at = clock.unix_timestamp;
            access_record.expires_at = clock.unix_timestamp + duration;
            access_record.bump = *ctx.bumps.get("access_record").unwrap();
        }

        emit!(PayAccessFeeEvent {
            service_provider: service_provider.key(),
            user: ctx.accounts.user.key(),
            amount,
            data_type,
            expires_at: clock.unix_timestamp + duration,
        });

        Ok(())
    }

    /// Create a dispute—call out the bad actors!
    pub fn create_dispute(ctx: Context<CreateDispute>, evidence: String, dispute_type: DisputeType) -> Result<()> {
        require!(!ctx.accounts.greylocker_state.paused, GreylockerError::ProgramPaused);

        let clock = Clock::get()?;
        let dispute = &mut ctx.accounts.dispute;
        dispute.dispute_id = dispute.key();
        dispute.reporter = ctx.accounts.reporter.key();
        dispute.reported_service = ctx.accounts.service_provider.key();
        dispute.evidence = evidence;
        dispute.created_at = clock.unix_timestamp;
        dispute.status = DisputeStatus::Pending;
        dispute.resolution = None;
        dispute.resolved_at = None;
        dispute.dispute_type = dispute_type;
        dispute.bump = *ctx.bumps.get("dispute").unwrap();

        emit!(CreateDisputeEvent {
            dispute_id: dispute.dispute_id,
            reporter: dispute.reporter,
            reported_service: dispute.reported_service,
            dispute_type,
        });

        Ok(())
    }

    /// Resolve a dispute—justice is served!
    pub fn resolve_dispute(ctx: Context<ResolveDispute>, resolution: DisputeResolution) -> Result<()> {
        require!(!ctx.accounts.greylocker_state.paused, GreylockerError::ProgramPaused);
        require!(
            ctx.accounts.resolver.key() == ctx.accounts.greylocker_state.governance_authority,
            GreylockerError::NotAuthorized
        );

        let dispute = &mut ctx.accounts.dispute;
        require!(dispute.status == DisputeStatus::Pending, GreylockerError::DisputeAlreadyResolved);

        let clock = Clock::get()?;
        dispute.status = DisputeStatus::Resolved;
        dispute.resolution = Some(resolution);
        dispute.resolved_at = Some(clock.unix_timestamp);

        if resolution == DisputeResolution::Upheld && ctx.accounts.stake_account.owner != System::id() {
            let service_provider = &mut ctx.accounts.service_provider;
            let stake_account = &mut ctx.accounts.stake_account;
            require!(stake_account.owner == service_provider.owner, GreylockerError::NotAuthorized);

            service_provider.reputation_score = service_provider.reputation_score.saturating_sub(10);
            let slash_amount = stake_account.amount
                .checked_mul(ctx.accounts.greylocker_state.governance_parameters.slashing_percentage as u64)
                .and_then(|val| val.checked_div(100))
                .ok_or(GreylockerError::ArithmeticError)?;
            let burn_amount = slash_amount / 2;
            let reporter_amount = slash_amount - burn_amount;

            stake_account.amount = stake_account.amount
                .checked_sub(slash_amount)
                .ok_or(GreylockerError::ArithmeticError)?;
            ctx.accounts.greylocker_state.total_staked = ctx.accounts.greylocker_state.total_staked
                .checked_sub(slash_amount)
                .ok_or(GreylockerError::ArithmeticError)?;

            let stake_seeds = &[b"stake-account", stake_account.owner.as_ref(), &[stake_account.bump]];
            let signer = &[&stake_seeds[..]];

            if reporter_amount > 0 {
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Transfer {
                            from: ctx.accounts.stake_vault.to_account_info(),
                            to: ctx.accounts.reporter_token_account.to_account_info(),
                            authority: ctx.accounts.stake_account.to_account_info(),
                        },
                        signer,
                    ),
                    reporter_amount,
                )?;
            }

            if burn_amount > 0 {
                token::burn(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        Burn {
                            mint: ctx.accounts.grey_mint.to_account_info(),
                            from: ctx.accounts.stake_vault.to_account_info(),
                            authority: ctx.accounts.stake_account.to_account_info(),
                        },
                        signer,
                    ),
                    burn_amount,
                )?;
                ctx.accounts.greylocker_state.total_supply = ctx.accounts.greylocker_state.total_supply
                    .checked_sub(burn_amount)
                    .ok_or(GreylockerError::ArithmeticError)?;
            }

            emit!(SlashEvent {
                stake_account: stake_account.key(),
                dispute_id: dispute.dispute_id,
                slash_amount,
                burn_amount,
                reporter_amount,
            });
        }

        emit!(ResolveDisputeEvent {
            dispute_id: dispute.dispute_id,
            resolver: ctx.accounts.resolver.key(),
            resolution,
            service_provider: ctx.accounts.service_provider.key(),
            reputation_score: ctx.accounts.service_provider.reputation_score,
        });

        Ok(())
    }

    /// Create a data pool—share and earn in the anonymized data economy!
    pub fn create_data_pool(ctx: Context<CreateDataPool>, pool_info: DataPoolInfo) -> Result<()> {
        require!(!ctx.accounts.greylocker_state.paused, GreylockerError::ProgramPaused);
        require!(
            ctx.accounts.governance_authority.key() == ctx.accounts.greylocker_state.governance_authority,
            GreylockerError::NotAuthorized
        );

        let clock = Clock::get()?;
        let data_pool = &mut ctx.accounts.data_pool;
        data_pool.pool_id = data_pool.key();
        data_pool.name = pool_info.name;
        data_pool.data_type = pool_info.data_type;
        data_pool.reward_rate = pool_info.reward_rate;
        data_pool.description = pool_info.description;
        data_pool.created_at = clock.unix_timestamp;
        data_pool.total_participants = 0;
        data_pool.total_rewards_paid = 0;
        data_pool.active = true;
        data_pool.bump = *ctx.bumps.get("data_pool").unwrap();

        emit!(CreateDataPoolEvent {
            pool_id: data_pool.pool_id,
            name: data_pool.name.clone(),
            data_type: data_pool.data_type.clone(),
            reward_rate: data_pool.reward_rate,
        });

        Ok(())
    }

    /// Join a data pool—opt in and start earning!
    pub fn join_data_pool(ctx: Context<JoinDataPool>) -> Result<()> {
        require!(!ctx.accounts.greylocker_state.paused, GreylockerError::ProgramPaused);
        require!(ctx.accounts.data_pool.active, GreylockerError::DataPoolInactive);

        let clock = Clock::get()?;
        let participant = &mut ctx.accounts.participant;
        participant.user = ctx.accounts.user.key();
        participant.pool_id = ctx.accounts.data_pool.key();
        participant.joined_at = clock.unix_timestamp;
        participant.total_rewards_received = 0;
        participant.last_reward_at = 0;
        participant.bump = *ctx.bumps.get("participant").unwrap();

        ctx.accounts.data_pool.total_participants = ctx.accounts.data_pool.total_participants
            .checked_add(1)
            .ok_or(GreylockerError::ArithmeticError)?;

        emit!(JoinDataPoolEvent {
            user: participant.user,
            pool_id: participant.pool_id,
            pool_name: ctx.accounts.data_pool.name.clone(),
        });

        Ok(())
    }

    /// Pay data reward—reward users for their contributions!
    pub fn pay_data_reward(ctx: Context<PayDataReward>, amount: u64) -> Result<()> {
        require!(!ctx.accounts.greylocker_state.paused, GreylockerError::ProgramPaused);
        require!(
            ctx.accounts.caller.key() == ctx.accounts.greylocker_state.governance_authority,
            GreylockerError::NotAuthorized
        );

        let participant = &mut ctx.accounts.participant;
        require!(
            participant.user == ctx.accounts.user.key() && participant.pool_id == ctx.accounts.data_pool.key(),
            GreylockerError::UserNotInDataPool
        );

        let clock = Clock::get()?;
        participant.total_rewards_received = participant.total_rewards_received
            .checked_add(amount)
            .ok_or(GreylockerError::ArithmeticError)?;
        participant.last_reward_at = clock.unix_timestamp;

        ctx.accounts.data_pool.total_rewards_paid = ctx.accounts.data_pool.total_rewards_paid
            .checked_add(amount)
            .ok_or(GreylockerError::ArithmeticError)?;

        let new_total_supply = ctx.accounts.greylocker_state.total_supply
            .checked_add(amount)
            .ok_or(GreylockerError::ArithmeticError)?;
        require!(new_total_supply <= ctx.accounts.greylocker_state.max_supply, GreylockerError::MaxSupplyReached);

        let state_seeds = &[b"greylocker-state", &[ctx.accounts.greylocker_state.bump]];
        let signer = &[&state_seeds[..]];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.grey_mint.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.greylocker_state.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        ctx.accounts.greylocker_state.total_supply = new_total_supply;

        emit!(PayDataRewardEvent {
            user: participant.user,
            pool_id: ctx.accounts.data_pool.key(),
            amount,
            new_total_supply,
        });

        Ok(())
    }

    /// Update governance parameter—tune the ecosystem’s pulse!
    pub fn update_governance_parameter(ctx: Context<UpdateGovernanceParameter>, parameter: GovernanceParameter, value: u64) -> Result<()> {
        require!(!ctx.accounts.greylocker_state.paused, GreylockerError::ProgramPaused);
        require!(
            ctx.accounts.governance_authority.key() == ctx.accounts.greylocker_state.governance_authority,
            GreylockerError::NotAuthorized
        );

        let state = &mut ctx.accounts.greylocker_state;
        match parameter {
            GovernanceParameter::SecurityStakeMinimum => state.governance_parameters.security_stake_minimum = value,
            GovernanceParameter::ServiceStakeMinimum => state.governance_parameters.service_stake_minimum = value,
            GovernanceParameter::DataValidatorStakeMinimum => state.governance_parameters.data_validator_stake_minimum = value,
            GovernanceParameter::LiquidityStakeMinimum => state.governance_parameters.liquidity_stake_minimum = value,
            GovernanceParameter::SecurityRewardRate => {
                require!(value <= 100, GreylockerError::InvalidParameterValue);
                state.governance_parameters.security_reward_rate = value;
            },
            GovernanceParameter::DataValidatorRewardRate => {
                require!(value <= 100, GreylockerError::InvalidParameterValue);
                state.governance_parameters.data_validator_reward_rate = value;
            },
            GovernanceParameter::LiquidityRewardRate => {
                require!(value <= 100, GreylockerError::InvalidParameterValue);
                state.governance_parameters.liquidity_reward_rate = value;
            },
            GovernanceParameter::SlashingPercentage => {
                require!(value <= 100, GreylockerError::InvalidParameterValue);
                state.governance_parameters.slashing_percentage = value;
            },
            GovernanceParameter::EarlyUnstakePenalty => {
                require!(value <= 100, GreylockerError::InvalidParameterValue);
                state.governance_parameters.early_unstake_penalty = value;
            },
            GovernanceParameter::RewardUpdateInterval => state.governance_parameters.reward_update_interval = value,
        }

        emit!(UpdateGovernanceParameterEvent {
            parameter,
            new_value: value,
            authority: ctx.accounts.governance_authority.key(),
        });

        Ok(())
    }

    /// Pause the program—freeze the grid!
    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        require!(!ctx.accounts.greylocker_state.paused, GreylockerError::AlreadyPaused);
        require!(
            ctx.accounts.pauser.key() == ctx.accounts.greylocker_state.authority,
            GreylockerError::NotAuthorized
        );
        ctx.accounts.greylocker_state.paused = true;

        emit!(PauseEvent {
            authority: ctx.accounts.pauser.key(),
        });

        Ok(())
    }

    /// Unpause the program—reactivate the system!
    pub fn unpause(ctx: Context<Unpause>) -> Result<()> {
        require!(ctx.accounts.greylocker_state.paused, GreylockerError::NotPaused);
        require!(
            ctx.accounts.pauser.key() == ctx.accounts.greylocker_state.authority,
            GreylockerError::NotAuthorized
        );
        ctx.accounts.greylocker_state.paused = false;

        emit!(UnpauseEvent {
            authority: ctx.accounts.pauser.key(),
        });

        Ok(())
    }

    /// Governance mint—fuel the ecosystem’s growth!
    pub fn governance_mint(ctx: Context<GovernanceMint>, amount: u64) -> Result<()> {
        require!(!ctx.accounts.greylocker_state.paused, GreylockerError::ProgramPaused);
        require!(
            ctx.accounts.governance_authority.key() == ctx.accounts.greylocker_state.governance_authority,
            GreylockerError::NotAuthorized
        );

        let new_total_supply = ctx.accounts.greylocker_state.total_supply
            .checked_add(amount)
            .ok_or(GreylockerError::ArithmeticError)?;
        require!(new_total_supply <= ctx.accounts.greylocker_state.max_supply, GreylockerError::MaxSupplyReached);

        let state_seeds = &[b"greylocker-state", &[ctx.accounts.greylocker_state.bump]];
        let signer = &[&state_seeds[..]];
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.grey_mint.to_account_info(),
                    to: ctx.accounts.recipient.to_account_info(),
                    authority: ctx.accounts.greylocker_state.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        ctx.accounts.greylocker_state.total_supply = new_total_supply;

        emit!(GovernanceMintEvent {
            recipient: ctx.accounts.recipient.key(),
            amount,
            new_total_supply,
        });

        Ok(())
    }

    // Helper function to calculate staking rewards
    fn calculate_rewards(state: &GreylockerState, stake_account: &StakeAccount, current_time: i64) -> Result<u64> {
        if current_time < stake_account.last_reward_claim + state.governance_parameters.reward_update_interval as i64 {
            return Ok(0); // Not enough time has passed
        }

        let time_since_last_claim = (current_time - stake_account.last_reward_claim) as u64;
        let reward_rate = match stake_account.stake_type {
            StakeType::Security => state.governance_parameters.security_reward_rate,
            StakeType::DataValidator => state.governance_parameters.data_validator_reward_rate,
            StakeType::Liquidity => state.governance_parameters.liquidity_reward_rate,
            StakeType::Service => 0, // No rewards for service stakes
        };

        if reward_rate == 0 || stake_account.amount == 0 {
            return Ok(0);
        }

        // Rewards = amount * rate * time / (365 days * 100)
        let rewards = (stake_account.amount as u128)
            .checked_mul(reward_rate as u128)
            .and_then(|val| val.checked_mul(time_since_last_claim as u128))
            .and_then(|val| val.checked_div(365 * 24 * 60 * 60 * 100))
            .and_then(|val| u64::try_from(val).ok())
            .ok_or(GreylockerError::ArithmeticError)?;

        Ok(rewards)
    }
}

// Account structs
#[account]
pub struct GreylockerState {
    pub grey_mint: Pubkey,
    pub treasury: Pubkey,
    pub paused: bool,
    pub total_staked: u64,
    pub total_supply: u64,
    pub max_supply: u64,
    pub authority: Pubkey,
    pub governance_authority: Pubkey,
    pub governance_parameters: GovernanceParameters,
    pub bump: u8,
}

#[account]
pub struct StakeAccount {
    pub owner: Pubkey,
    pub stake_type: StakeType,
    pub amount: u64,
    pub lock_until: i64,
    pub last_reward_claim: i64,
    pub accumulated_rewards: u64,
    pub staked_at: i64,
    pub bump: u8,
}

#[account]
pub struct ServiceProvider {
    pub owner: Pubkey,
    pub stake_account: Pubkey,
    pub service_info: ServiceInfo,
    pub registered_at: i64,
    pub total_access_fees_paid: u64,
    pub reputation_score: u8,
    pub bump: u8,
}

#[account]
pub struct AccessRecord {
    pub service_provider: Pubkey,
    pub user: Pubkey,
    pub data_type: DataType,
    pub amount: u64,
    pub granted_at: i64,
    pub expires_at: i64,
    pub bump: u8,
}

#[account]
pub struct Dispute {
    pub dispute_id: Pubkey,
    pub reporter: Pubkey,
    pub reported_service: Pubkey,
    pub evidence: String,
    pub created_at: i64,
    pub status: DisputeStatus,
    pub resolution: Option<DisputeResolution>,
    pub resolved_at: Option<i64>,
    pub dispute_type: DisputeType,
    pub bump: u8,
}

#[account]
pub struct DataPool {
    pub pool_id: Pubkey,
    pub name: String,
    pub data_type: String,
    pub reward_rate: u64,
    pub description: String,
    pub created_at: i64,
    pub total_participants: u64,
    pub total_rewards_paid: u64,
    pub active: bool,
    pub bump: u8,
}

#[account]
pub struct PoolParticipant {
    pub user: Pubkey,
    pub pool_id: Pubkey,
    pub joined_at: i64,
    pub total_rewards_received: u64,
    pub last_reward_at: i64,
    pub bump: u8,
}

// Data structs
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct GovernanceParameters {
    pub security_stake_minimum: u64,
    pub service_stake_minimum: u64,
    pub data_validator_stake_minimum: u64,
    pub liquidity_stake_minimum: u64,
    pub security_reward_rate: u8,
    pub data_validator_reward_rate: u8,
    pub liquidity_reward_rate: u8,
    pub slashing_percentage: u8,
    pub early_unstake_penalty: u8,
    pub reward_update_interval: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ServiceInfo {
    pub name: String,
    pub description: String,
    pub metadata_uri: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct DataPoolInfo {
    pub name: String,
    pub data_type: String,
    pub reward_rate: u64,
    pub description: String,
}

// Enums
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum StakeType {
    Security,
    Service,
    DataValidator,
    Liquidity,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum DisputeType {
    ServiceViolation,
    DataMisuse,
    Other,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum DisputeStatus {
    Pending,
    Resolved,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum DisputeResolution {
    Upheld,
    Dismissed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum DataType {
    Browsing,
    Purchase,
    Location,
    Custom(String),
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum GovernanceParameter {
    SecurityStakeMinimum,
    ServiceStakeMinimum,
    DataValidatorStakeMinimum,
    LiquidityStakeMinimum,
    SecurityRewardRate,
    DataValidatorRewardRate,
    LiquidityRewardRate,
    SlashingPercentage,
    EarlyUnstakePenalty,
    RewardUpdateInterval,
}

// Context structs
#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = initializer,
        space = 8 + 32 + 32 + 1 + 8 + 8 + 8 + 32 + 32 + GovernanceParameters::LEN + 1,
        seeds = [b"greylocker-state"],
        bump
    )]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(
        init,
        payer = initializer,
        mint::decimals = 9,
        mint::authority = greylocker_state,
    )]
    pub grey_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = initializer,
        token::mint = grey_mint,
        token::authority = initializer,
    )]
    pub treasury: Account<'info, TokenAccount>,
    #[account(mut)]
    pub initializer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut, seeds = [b"greylocker-state"], bump = greylocker_state.bump)]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(mut)]
    pub grey_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 1 + 8 + 8 + 8 + 8 + 8 + 1,
        seeds = [b"stake-account", user.key().as_ref(), user_token_account.key().as_ref()],
        bump
    )]
    pub stake_account: Account<'info, StakeAccount>,
    #[account(
        init,
        payer = user,
        token::mint = grey_mint,
        token::authority = stake_account,
    )]
    pub stake_vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = grey_mint)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut, seeds = [b"greylocker-state"], bump = greylocker_state.bump)]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(mut)]
    pub grey_mint: Account<'info, Mint>,
    #[account(mut, seeds = [b"stake-account", user.key().as_ref(), user_token_account.key().as_ref()], bump = stake_account.bump)]
    pub stake_account: Account<'info, StakeAccount>,
    #[account(mut, token::mint = grey_mint, token::authority = stake_account)]
    pub stake_vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = grey_mint)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut, seeds = [b"greylocker-state"], bump = greylocker_state.bump)]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(mut)]
    pub grey_mint: Account<'info, Mint>,
    #[account(mut, seeds = [b"stake-account", user.key().as_ref(), user_token_account.key().as_ref()], bump = stake_account.bump)]
    pub stake_account: Account<'info, StakeAccount>,
    #[account(mut, token::mint = grey_mint)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RegisterService<'info> {
    #[account(seeds = [b"greylocker-state"], bump = greylocker_state.bump)]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + ServiceInfo::LEN + 8 + 8 + 1 + 1,
        seeds = [b"service-provider", user.key().as_ref()],
        bump
    )]
    pub service_provider: Account<'info, ServiceProvider>,
    #[account(seeds = [b"stake-account", user.key().as_ref(), stake_account.key().as_ref()], bump = stake_account.bump)]
    pub stake_account: Account<'info, StakeAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct PayAccessFee<'info> {
    #[account(seeds = [b"greylocker-state"], bump = greylocker_state.bump)]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(mut)]
    pub grey_mint: Account<'info, Mint>,
    #[account(mut, seeds = [b"service-provider", service_owner.key().as_ref()], bump = service_provider.bump)]
    pub service_provider: Account<'info, ServiceProvider>,
    #[account(
        init_if_needed,
        payer = service_owner,
        space = 8 + 32 + 32 + 1 + 8 + 8 + 8 + 1,
        seeds = [b"access-record", service_provider.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub access_record: Account<'info, AccessRecord>,
    #[account(mut, token::mint = grey_mint)]
    pub service_token_account: Account<'info, TokenAccount>,
    #[account(mut, token::mint = grey_mint)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub service_owner: Signer<'info>,
    pub user: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CreateDispute<'info> {
    #[account(seeds = [b"greylocker-state"], bump = greylocker_state.bump)]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(
        init,
        payer = reporter,
        space = 8 + 32 + 32 + 32 + 200 + 8 + 1 + 1 + 8 + 1 + 1, // Adjust size based on evidence string
        seeds = [b"dispute", reporter.key().as_ref(), service_provider.key().as_ref()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,
    #[account(seeds = [b"service-provider", service_provider.owner.as_ref()], bump = service_provider.bump)]
    pub service_provider: Account<'info, ServiceProvider>,
    #[account(mut)]
    pub reporter: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(mut, seeds = [b"greylocker-state"], bump = greylocker_state.bump)]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(mut)]
    pub grey_mint: Account<'info, Mint>,
    #[account(mut, seeds = [b"dispute", dispute.reporter.as_ref(), service_provider.key().as_ref()], bump = dispute.bump)]
    pub dispute: Account<'info, Dispute>,
    #[account(mut, seeds = [b"service-provider", service_provider.owner.as_ref()], bump = service_provider.bump)]
    pub service_provider: Account<'info, ServiceProvider>,
    #[account(mut, seeds = [b"stake-account", service_provider.owner.as_ref(), stake_account.key().as_ref()], bump = stake_account.bump, constraint = stake_account.owner == service_provider.owner)]
    pub stake_account: Account<'info, StakeAccount>,
    #[account(mut, token::mint = grey_mint, token::authority = stake_account)]
    pub stake_vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = grey_mint)]
    pub reporter_token_account: Account<'info, TokenAccount>,
    pub resolver: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CreateDataPool<'info> {
    #[account(mut, seeds = [b"greylocker-state"], bump = greylocker_state.bump)]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(
        init,
        payer = governance_authority,
        space = 8 + 32 + 50 + 50 + 8 + 200 + 8 + 8 + 8 + 1 + 1,
        seeds = [b"data-pool", governance_authority.key().as_ref(), pool_info.name.as_ref()],
        bump
    )]
    pub data_pool: Account<'info, DataPool>,
    #[account(mut)]
    pub governance_authority: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct JoinDataPool<'info> {
    #[account(seeds = [b"greylocker-state"], bump = greylocker_state.bump)]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 1,
        seeds = [b"participant", user.key().as_ref(), data_pool.key().as_ref()],
        bump
    )]
    pub participant: Account<'info, PoolParticipant>,
    #[account(mut, seeds = [b"data-pool", data_pool_creator.key().as_ref(), data_pool.name.as_ref()], bump = data_pool.bump)]
    pub data_pool: Account<'info, DataPool>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub data_pool_creator: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct PayDataReward<'info> {
    #[account(mut, seeds = [b"greylocker-state"], bump = greylocker_state.bump)]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(mut)]
    pub grey_mint: Account<'info, Mint>,
    #[account(mut, seeds = [b"data-pool", data_pool_creator.key().as_ref(), data_pool.name.as_ref()], bump = data_pool.bump)]
    pub data_pool: Account<'info, DataPool>,
    #[account(mut, seeds = [b"participant", user.key().as_ref(), data_pool.key().as_ref()], bump = participant.bump)]
    pub participant: Account<'info, PoolParticipant>,
    #[account(mut, token::mint = grey_mint)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: AccountInfo<'info>,
    pub caller: Signer<'info>,
    pub data_pool_creator: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateGovernanceParameter<'info> {
    #[account(mut, seeds = [b"greylocker-state"], bump = greylocker_state.bump)]
    pub greylocker_state: Account<'info, GreylockerState>,
    pub governance_authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Pause<'info> {
    #[account(mut, seeds = [b"greylocker-state"], bump = greylocker_state.bump)]
    pub greylocker_state: Account<'info, GreylockerState>,
    pub pauser: Signer<'info>,
}

#[derive(Accounts)]
pub struct Unpause<'info> {
    #[account(mut, seeds = [b"greylocker-state"], bump = greylocker_state.bump)]
    pub greylocker_state: Account<'info, GreylockerState>,
    pub pauser: Signer<'info>,
}

#[derive(Accounts)]
pub struct GovernanceMint<'info> {
    #[account(mut, seeds = [b"greylocker-state"], bump = greylocker_state.bump)]
    pub greylocker_state: Account<'info, GreylockerState>,
    #[account(mut)]
    pub grey_mint: Account<'info, Mint>,
    #[account(mut, token::mint = grey_mint)]
    pub recipient: Account<'info, TokenAccount>,
    pub governance_authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

// Error codes
#[error_code]
pub enum GreylockerError {
    #[msg("Program is paused")]
    ProgramPaused,
    #[msg("Program is already paused")]
    AlreadyPaused,
    #[msg("Program is not paused")]
    NotPaused,
    #[msg("Not authorized")]
    NotAuthorized,
    #[msg("Arithmetic overflow or underflow")]
    ArithmeticError,
    #[msg("Insufficient stake amount")]
    InsufficientStakeAmount,
    #[msg("Invalid stake type")]
    InvalidStakeType,
    #[msg("Dispute already resolved")]
    DisputeAlreadyResolved,
    #[msg("User not in data pool")]
    UserNotInDataPool,
    #[msg("Data pool is inactive")]
    DataPoolInactive,
    #[msg("No rewards to claim")]
    NoRewardsToClaim,
    #[msg("Maximum supply reached")]
    MaxSupplyReached,
    #[msg("Invalid parameter value")]
    InvalidParameterValue,
}

// Events
#[event]
pub struct InitializeEvent {
    pub grey_mint: Pubkey,
    pub treasury: Pubkey,
    pub initial_supply: u64,
    pub max_supply: u64,
    pub governance_authority: Pubkey,
}

#[event]
pub struct StakeEvent {
    pub user: Pubkey,
    pub stake_account: Pubkey,
    pub stake_type: StakeType,
    pub amount: u64,
    pub lock_until: i64,
}

#[event]
pub struct UnstakeEvent {
    pub user: Pubkey,
    pub stake_account: Pubkey,
    pub amount: u64,
    pub penalty_amount: u64,
    pub return_amount: u64,
    pub early_unstake: bool,
}

#[event]
pub struct ClaimRewardsEvent {
    pub user: Pubkey,
    pub stake_account: Pubkey,
    pub rewards_amount: u64,
    pub new_total_supply: u64,
}

#[event]
pub struct RegisterServiceEvent {
    pub service_provider: Pubkey,
    pub owner: Pubkey,
    pub stake_account: Pubkey,
    pub service_name: String,
}

#[event]
pub struct PayAccessFeeEvent {
    pub service_provider: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub data_type: DataType,
    pub expires_at: i64,
}

#[event]
pub struct CreateDisputeEvent {
    pub dispute_id: Pubkey,
    pub reporter: Pubkey,
    pub reported_service: Pubkey,
    pub dispute_type: DisputeType,
}

#[event]
pub struct ResolveDisputeEvent {
    pub dispute_id: Pubkey,
    pub resolver: Pubkey,
    pub resolution: DisputeResolution,
    pub service_provider: Pubkey,
    pub reputation_score: u8,
}

#[event]
pub struct SlashEvent {
    pub stake_account: Pubkey,
    pub dispute_id: Pubkey,
    pub slash_amount: u64,
    pub burn_amount: u64,
    pub reporter_amount: u64,
}

#[event]
pub struct CreateDataPoolEvent {
    pub pool_id: Pubkey,
    pub name: String,
    pub data_type: String,
    pub reward_rate: u64,
}

#[event]
pub struct JoinDataPoolEvent {
    pub user: Pubkey,
    pub pool_id: Pubkey,
    pub pool_name: String,
}

#[event]
pub struct PayDataRewardEvent {
    pub user: Pubkey,
    pub pool_id: Pubkey,
    pub amount: u64,
    pub new_total_supply: u64,
}

#[event]
pub struct UpdateGovernanceParameterEvent {
    pub parameter: GovernanceParameter,
    pub new_value: u64,
    pub authority: Pubkey,
}

#[event]
pub struct PauseEvent {
    pub authority: Pubkey,
}

#[event]
pub struct UnpauseEvent {
    pub authority: Pubkey,
}

#[event]
pub struct GovernanceMintEvent {
    pub recipient: Pubkey,
    pub amount: u64,
    pub new_total_supply: u64,
}

// Helper implementations
impl GovernanceParameters {
    pub const LEN: usize = 8 * 9 + 1; // 9 u64 fields + 1 u8 field
}

impl ServiceInfo {
    pub const LEN: usize = 50 + 200 + 200; // Rough estimate for strings
}
