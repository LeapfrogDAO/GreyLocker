// greylocker_vault/programs/greylocker_vault/src/lib.rs
// The Greylocker Vault Program—a neon-lit citadel of identity on Solana

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use solana_program::{
    program::{invoke, invoke_signed},
    system_instruction,
    sysvar::{clock::Clock, rent::Rent},
};

// Program ID (replace with deployed ID)
declare_id!("GREY1vauLtXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

#[program]
pub mod greylocker_vault {
    use super::*;

    /// Initialize a new identity vault—forge a digital stronghold for a user’s secrets.
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        vault_name: String,
        vault_description: String,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let user = &ctx.accounts.user;

        require!(vault_name.len() <= 50, GreylockerVaultError::NameTooLong);
        require!(vault_description.len() <= 200, GreylockerVaultError::DescriptionTooLong);

        let clock = Clock::get()?;
        vault.owner = user.key();
        vault.name = vault_name;
        vault.description = vault_description;
        vault.created_at = clock.unix_timestamp;
        vault.last_updated = clock.unix_timestamp;
        vault.is_locked = false;
        vault.storage_type = StorageType::IPFS; // Default to IPFS
        vault.data_types_count = 0;
        vault.data_entries_count = 0;
        vault.bump = *ctx.bumps.get("vault").unwrap();

        emit!(VaultCreatedEvent {
            vault: vault.key(),
            owner: user.key(),
            name: vault.name.clone(),
            created_at: vault.created_at,
        });

        Ok(())
    }

    /// Add a data type category—define the encrypted veins of the vault.
    pub fn add_data_type(
        ctx: Context<ManageVault>,
        data_type: DataType,
        encryption_level: EncryptionLevel,
        sharing_preferences: SharingPreferences,
        retention_period: i64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(!vault.is_locked, GreylockerVaultError::VaultLocked);
        require!(vault.data_types_count < 255, GreylockerVaultError::TooManyDataTypes);

        let clock = Clock::get()?;
        vault.last_updated = clock.unix_timestamp;

        let (data_type_config_key, data_type_bump) = Pubkey::find_program_address(
            &[b"data-type-config", vault.key().as_ref(), &[vault.data_types_count]],
            ctx.program_id,
        );
        let data_type_config_info = &ctx.accounts.data_type_config;

        if data_type_config_info.lamports() == 0 {
            let space = DataTypeConfig::SPACE;
            let rent = Rent::get()?.minimum_balance(space);
            invoke_signed(
                &system_instruction::create_account(
                    &ctx.accounts.user.key(),
                    &data_type_config_key,
                    rent,
                    space as u64,
                    ctx.program_id,
                ),
                &[
                    ctx.accounts.user.to_account_info(),
                    data_type_config_info.clone(),
                    ctx.accounts.system_program.to_account_info(),
                ],
                &[&[
                    b"data-type-config",
                    vault.key().as_ref(),
                    &[vault.data_types_count],
                    &[data_type_bump],
                ]],
            )?;

            let mut data_type_config = Account::<DataTypeConfig>::try_from(data_type_config_info)?;
            data_type_config.vault = vault.key();
            data_type_config.data_type = data_type.clone();
            data_type_config.encryption_level = encryption_level;
            data_type_config.sharing_preferences = sharing_preferences;
            data_type_config.retention_period = retention_period;
            data_type_config.created_at = clock.unix_timestamp;
            data_type_config.last_updated = clock.unix_timestamp;
            data_type_config.entry_count = 0;
            data_type_config.index = vault.data_types_count;
            data_type_config.bump = data_type_bump;

            // Serialize manually since it's newly created
            data_type_config.serialize(&mut &mut data_type_config_info.data.borrow_mut()[..])?;
        }

        vault.data_types_count += 1;

        emit!(DataTypeAddedEvent {
            vault: vault.key(),
            data_type,
            encryption_level,
            sharing_preferences,
            retention_period,
        });

        Ok(())
    }

    /// Store encrypted data—seal secrets into the vault’s neon grid.
    pub fn store_data(
        ctx: Context<StoreData>,
        data_type_index: u8,
        encrypted_data: Vec<u8>,
        metadata: String,
        ipfs_cid: Option<String>,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let data_type_config = &mut ctx.accounts.data_type_config;
        let data_entry = &mut ctx.accounts.data_entry;

        require!(!vault.is_locked, GreylockerVaultError::VaultLocked);
        require!(data_type_config.vault == vault.key(), GreylockerVaultError::InvalidDataTypeConfig);
        require!(data_type_index == data_type_config.index, GreylockerVaultError::InvalidDataTypeIndex);
        require!(encrypted_data.len() <= 1024, GreylockerVaultError::DataTooLarge);
        require!(metadata.len() <= 200, GreylockerVaultError::MetadataTooLong);

        let clock = Clock::get()?;
        vault.last_updated = clock.unix_timestamp;
        data_type_config.last_updated = clock.unix_timestamp;

        data_entry.vault = vault.key();
        data_entry.data_type_config = data_type_config.key();
        data_entry.encrypted_data = encrypted_data;
        data_entry.metadata = metadata;
        data_entry.data_type = data_type_config.data_type.clone();
        data_entry.created_at = clock.unix_timestamp;
        data_entry.last_updated = clock.unix_timestamp;
        data_entry.version = 1;
        data_entry.access_count = 0;
        data_entry.bump = *ctx.bumps.get("data_entry").unwrap();

        if vault.storage_type == StorageType::IPFS {
            require!(ipfs_cid.is_some(), GreylockerVaultError::MissingIPFSCID);
            let cid = ipfs_cid.unwrap();
            require!(cid.len() <= 100, GreylockerVaultError::IPFSCIDTooLong);
            data_entry.ipfs_cid = Some(cid);
        } else {
            data_entry.ipfs_cid = None;
        }

        data_type_config.entry_count = data_type_config.entry_count.checked_add(1)
            .ok_or(GreylockerVaultError::ArithmeticOverflow)?;
        vault.data_entries_count = vault.data_entries_count.checked_add(1)
            .ok_or(GreylockerVaultError::ArithmeticOverflow)?;

        emit!(DataStoredEvent {
            vault: vault.key(),
            data_entry: data_entry.key(),
            data_type: data_type_config.data_type.clone(),
        });

        Ok(())
    }

    /// Update data—reforge a secret within the vault’s glowing core.
    pub fn update_data(
        ctx: Context<UpdateData>,
        encrypted_data: Vec<u8>,
        metadata: String,
        ipfs_cid: Option<String>,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let data_entry = &mut ctx.accounts.data_entry;

        require!(!vault.is_locked, GreylockerVaultError::VaultLocked);
        require!(data_entry.vault == vault.key(), GreylockerVaultError::InvalidDataEntry);
        require!(encrypted_data.len() <= 1024, GreylockerVaultError::DataTooLarge);
        require!(metadata.len() <= 200, GreylockerVaultError::MetadataTooLong);

        let clock = Clock::get()?;
        vault.last_updated = clock.unix_timestamp;
        data_entry.last_updated = clock.unix_timestamp;

        data_entry.encrypted_data = encrypted_data;
        data_entry.metadata = metadata;
        data_entry.version = data_entry.version.checked_add(1)
            .ok_or(GreylockerVaultError::ArithmeticOverflow)?;

        if vault.storage_type == StorageType::IPFS {
            require!(ipfs_cid.is_some(), GreylockerVaultError::MissingIPFSCID);
            let cid = ipfs_cid.unwrap();
            require!(cid.len() <= 100, GreylockerVaultError::IPFSCIDTooLong);
            data_entry.ipfs_cid = Some(cid);
        }

        emit!(DataUpdatedEvent {
            vault: vault.key(),
            data_entry: data_entry.key(),
            version: data_entry.version,
        });

        Ok(())
    }

    /// Delete data—erase a secret from the vault’s neon lattice.
    pub fn delete_data(ctx: Context<DeleteData>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let data_type_config = &mut ctx.accounts.data_type_config;
        let data_entry = &ctx.accounts.data_entry;

        require!(!vault.is_locked, GreylockerVaultError::VaultLocked);
        require!(data_entry.vault == vault.key(), GreylockerVaultError::InvalidDataEntry);
        require!(data_type_config.key() == data_entry.data_type_config, GreylockerVaultError::InvalidDataTypeConfig);

        let clock = Clock::get()?;
        vault.last_updated = clock.unix_timestamp;
        data_type_config.last_updated = clock.unix_timestamp;

        data_type_config.entry_count = data_type_config.entry_count.saturating_sub(1);
        vault.data_entries_count = vault.data_entries_count.saturating_sub(1);

        emit!(DataDeletedEvent {
            vault: vault.key(),
            data_entry: data_entry.key(),
            data_type: data_entry.data_type.clone(),
        });

        Ok(())
    }

    /// Grant access—open a neon portal to a service provider’s gaze.
    pub fn grant_access(
        ctx: Context<GrantAccess>,
        data_type_indices: Vec<u8>,
        duration: i64,
        access_fee: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let access_grant = &mut ctx.accounts.access_grant;

        require!(!vault.is_locked, GreylockerVaultError::VaultLocked);
        require!(data_type_indices.len() <= vault.data_types_count as usize, GreylockerVaultError::InvalidDataTypeIndex);
        require!(duration > 0, GreylockerVaultError::InvalidDuration);

        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;

        // TODO: CPI to main Greylocker program to validate service_provider and transfer access_fee
        access_grant.vault = vault.key();
        access_grant.service_provider = ctx.accounts.service_provider.key();
        access_grant.granted_at = current_time;
        access_grant.expires_at = current_time.checked_add(duration)
            .ok_or(GreylockerVaultError::ArithmeticOverflow)?;
        access_grant.revoked = false;
        access_grant.data_type_indices = data_type_indices;
        access_grant.access_fee = access_fee;
        access_grant.bump = *ctx.bumps.get("access_grant").unwrap();

        emit!(AccessGrantedEvent {
            vault: vault.key(),
            service_provider: access_grant.service_provider,
            access_grant: access_grant.key(),
            duration,
            access_fee,
        });

        Ok(())
    }

    /// Revoke access—slam shut the portal to a service provider’s eyes.
    pub fn revoke_access(ctx: Context<RevokeAccess>) -> Result<()> {
        let vault = &ctx.accounts.vault;
        let access_grant = &mut ctx.accounts.access_grant;

        require!(access_grant.vault == vault.key(), GreylockerVaultError::InvalidAccessGrant);
        require!(!access_grant.revoked, GreylockerVaultError::AccessAlreadyRevoked);

        access_grant.revoked = true;

        emit!(AccessRevokedEvent {
            vault: vault.key(),
            service_provider: access_grant.service_provider,
            access_grant: access_grant.key(),
        });

        Ok(())
    }

    /// Lock the vault—seal the citadel against all but its master.
    pub fn lock_vault(ctx: Context<LockUnlockVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(!vault.is_locked, GreylockerVaultError::VaultAlreadyLocked);

        vault.is_locked = true;

        emit!(VaultLockedEvent {
            vault: vault.key(),
            owner: ctx.accounts.user.key(),
        });

        Ok(())
    }

    /// Unlock the vault—reopen the citadel to its keeper’s will.
    pub fn unlock_vault(ctx: Context<LockUnlockVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(vault.is_locked, GreylockerVaultError::VaultNotLocked);

        vault.is_locked = false;

        emit!(VaultUnlockedEvent {
            vault: vault.key(),
            owner: ctx.accounts.user.key(),
        });

        Ok(())
    }

    /// Change storage type—rewire the vault’s data conduits.
    pub fn change_storage_type(ctx: Context<ManageVault>, new_storage_type: StorageType) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(!vault.is_locked, GreylockerVaultError::VaultLocked);

        vault.storage_type = new_storage_type;
        let clock = Clock::get()?;
        vault.last_updated = clock.unix_timestamp;

        emit!(StorageTypeChangedEvent {
            vault: vault.key(),
            storage_type: new_storage_type,
        });

        Ok(())
    }
}

