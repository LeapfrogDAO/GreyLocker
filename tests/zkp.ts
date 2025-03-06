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
