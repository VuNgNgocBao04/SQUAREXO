import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const privateKey = process.env.DEPLOYER_PRIVATE_KEY ?? "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    sapphireTestnet: {
      chainId: 0x5aff,
      url: process.env.OASIS_RPC_URL ?? "https://testnet.sapphire.oasis.io",
      accounts: privateKey ? [privateKey] : [],
    },
    sapphireMainnet: {
      chainId: 0x5afe,
      url: process.env.OASIS_MAINNET_RPC_URL ?? "https://sapphire.oasis.io",
      accounts: privateKey ? [privateKey] : [],
    },
  },
};

export default config;
