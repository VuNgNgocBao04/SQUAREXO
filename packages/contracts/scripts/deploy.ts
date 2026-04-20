import { ethers } from "hardhat";

async function main() {
  const backendSigner = process.env.BACKEND_SIGNER_ADDRESS;
  if (!backendSigner) {
    throw new Error("Missing BACKEND_SIGNER_ADDRESS in environment");
  }

  const joinTimeoutSeconds = Number(process.env.MATCH_JOIN_TIMEOUT_SECONDS ?? 900);
  const resultTimeoutSeconds = Number(process.env.MATCH_RESULT_TIMEOUT_SECONDS ?? 3600);

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const factory = await ethers.getContractFactory("SquarexoMatch");
  const contract = await factory.deploy(
    deployer.address,
    backendSigner,
    joinTimeoutSeconds,
    resultTimeoutSeconds,
  );

  await contract.waitForDeployment();

  console.log("SquarexoMatch deployed at:", await contract.getAddress());
  console.log("BACKEND_SIGNER role granted to:", backendSigner);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