// ----- ACCOUNT STRUCTURES -----

/// The Vault—a glowing citadel of encrypted identity data.
#[account]
#[derive(Default)]
pub struct Vault {
    pub owner: Pubkey,                // Master of the vault (32 bytes)
    pub name: String,                 // Vault’s moniker (4 + 50 bytes = 54 bytes)
    pub description: String,          // Purpose in words (4 + 200 bytes = 204 bytes)
    pub created_at: i64,              // Birth timestamp (8 bytes)
    pub last_updated: i64,            // Last modification (8 bytes)
    pub is_locked: bool,              // Lock state (1 byte)
    pub storage_type: StorageType,    // Storage method (1 byte + padding = 8 bytes)
    pub data_types_count: u8,         // Data type tally (1 byte)
    pub data_entries_count: u16,      // Entry tally (2 bytes)
    pub bump: u8,                     // PDA bump seed (1 byte)
}

impl Vault {
    // Space: 8 (discriminator) + 32 + 54 + 204 + 8 + 8 + 1 + 8 + 1 + 2 + 1 = 327 bytes
    pub const SPACE: usize = 8 + 32 + 54 + 204 + 8 + 8 + 1 + 8 + 1 + 2 + 1;
}

/// DataTypeConfig—rules governing a category of secrets.
#[account]
#[derive(Default)]
pub struct DataTypeConfig {
    pub vault: Pubkey,                // Parent vault (32 bytes)
    pub data_type: DataType,          // Data category (variable, ~58 bytes)
    pub encryption_level: EncryptionLevel, // Security strength (1 byte + padding = 8 bytes)
    pub sharing_preferences: SharingPreferences, // Access rules (1 byte + padding = 8 bytes)
    pub retention_period: i64,        // Lifespan (-1 for eternal) (8 bytes)
    pub created_at: i64,              // Creation timestamp (8 bytes)
    pub last_updated: i64,            // Last update (8 bytes)
    pub entry_count: u16,             // Entry tally (2 bytes)
    pub index: u8,                    // Position in vault (1 byte)
    pub bump: u8,                     // PDA bump seed (1 byte)
}

