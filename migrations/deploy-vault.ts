import * as anchor from '@coral-xyz/anchor';
const programId = new anchor.web3.PublicKey('GREY1vauLtXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
async function deployVault() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.GreylockerVault as anchor.Program;
  console.log(`Deploying Vault to ${provider.connection.rpcEndpoint} at ${programId.toBase58()}`);
}
deployVault().catch(console.error);
