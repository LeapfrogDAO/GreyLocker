// greylocker_zkp/programs/greylocker_zkp/src/lib.rs
// The Greylocker ZKP Program—a cryptographic labyrinth in Solana’s neon grid

use anchor_lang::prelude::*;
use solana_program::{
    keccak,
    program::{invoke, invoke_signed},
    system_instruction,
    sysvar::{clock::Clock, rent::Rent},
};

// Program ID (replace with deployed ID)
declare_id!("GREY1zkpXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

#[program]
pub mod greylocker_zkp {
    use super::*;

    /// Initialize a ZKP registry—forge a user’s gateway to cryptographic shadows.
    pub fn initialize_registry(ctx: Context<InitializeRegistry>) -> Result<()> {
        let registry = &mut ctx.accounts.zkp_registry;
        let user = &ctx.accounts.user;

        let clock = Clock::get()?;
        registry.owner = user.key();
        registry.created_at = clock.unix_timestamp;
        registry.last_updated = clock.unix_timestamp;
        registry.proof_count = 0;
        registry.verification_count = 0;
        registry.bump = *ctx.bumps.get("zkp_registry").unwrap();

        emit!(RegistryCreatedEvent {
            registry: registry.key(),
            owner: user.key(),
            created_at: registry.created_at,
        });

        Ok(())
    }

    /// Register a verification key—plant a cryptographic beacon in the grid.
    pub fn register_verification_key(
        ctx: Context<RegisterVerificationKey>,
        proof_type: ProofType,
        circuit_id: String,
        verification_key: Vec<u8>,
        description: String,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.zkp_registry;
        let vk_account = &mut ctx.accounts.verification_key_account;

        require!(circuit_id.len() <= 50, GreylockerZKPError::CircuitIdTooLong);
        require!(verification_key.len() <= 1024, GreylockerZKPError::VerificationKeyTooLarge);
        require!(description.len() <= 200, GreylockerZKPError::DescriptionTooLong);
        require!(registry.proof_count < u16::MAX, GreylockerZKPError::TooManyProofs);

        let clock = Clock::get()?;
        registry.last_updated = clock.unix_timestamp;
        registry.proof_count = registry.proof_count.checked_add(1)
            .ok_or(GreylockerZKPError::ArithmeticOverflow)?;

        vk_account.registry = registry.key();
        vk_account.proof_type = proof_type.clone();
        vk_account.circuit_id = circuit_id.clone();
        vk_account.verification_key = verification_key;
        vk_account.description = description;
        vk_account.created_at = clock.unix_timestamp;
        vk_account.verification_count = 0;
        vk_account.is_active = true;
        vk_account.bump = *ctx.bumps.get("verification_key_account").unwrap();

        emit!(VerificationKeyRegisteredEvent {
            registry: registry.key(),
            verification_key_account: vk_account.key(),
            proof_type,
            circuit_id,
        });

        Ok(())
    }

    /// Submit a ZKP—cast a shadow of truth into the neon void.
    pub fn submit_proof(
        ctx: Context<SubmitProof>,
        proof_data: Vec<u8>,
        public_inputs: Vec<Vec<u8>>,
        metadata: Option<String>,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.zkp_registry;
        let vk_account = &mut ctx.accounts.verification_key_account;
        let proof_submission = &mut ctx.accounts.proof_submission;

        require!(vk_account.is_active, GreylockerZKPError::VerificationKeyInactive);
        require!(proof_data.len() <= 2048, GreylockerZKPError::ProofDataTooLarge);
        require!(public_inputs.len() <= 32, GreylockerZKPError::TooManyPublicInputs);
        for input in &public_inputs {
            require!(input.len() <= 256, GreylockerZKPError::PublicInputTooLarge);
        }
        if let Some(ref meta) = metadata {
            require!(meta.len() <= 200, GreylockerZKPError::MetadataTooLong);
        }

        let clock = Clock::get()?;
        registry.verification_count = registry.verification_count.checked_add(1)
            .ok_or(GreylockerZKPError::ArithmeticOverflow)?;
        vk_account.verification_count = vk_account.verification_count.checked_add(1)
            .ok_or(GreylockerZKPError::ArithmeticOverflow)?;

        proof_submission.registry = registry.key();
        proof_submission.verification_key_account = vk_account.key();
        proof_submission.submitted_by = ctx.accounts.user.key();
        proof_submission.proof_data = proof_data;
        proof_submission.public_inputs = public_inputs;
        proof_submission.submitted_at = clock.unix_timestamp;
        proof_submission.verified = false;
        proof_submission.verification_timestamp = None;
        proof_submission.metadata = metadata.unwrap_or_default();
        proof_submission.bump = *ctx.bumps.get("proof_submission").unwrap();

        emit!(ProofSubmittedEvent {
            registry: registry.key(),
            verification_key_account: vk_account.key(),
            proof_submission: proof_submission.key(),
            submitted_by: ctx.accounts.user.key(),
        });

        Ok(())
    }

    /// Verify a proof—pierce the shadow to reveal its truth.
    pub fn verify_proof(ctx: Context<VerifyProof>) -> Result<()> {
        let proof_submission = &mut ctx.accounts.proof_submission;
        let vk_account = &ctx.accounts.verification_key_account;

        require!(!proof_submission.verified, GreylockerZKPError::ProofAlreadyVerified);
        require!(
            proof_submission.verification_key_account == vk_account.key(),
            GreylockerZKPError::VerificationKeyMismatch
        );

        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;

        // Placeholder for real ZKP verification (e.g., Groth16)
        let is_valid = mock_verify_proof(
            &vk_account.verification_key,
            &proof_submission.proof_data,
            &proof_submission.public_inputs,
        );
        require!(is_valid, GreylockerZKPError::InvalidProof);

        proof_submission.verified = true;
        proof_submission.verification_timestamp = Some(current_time);

        emit!(ProofVerifiedEvent {
            registry: proof_submission.registry,
            proof_submission: proof_submission.key(),
            verified_at: current_time,
        });

        Ok(())
    }

    /// Generate a credential—mint a cryptographic token of truth.
    pub fn generate_credential(
        ctx: Context<GenerateCredential>,
        credential_type: CredentialType,
        expires_at: Option<i64>,
        allowed_verifiers: Option<Vec<Pubkey>>,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.zkp_registry;
        let proof_submission = &ctx.accounts.proof_submission;
        let credential = &mut ctx.accounts.credential;

        require!(proof_submission.verified, GreylockerZKPError::ProofNotVerified);

        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;
        let expiration = match expires_at {
            Some(timestamp) => {
                require!(timestamp > current_time, GreylockerZKPError::InvalidExpirationTime);
                timestamp
            }
            None => current_time.checked_add(30 * 24 * 60 * 60) // 30 days default
                .ok_or(GreylockerZKPError::ArithmeticOverflow)?,
        };

        if let Some(ref verifiers) = allowed_verifiers {
            require!(verifiers.len() <= 10, GreylockerZKPError::TooManyVerifiers);
        }

        credential.registry = registry.key();
        credential.proof_submission = proof_submission.key();
        credential.owner = ctx.accounts.user.key();
        credential.credential_type = credential_type.clone();
        credential.created_at = current_time;
        credential.expires_at = expiration;
        credential.revoked = false;
        credential.use_count = 0;
        credential.allowed_verifiers = allowed_verifiers.unwrap_or_default();
        credential.bump = *ctx.bumps.get("credential").unwrap();

        emit!(CredentialGeneratedEvent {
            registry: registry.key(),
            credential: credential.key(),
            credential_type,
            expires_at: expiration,
        });

        Ok(())
    }

    /// Use a credential—flash a shadow key to prove without revealing.
    pub fn use_credential(ctx: Context<UseCredential>, verifier: Pubkey, purpose: String) -> Result<()> {
        let credential = &mut ctx.accounts.credential;
        let credential_use = &mut ctx.accounts.credential_use;

        require!(!credential.revoked, GreylockerZKPError::CredentialRevoked);
        require!(purpose.len() <= 200, GreylockerZKPError::PurposeTooLong);

        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;
        require!(current_time < credential.expires_at, GreylockerZKPError::CredentialExpired);

        if !credential.allowed_verifiers.is_empty() {
            require!(
                credential.allowed_verifiers.contains(&verifier),
                GreylockerZKPError::VerifierNotAllowed
            );
        }

        credential.use_count = credential.use_count.checked_add(1)
            .ok_or(GreylockerZKPError::ArithmeticOverflow)?;

        credential_use.credential = credential.key();
        credential_use.used_at = current_time;
        credential_use.verifier = verifier;
        credential_use.purpose = purpose.clone();
        credential_use.owner = ctx.accounts.user.key();
        credential_use.bump = *ctx.bumps.get("credential_use").unwrap();

        emit!(CredentialUsedEvent {
            credential: credential.key(),
            use_record: credential_use.key(),
            verifier,
            used_at: current_time,
        });

        Ok(())
    }

    /// Revoke a credential—extinguish a shadow key’s light.
    pub fn revoke_credential(ctx: Context<RevokeCredential>) -> Result<()> {
        let credential = &mut ctx.accounts.credential;

        require!(!credential.revoked, GreylockerZKPError::CredentialAlreadyRevoked);

        credential.revoked = true;
        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;

        emit!(CredentialRevokedEvent {
            credential: credential.key(),
            revoked_at: current_time,
            revoked_by: ctx.accounts.user.key(),
        });

        Ok(())
    }

    /// Deactivate a verification key—dim a beacon in the grid.
    pub fn deactivate_verification_key(ctx: Context<ManageVerificationKey>) -> Result<()> {
        let vk_account = &mut ctx.accounts.verification_key_account;

        require!(vk_account.is_active, GreylockerZKPError::VerificationKeyAlreadyInactive);
        vk_account.is_active = false;

        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;

        emit!(VerificationKeyDeactivatedEvent {
            verification_key_account: vk_account.key(),
            deactivated_at: current_time,
        });

        Ok(())
    }

    /// Reactivate a verification key—relight a beacon’s glow.
    pub fn reactivate_verification_key(ctx: Context<ManageVerificationKey>) -> Result<()> {
        let vk_account = &mut ctx.accounts.verification_key_account;

        require!(!vk_account.is_active, GreylockerZKPError::VerificationKeyAlreadyActive);
        vk_account.is_active = true;

        let clock = Clock::get()?;
        let current_time = clock.unix_timestamp;

        emit!(VerificationKeyReactivatedEvent {
            verification_key_account: vk_account.key(),
            reactivated_at: current_time,
        });

        Ok(())
    }

    // Mock verification function—placeholder for real ZKP logic
    fn mock_verify_proof(_vk: &[u8], _proof: &[u8], _inputs: &[Vec<u8>]) -> bool {
        // TODO: Replace with real Groth16 or SNARK verification (e.g., via arkworks)
        true
    }
}

// ----- ACCOUNT STRUCTURES -----

/// ZKPRegistry—the user’s cryptographic sanctum.
#[account]
#[derive(Default)]
pub struct ZKPRegistry {
    pub owner: Pubkey,                // Master of the registry (32 bytes)
    pub created_at: i64,              // Birth timestamp (8 bytes)
    pub last_updated: i64,            // Last update (8 bytes)
    pub proof_count: u16,             // Proof type tally (2 bytes)
    pub verification_count: u32,      // Verification tally (4 bytes)
    pub bump: u8,                     // PDA bump seed (1 byte)
}

impl ZKPRegistry {
    // Space: 8 (discriminator) + 32 + 8 + 8 + 2 + 4 + 1 = 63 bytes
    pub const SPACE: usize = 8 + 32 + 8 + 8 + 2 + 4 + 1;
}

/// VerificationKeyAccount—a beacon for validating shadows.
#[account]
#[derive(Default)]
pub struct VerificationKeyAccount {
    pub registry: Pubkey,             // Parent registry (32 bytes)
    pub proof_type: ProofType,        // Proof category (variable, ~54 bytes)
    pub circuit_id: String,           // Circuit identifier (4 + 50 bytes = 54 bytes)
    pub verification_key: Vec<u8>,    // Verification key (4 + 1024 bytes = 1028 bytes)
    pub description: String,          // Purpose (4 + 200 bytes = 204 bytes)
    pub created_at: i64,              // Creation timestamp (8 bytes)
    pub verification_count: u32,      // Use tally (4 bytes)
    pub is_active: bool,              // Active state (1 byte)
    pub bump: u8,                     // PDA bump seed (1 byte)
}

impl VerificationKeyAccount {
    // Space: 8 (discriminator) + 32 + 54 + 54 + 1028 + 204 + 8 + 4 + 1 + 1 = 1394 bytes
    pub const SPACE: usize = 8 + 32 + 54 + 54 + 1028 + 204 + 8 + 4 + 1 + 1;
}

/// ProofSubmission—a shadow cast for verification.
#[account]
#[derive(Default)]
pub struct ProofSubmission {
    pub registry: Pubkey,             // Parent registry (32 bytes)
    pub verification_key_account: Pubkey, // Verification beacon (32 bytes)
    pub submitted_by: Pubkey,         // Shadow caster (32 bytes)
    pub proof_data: Vec<u8>,          // ZKP proof (4 + 2048 bytes = 2052 bytes)
    pub public_inputs: Vec<Vec<u8>>,  // Public inputs (4 + 32 * 256 bytes = 8196 bytes)
    pub submitted_at: i64,            // Submission timestamp (8 bytes)
    pub verified: bool,               // Verification state (1 byte)
    pub verification_timestamp: Option<i64>, // Verification time (1 + 8 bytes = 9 bytes)
    pub metadata: String,             // Descriptor (4 + 200 bytes = 204 bytes)
    pub bump: u8,                     // PDA bump seed (1 byte)
}

impl ProofSubmission {
    // Space: 8 (discriminator) + 32 + 32 + 32 + 2052 + 8196 + 8 + 1 + 9 + 204 + 1 = 10,575 bytes
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 2052 + 8196 + 8 + 1 + 9 + 204 + 1;
}

/// Credential—a glowing token of verified truth.
#[account]
#[derive(Default)]
pub struct Credential {
    pub registry: Pubkey,             // Parent registry (32 bytes)
    pub proof_submission: Pubkey,     // Source proof (32 bytes)
    pub owner: Pubkey,                // Token holder (32 bytes)
    pub credential_type: CredentialType, // Credential purpose (variable, ~54 bytes)
    pub created_at: i64,              // Creation timestamp (8 bytes)
    pub expires_at: i64,              // Expiry timestamp (8 bytes)
    pub revoked: bool,                // Revocation state (1 byte)
    pub use_count: u32,               // Usage tally (4 bytes)
    pub allowed_verifiers: Vec<Pubkey>, // Verifier whitelist (4 + 10 * 32 bytes = 324 bytes)
    pub bump: u8,                     // PDA bump seed (1 byte)
}

impl Credential {
    // Space: 8 (discriminator) + 32 + 32 + 32 + 54 + 8 + 8 + 1 + 4 + 324 + 1 = 504 bytes
    pub const SPACE: usize = 8 + 32 + 32 + 32 + 54 + 8 + 8 + 1 + 4 + 324 + 1;
}

/// CredentialUse—a record of a shadow key’s unveiling.
#[account]
#[derive(Default)]
pub struct CredentialUse {
    pub credential: Pubkey,           // Source credential (32 bytes)
    pub used_at: i64,                 // Usage timestamp (8 bytes)
    pub verifier: Pubkey,             // Verifying entity (32 bytes)
    pub purpose: String,              // Usage intent (4 + 200 bytes = 204 bytes)
    pub owner: Pubkey,                // User who used it (32 bytes)
    pub bump: u8,                     // PDA bump seed (1 byte)
}

impl CredentialUse {
    // Space: 8 (discriminator) + 32 + 8 + 32 + 204 + 32 + 1 = 317 bytes
    pub const SPACE: usize = 8 + 32 + 8 + 32 + 204 + 32 + 1;
}

// ----- ENUM TYPES -----

/// ProofType—categories of cryptographic shadows.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum ProofType {
    #[default]
    AgeVerification,          // Prove age without disclosure
    LocationVerification,     // Prove location in secret
    FinancialVerification,    // Prove wealth discreetly
    IdentityVerification,     // Prove identity anonymously
    MembershipVerification,   // Prove group membership
    AttributeVerification,    // Prove traits unseen
    RangeProof,               // Prove value ranges
    SetMembership,            // Prove set inclusion
    Custom(String),           // User-defined proof (4 + 50 bytes = 54 bytes)
}

