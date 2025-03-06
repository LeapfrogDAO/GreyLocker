import * as anchor from '@coral-xyz/anchor';
const programId = new anchor.web3.PublicKey('GREY1zkpXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
async function deployZKP() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.GreylockerZkp as anchor.Program;
  console.log(`Deploying ZKP to ${provider.connection.rpcEndpoint} at ${programId.toBase58()}`);
}
deployZKP().catch(console.error);
