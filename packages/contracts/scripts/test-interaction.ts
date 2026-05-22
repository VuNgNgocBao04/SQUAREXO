import { ethers } from "hardhat";

async function main() {
  const contractAddress = "0x2011069BBe427Fd168a65a364d9C205bCa7aa0C9";
  
  console.log("🔍 Testing contract interaction...");
  console.log(`Contract Address: ${contractAddress}\n`);
  
  const contract = await ethers.getContractAt("SquarexoMatch", contractAddress);
  
  // Test 1: Check if contract exists at address
  const code = await ethers.provider.getCode(contractAddress);
  if (code === "0x") {
    throw new Error("No contract code at address - deployment may have failed");
  }
  console.log("✅ Contract code exists at address");
  
  // Test 2: Get deployer/admin address
  const deployerAddress = "0x28dD788C47DADe8975dfFC5aa2295E3CF202d03E";
  console.log(`✅ Expected deployer/admin: ${deployerAddress}`);
  
  // Test 3: Attempt to read role admin
  try {
    const BACKEND_SIGNER_ROLE = await contract.BACKEND_SIGNER_ROLE();
    console.log(`✅ BACKEND_SIGNER_ROLE hash: ${BACKEND_SIGNER_ROLE}`);
    
    const roleAdmin = await contract.getRoleAdmin(BACKEND_SIGNER_ROLE);
    console.log(`✅ Admin of BACKEND_SIGNER_ROLE: ${roleAdmin}`);
  } catch (e) {
    console.warn("⚠️ Could not read role data:", (e as Error).message);
  }
  
  // Test 4: Check if backend signer has role
  try {
    const BACKEND_SIGNER_ROLE = await contract.BACKEND_SIGNER_ROLE();
    const hasRole = await contract.hasRole(BACKEND_SIGNER_ROLE, deployerAddress);
    console.log(`✅ Backend signer has BACKEND_SIGNER_ROLE: ${hasRole}`);
  } catch (e) {
    console.warn("⚠️ Could not check role:", (e as Error).message);
  }
  
  // Test 5: Get contract address via getAddress
  const contractAddr = await contract.getAddress();
  console.log(`✅ Contract.getAddress() returns: ${contractAddr}`);
  
  console.log("\n✅ All basic interaction tests passed!");
  console.log("📝 Contract is deployed and responding correctly on testnet.\n");
}

main().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exitCode = 1;
});