impl ProofType {
    pub const MAX_SPACE: usize = 4 + 50;
}

/// CredentialType—tokens of hidden truth.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Default)]
pub enum CredentialType {
    #[default]
    AgeCredential,            // Age-based token
    LocationCredential,       // Location-based token
    FinancialCredential,      // Wealth-based token
    IdentityCredential,       // Identity token
    MembershipCredential,     // Membership token
    CustomCredential(String), // Custom token (4 + 50 bytes = 54 bytes)
}

impl CredentialType {
    pub const MAX_SPACE: usize = 4 + 50;
}

// ----- CONTEXT STRUCTURES -----

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = ZKPRegistry::SPACE,
        seeds = [b"zkp-registry", user.key().as_ref()],
        bump
    )]
    pub zkp_registry: Account<'info, ZKPRegistry>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterVerificationKey<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"zkp-registry", user.key().as_ref()],
        bump = zkp_registry.bump,
        constraint = zkp_registry.owner == user.key() @ GreylockerZKPError::NotRegistryOwner
    )]
    pub zkp_registry: Account<'info, ZKPRegistry>,
    #[account(
        init,
        payer = user,
        space = VerificationKeyAccount::SPACE,
        seeds = [b"verification-key", zkp_registry.key().as_ref(), &[zkp_registry.proof_count]],
        bump
    )]
    pub verification_key_account: Account<'info, VerificationKeyAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitProof<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub zkp_registry: Account<'info, ZKPRegistry>,
    #[account(
        mut,
        constraint = verification_key_account.registry == zkp_registry.key() @ GreylockerZKPError::InvalidVerificationKey
    )]
    pub verification_key_account: Account<'info, VerificationKeyAccount>,
    #[account(
        init,
        payer = user,
        space = ProofSubmission::SPACE,
        seeds = [
            b"proof-submission",
            verification_key_account.key().as_ref(),
            &[verification_key_account.verification_count.to_le_bytes()[0]],
        ],
        bump
    )]
    pub proof_submission: Account<'info, ProofSubmission>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyProof<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        constraint = proof_submission.submitted_by == user.key() @ GreylockerZKPError::NotProofOwner
    )]
    pub proof_submission: Account<'info, ProofSubmission>,
    #[account(
        constraint = verification_key_account.key() == proof_submission.verification_key_account @ GreylockerZKPError::VerificationKeyMismatch
    )]
    pub verification_key_account: Account<'info, VerificationKeyAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GenerateCredential<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub zkp_registry: Account<'info, ZKPRegistry>,
    #[account(
        constraint = proof_submission.submitted_by == user.key() @ GreylockerZKPError::NotProofOwner,
        constraint = proof_submission.verified @ GreylockerZKPError::ProofNotVerified
    )]
    pub proof_submission: Account<'info, ProofSubmission>,
    #[account(
        init,
        payer = user,
        space = Credential::SPACE,
        seeds = [b"credential", proof_submission.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub credential: Account<'info, Credential>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UseCredential<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        constraint = credential.owner == user.key() @ GreylockerZKPError::NotCredentialOwner
    )]
    pub credential: Account<'info, Credential>,
    #[account(
        init,
        payer = user,
        space = CredentialUse::SPACE,
        seeds = [b"credential-use", credential.key().as_ref(), &[credential.use_count.to_le_bytes()[0]]],
        bump
    )]
    pub credential_use: Account<'info, CredentialUse>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeCredential<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        constraint = credential.owner == user.key() @ GreylockerZKPError::NotCredentialOwner
    )]
    pub credential: Account<'info, Credential>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ManageVerificationKey<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        seeds = [b"zkp-registry", user.key().as_ref()],
        bump = zkp_registry.bump,
        constraint = zkp_registry.owner == user.key() @ GreylockerZKPError::NotRegistryOwner
    )]
    pub zkp_registry: Account<'info, ZKPRegistry>,
    #[account(
        mut,
        constraint = verification_key_account.registry == zkp_registry.key() @ GreylockerZKPError::InvalidVerificationKey
    )]
    pub verification_key_account: Account<'info, VerificationKeyAccount>,
    pub system_program: Program<'info, System>,
}

