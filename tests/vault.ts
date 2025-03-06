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