impl DataTypeConfig {
    // Space: 8 (discriminator) + 32 + 58 + 8 + 8 + 8 + 8 + 8 + 2 + 1 + 1 = 142 bytes
    pub const SPACE: usize = 8 + 32 + 58 + 8 + 8 + 8 + 8 + 8 + 2 + 1 + 1;
}

/// DataEntry—a sealed packet of encrypted truth.
#[account]
#[derive(Default)]
pub struct DataEntry {
    pub vault: Pubkey,                // Parent vault (32 bytes)
    pub data_type_config: Pubkey,     // Config linkage (32 bytes)
    pub encrypted_data: Vec<u8>,      // Encrypted payload (4 + 1024 bytes = 1028 bytes)
    pub metadata: String,             // Descriptor (4 + 200 bytes = 204 bytes)
    pub ipfs_cid: Option<String>,     // IPFS link (1 + 4 + 100 bytes = 105 bytes)
    pub data_type: DataType,          // Data category (variable, ~58 bytes)
    pub created_at: i64,              // Creation timestamp (8 bytes)
    pub last_updated: i64,            // Last update (8 bytes)
    pub version: u16,                 // Revision number (2 bytes)
    pub access_count: u32,            // Access tally (4 bytes)
    pub bump: u8,                     // PDA bump seed (1 byte)
}