// ----- ERRORS -----

#[error_code]
pub enum GreylockerZKPError {
    #[msg("Not the registry owner")]
    NotRegistryOwner,
    #[msg("Invalid verification key")]
    InvalidVerificationKey,
    #[msg("Verification key is inactive")]
    VerificationKeyInactive,
    #[msg("Verification key already inactive")]
    VerificationKeyAlreadyInactive,
    #[msg("Verification key already active")]
    VerificationKeyAlreadyActive,
    #[msg("Not the proof owner")]
    NotProofOwner,
    #[msg("Proof already verified")]
    ProofAlreadyVerified,
    #[msg("Proof not verified")]
    ProofNotVerified,
    #[msg("Invalid proof")]
    InvalidProof,
    #[msg("Verification key mismatch")]
    VerificationKeyMismatch,
    #[msg("Not the credential owner")]
    NotCredentialOwner,
    #[msg("Credential has been revoked")]
    CredentialRevoked,
    #[msg("Credential already revoked")]
    CredentialAlreadyRevoked,
    #[msg("Credential has expired")]
    CredentialExpired,
    #[msg("Verifier not allowed for this credential")]
    VerifierNotAllowed,
    #[msg("Invalid expiration time")]
    InvalidExpirationTime,
    #[msg("Circuit ID exceeds 50 characters")]
    CircuitIdTooLong,
    #[msg("Verification key exceeds 1024 bytes")]
    VerificationKeyTooLarge,
    #[msg("Description exceeds 200 characters")]
    DescriptionTooLong,
    #[msg("Proof data exceeds 2048 bytes")]
    ProofDataTooLarge,
    #[msg("Too many public inputs (max 32)")]
    TooManyPublicInputs,
    #[msg("Public input exceeds 256 bytes")]
    PublicInputTooLarge,
    #[msg("Metadata exceeds 200 characters")]
    MetadataTooLong,
    #[msg("Purpose exceeds 200 characters")]
    PurposeTooLong,
    #[msg("Too many verifiers (max 10)")]
    TooManyVerifiers,
    #[msg("Too many proof types (max 65535)")]
    TooManyProofs,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}

