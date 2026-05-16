import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

async function expectCustomError(promise: Promise<unknown>, customErrorName: string) {
  try {
    await promise;
    throw new Error(`Expected transaction to revert with ${customErrorName}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    expect(message).to.include(customErrorName);
  }
}

async function expectSuccess(promise: Promise<unknown>) {
  await promise;
}

async function deployMatchFixture() {
  const [admin, backendSigner, creator, opponent, outsider] = await ethers.getSigners();

  const factory = await ethers.getContractFactory("SquarexoMatch");
  const contract = await factory.deploy(admin.address, backendSigner.address, 120, 180);
  await contract.waitForDeployment();

  return { contract, admin, backendSigner, creator, opponent, outsider };
}

describe("SquarexoMatch security", () => {
  it("rejects empty room id", async () => {
    const { contract, creator } = await loadFixture(deployMatchFixture);

    await expectCustomError(
      contract.connect(creator).createMatch("", ethers.parseEther("0.1"), {
        value: ethers.parseEther("0.1"),
      }),
      "InvalidRoomId",
    );
  });

  it("prevents creator joining their own match", async () => {
    const { contract, creator } = await loadFixture(deployMatchFixture);
    const bet = ethers.parseEther("0.05");

    await contract.connect(creator).createMatch("ROOM_1", bet, { value: bet });

    await expectCustomError(
      contract.connect(creator).joinMatch("ROOM_1", { value: bet }),
      "Unauthorized",
    );
  });

  it("allows only backend signer to submit result", async () => {
    const { contract, creator, opponent, outsider } = await loadFixture(deployMatchFixture);
    const bet = ethers.parseEther("0.05");

    await contract.connect(creator).createMatch("ROOM_2", bet, { value: bet });
    await contract.connect(opponent).joinMatch("ROOM_2", { value: bet });

    await expectCustomError(
      contract.connect(outsider).submitResult("ROOM_2", creator.address),
      "AccessControlUnauthorizedAccount",
    );
  });

  it("blocks result submission after deadline and allows force draw timeout", async () => {
    const { contract, backendSigner, creator, opponent } = await loadFixture(deployMatchFixture);
    const bet = ethers.parseEther("0.05");

    await contract.connect(creator).createMatch("ROOM_3", bet, { value: bet });
    await contract.connect(opponent).joinMatch("ROOM_3", { value: bet });

    await time.increase(181);

    await expectCustomError(
      contract.connect(backendSigner).submitResult("ROOM_3", creator.address),
      "InvalidMatchState",
    );

    await expectSuccess(contract.connect(creator).forceDrawOnTimeout("ROOM_3"));
  });

  it("lets winner claim once", async () => {
    const { contract, backendSigner, creator, opponent } = await loadFixture(deployMatchFixture);
    const bet = ethers.parseEther("0.05");

    await contract.connect(creator).createMatch("ROOM_4", bet, { value: bet });
    await contract.connect(opponent).joinMatch("ROOM_4", { value: bet });
    await contract.connect(backendSigner).submitResult("ROOM_4", creator.address);

    await expectSuccess(contract.connect(creator).claimReward("ROOM_4"));
    await expectCustomError(
      contract.connect(creator).claimReward("ROOM_4"),
      "InvalidMatchState",
    );
  });
});
