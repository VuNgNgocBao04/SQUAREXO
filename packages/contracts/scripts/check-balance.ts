import { ethers } from "hardhat";

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");
  }
  
  const wallet = new ethers.Wallet(pk);
  console.log("Deployer wallet address:", wallet.address);
  
  // Check balance on current network
  const provider = ethers.provider;
  const network = await provider.getNetwork();
  const balance = await provider.getBalance(wallet.address);
  
  console.log(`\nNetwork: ${network.name} (chainId: ${network.chainId})`);
  console.log(`Balance: ${ethers.formatEther(balance)} ROSE`);
  
  if (balance.toString() === "0") {
    console.log("\n⚠️  WARNING: Account has 0 balance! Need to fund this address from faucet.");
    console.log(`   Address to fund: ${wallet.address}`);
  }
}

main().catch(console.error);