impl DataEntry {
    // Space: 8 (discriminator) + 32 + 32 + 1028 + 204 + 105 + 58 + 8 + 8 + 2 + 4 + 1 = 1490 bytes
    pub const SPACE: usize = 8 + 32 + 32 + 1028 + 204 + 105 + 58 + 8 + 8 + 2 + 4 + 1;
}

/// AccessGrant—a neon keycard granting passage to vault secrets.
#[account]
#[derive(Default)]
pub struct AccessGrant {
    pub vault: Pubkey,                // Source vault (32 bytes)
    pub service_provider: Pubkey,     // Granted entity (32 bytes)
    pub granted_at: i64,              // Start timestamp (8 bytes)
    pub expires_at: i64,              // End timestamp (8 bytes)
    pub revoked: bool,                // Revocation state (1 byte)
    pub data_type_indices: Vec<u8>,   // Allowed types (4 + 32 bytes = 36 bytes)
    pub access_fee: u64,              // GREY paid (8 bytes)
    pub bump: u8,                     // PDA bump seed (1 byte)
}

impl AccessGrant {
    // Space: 8 (discriminator) + 32 + 32 + 8 + 8 + 1 + 36 + 8 + 1 = 134 bytes
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 1 + 36 + 8 + 1;
}

// ----- ENUM TYPES -----

