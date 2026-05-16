import { ethers } from "hardhat";

async function main() {
  const backendSigner = process.env.BACKEND_SIGNER_ADDRESS;
  if (!backendSigner) {
    throw new Error("Missing BACKEND_SIGNER_ADDRESS in environment");
  }
  if (!ethers.isAddress(backendSigner)) {
    throw new Error("BACKEND_SIGNER_ADDRESS is not a valid EVM address");
  }

  const joinTimeoutSeconds = Number(process.env.MATCH_JOIN_TIMEOUT_SECONDS ?? 900);
  const resultTimeoutSeconds = Number(process.env.MATCH_RESULT_TIMEOUT_SECONDS ?? 3600);
  if (!Number.isFinite(joinTimeoutSeconds) || joinTimeoutSeconds < 60 || joinTimeoutSeconds > 86400) {
    throw new Error("MATCH_JOIN_TIMEOUT_SECONDS must be between 60 and 86400");
  }
  if (!Number.isFinite(resultTimeoutSeconds) || resultTimeoutSeconds < 120 || resultTimeoutSeconds > 172800) {
    throw new Error("MATCH_RESULT_TIMEOUT_SECONDS must be between 120 and 172800");
  }

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("Deploying with:", deployer.address);
  console.log("Network chainId:", network.chainId.toString());

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