// ----- EVENTS -----

#[event]
pub struct RegistryCreatedEvent {
    pub registry: Pubkey,
    pub owner: Pubkey,
    pub created_at: i64,
}

#[event]
pub struct VerificationKeyRegisteredEvent {
    pub registry: Pubkey,
    pub verification_key_account: Pubkey,
    pub proof_type: ProofType,
    pub circuit_id: String,
}

#[event]
pub struct ProofSubmittedEvent {
    pub registry: Pubkey,
    pub verification_key_account: Pubkey,
    pub proof_submission: Pubkey,
    pub submitted_by: Pubkey,
}

#[event]
pub struct ProofVerifiedEvent {
    pub registry: Pubkey,
    pub proof_submission: Pubkey,
    pub verified_at: i64,
}

#[event]
pub struct CredentialGeneratedEvent {
    pub registry: Pubkey,
    pub credential: Pubkey,
    pub credential_type: CredentialType,
    pub expires_at: i64,
}

#[event]
pub struct CredentialUsedEvent {
    pub credential: Pubkey,
    pub use_record: Pubkey,
    pub verifier: Pubkey,
    pub used_at: i64,
}

#[event]
pub struct CredentialRevokedEvent {
    pub credential: Pubkey,
    pub revoked_at: i64,
    pub revoked_by: Pubkey,
}

#[event]
pub struct VerificationKeyDeactivatedEvent {
    pub verification_key_account: Pubkey,
    pub deactivated_at: i64,
}

#[event]
pub struct VerificationKeyReactivatedEvent {
    pub verification_key_account: Pubkey,
    pub reactivated_at: i64,
}