/// StorageType—where the vault’s secrets reside.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum StorageType {
    #[default]
    IPFS,                     // Decentralized on IPFS, CID on-chain
    OnChain,                  // Fully on Solana (future use)
    ArweaveIPFS,              // Hybrid permanence (future use)
}

/// DataType—categories of encrypted truth.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum DataType {
    Identity,                 // Core identity data
    Payment,                  // Financial transactions
    Browsing,                 // Digital footprints
    Biometric,                // Physical signatures
    Location,                 // Spatial trails
    Social,                   // Network connections
    Medical,                  // Health records
    Financial,                // Wealth metrics
    Professional,             // Career history
    Communication,            // Messages and calls
    Custom(String),           // User-defined (4 + 50 bytes = 54 bytes)
}

impl Default for DataType {
    fn default() -> Self { DataType::Identity }
}

impl DataType {
    pub const MAX_SPACE: usize = 4 + 50;
}

/// EncryptionLevel—the strength of the vault’s digital armor.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum EncryptionLevel {
    #[default]
    Standard,                 // AES-256 baseline
    High,                     // Enhanced 384-bit
    Military,                 // Unbreakable 512-bit
}

/// SharingPreferences—rules for unveiling the vault’s secrets.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum SharingPreferences {
    #[default]
    Never,                    // Locked forever
    AskEveryTime,             // User approval per request
    Whitelist,                // Trusted services only
    DataPool,                 // Anonymized pools allowed
    Public,                   // Open to all (rare)
}

// ----- CONTEXT STRUCTURES -----

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = Vault::SPACE,
        seeds = [b"vault", user.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ManageVault<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump = vault.bump,
        constraint = vault.owner == user.key() @ GreylockerVaultError::NotVaultOwner
    )]
    pub vault: Account<'info, Vault>,
    /// CHECK: Initialized in instruction if needed
    #[account(mut)]
    pub data_type_config: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(data_type_index: u8)]
pub struct StoreData<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump = vault.bump,
        constraint = vault.owner == user.key() @ GreylockerVaultError::NotVaultOwner
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        seeds = [b"data-type-config", vault.key().as_ref(), &[data_type_index]],
        bump = data_type_config.bump,
        constraint = data_type_config.vault == vault.key() @ GreylockerVaultError::InvalidDataTypeConfig
    )]
    pub data_type_config: Account<'info, DataTypeConfig>,
    #[account(
        init,
        payer = user,
        space = DataEntry::SPACE,
        seeds = [
            b"data-entry",
            vault.key().as_ref(),
            data_type_config.key().as_ref(),
            &[data_type_config.entry_count],
        ],
        bump
    )]
    pub data_entry: Account<'info, DataEntry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateData<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump = vault.bump,
        constraint = vault.owner == user.key() @ GreylockerVaultError::NotVaultOwner
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        constraint = data_entry.vault == vault.key() @ GreylockerVaultError::InvalidDataEntry
    )]
    pub data_entry: Account<'info, DataEntry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DeleteData<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump = vault.bump,
        constraint = vault.owner == user.key() @ GreylockerVaultError::NotVaultOwner
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        constraint = data_type_config.vault == vault.key() @ GreylockerVaultError::InvalidDataTypeConfig
    )]
    pub data_type_config: Account<'info, DataTypeConfig>,
    #[account(
        mut,
        close = user,
        constraint = data_entry.vault == vault.key() @ GreylockerVaultError::InvalidDataEntry,
        constraint = data_entry.data_type_config == data_type_config.key() @ GreylockerVaultError::InvalidDataTypeConfig
    )]
    pub data_entry: Account<'info, DataEntry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GrantAccess<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump = vault.bump,
        constraint = vault.owner == user.key() @ GreylockerVaultError::NotVaultOwner
    )]
    pub vault: Account<'info, Vault>,
    /// CHECK: To be validated via CPI to main Greylocker program
    pub service_provider: AccountInfo<'info>,
    #[account(
        init,
        payer = user,
        space = AccessGrant::SPACE,
        seeds = [b"access-grant", vault.key().as_ref(), service_provider.key().as_ref()],
        bump
    )]
    pub access_grant: Account<'info, AccessGrant>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeAccess<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        seeds = [b"vault", user.key().as_ref()],
        bump = vault.bump,
        constraint = vault.owner == user.key() @ GreylockerVaultError::NotVaultOwner
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        mut,
        constraint = access_grant.vault == vault.key() @ GreylockerVaultError::InvalidAccessGrant
    )]
    pub access_grant: Account<'info, AccessGrant>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LockUnlockVault<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"vault", user.key().as_ref()],
        bump = vault.bump,
        constraint = vault.owner == user.key() @ GreylockerVaultError::NotVaultOwner
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

