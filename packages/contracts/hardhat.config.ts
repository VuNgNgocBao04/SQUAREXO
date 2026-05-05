import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const privateKey = process.env.DEPLOYER_PRIVATE_KEY ?? "";
const normalizedPrivateKey = privateKey.length > 0 && !privateKey.startsWith("0x")
  ? `0x${privateKey}`
  : privateKey;

const testnetRpc = process.env.OASIS_RPC_URL ?? "https://testnet.sapphire.oasis.io";
const mainnetRpc = process.env.OASIS_MAINNET_RPC_URL ?? "https://sapphire.oasis.io";

// Optional explorer API key (Etherscan-style). Use SAPPHIRE_EXPLORER_API_KEY for verification.
const sapphireExplorerKey = process.env.SAPPHIRE_EXPLORER_API_KEY ?? process.env.ETHERSCAN_API_KEY ?? "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      // Make metadata deterministic to help reproducible builds and source verification
      metadata: {
        bytecodeHash: "none",
      },
    },
  },
  networks: {
    sapphireTestnet: {
      chainId: 0x5aff,
      url: testnetRpc,
      accounts: normalizedPrivateKey ? [normalizedPrivateKey] : [],
      timeout: 60_000,
    },
    sapphireMainnet: {
      chainId: 0x5afe,
      url: mainnetRpc,
      accounts: normalizedPrivateKey ? [normalizedPrivateKey] : [],
      timeout: 60_000,
    },
  },
  // Configure verification plugin (hardhat-toolbox provides etherscan integration)
  etherscan: {
    apiKey: {
      // If the explorer is Etherscan-like, set here. Keep blank by default.
      sapphire: sapphireExplorerKey,
    },
  },
  sourcify: {
    enabled: true,
  },
};

export default config;