// ----- ERRORS -----

#[error_code]
pub enum GreylockerVaultError {
    #[msg("Not the vault owner")]
    NotVaultOwner,
    #[msg("Vault is locked")]
    VaultLocked,
    #[msg("Vault already locked")]
    VaultAlreadyLocked,
    #[msg("Vault not locked")]
    VaultNotLocked,
    #[msg("Invalid data type configuration")]
    InvalidDataTypeConfig,
    #[msg("Invalid data type index")]
    InvalidDataTypeIndex,
    #[msg("Invalid data entry")]
    InvalidDataEntry,
    #[msg("Invalid access grant")]
    InvalidAccessGrant,
    #[msg("Missing IPFS CID for IPFS storage")]
    MissingIPFSCID,
    #[msg("Service provider not registered")]
    ServiceProviderNotRegistered,
    #[msg("Access already granted")]
    AccessAlreadyGranted,
    #[msg("Access already revoked")]
    AccessAlreadyRevoked,
    #[msg("Name exceeds 50 characters")]
    NameTooLong,
    #[msg("Description exceeds 200 characters")]
    DescriptionTooLong,
    #[msg("Data exceeds 1024 bytes")]
    DataTooLarge,
    #[msg("Metadata exceeds 200 characters")]
    MetadataTooLong,
    #[msg("IPFS CID exceeds 100 characters")]
    IPFSCIDTooLong,
    #[msg("Too many data types (max 255)")]
    TooManyDataTypes,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Invalid duration")]
    InvalidDuration,
}

// ----- EVENTS -----

#[event]
pub struct VaultCreatedEvent {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub name: String,
    pub created_at: i64,
}

#[event]
pub struct DataTypeAddedEvent {
    pub vault: Pubkey,
    pub data_type: DataType,
    pub encryption_level: EncryptionLevel,
    pub sharing_preferences: SharingPreferences,
    pub retention_period: i64,
}

#[event]
pub struct DataStoredEvent {
    pub vault: Pubkey,
    pub data_entry: Pubkey,
    pub data_type: DataType,
}

#[event]
pub struct DataUpdatedEvent {
    pub vault: Pubkey,
    pub data_entry: Pubkey,
    pub version: u16,
}

#[event]
pub struct DataDeletedEvent {
    pub vault: Pubkey,
    pub data_entry: Pubkey,
    pub data_type: DataType,
}

#[event]
pub struct AccessGrantedEvent {
    pub vault: Pubkey,
    pub service_provider: Pubkey,
    pub access_grant: Pubkey,
    pub duration: i64,
    pub access_fee: u64,
}

#[event]
pub struct AccessRevokedEvent {
    pub vault: Pubkey,
    pub service_provider: Pubkey,
    pub access_grant: Pubkey,
}

#[event]
pub struct VaultLockedEvent {
    pub vault: Pubkey,
    pub owner: Pubkey,
}

#[event]
pub struct VaultUnlockedEvent {
    pub vault: Pubkey,
    pub owner: Pubkey,
}

#[event]
pub struct StorageTypeChangedEvent {
    pub vault: Pubkey,
    pub storage_type: StorageType,
}
