const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SquarexoMatch", function () {
  async function deployFixture() {
    const [admin, backendSigner, creator, opponent] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("SquarexoMatch");
    const contract = await factory.deploy(admin.address, backendSigner.address, 60, 300);
    await contract.waitForDeployment();

    return { contract, backendSigner, creator, opponent };
  }

  it("rejects zero admin in constructor", async function () {
    const [, backendSigner] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("SquarexoMatch");

    await expect(factory.deploy(ethers.ZeroAddress, backendSigner.address, 60, 300)).to.be.reverted;
  });

  it("rejects empty room id", async function () {
    const { contract, creator } = await deployFixture();

    await expect(
      contract.connect(creator).createMatch("", ethers.parseEther("0.01"), {
        value: ethers.parseEther("0.01"),
      }),
    ).to.be.reverted;
  });

  it("allows winner to claim full pot and prevents double claim", async function () {
    const { contract, backendSigner, creator, opponent } = await deployFixture();
    const bet = ethers.parseEther("0.02");

    await contract.connect(creator).createMatch("ROOM_WIN", bet, { value: bet });
    await contract.connect(opponent).joinMatch("ROOM_WIN", { value: bet });
    await contract.connect(backendSigner).submitResult("ROOM_WIN", creator.address);

    await expect(contract.connect(creator).claimReward("ROOM_WIN")).to.changeEtherBalance(creator, bet * 2n);
    await expect(contract.connect(creator).claimReward("ROOM_WIN")).to.be.reverted;
  });

  it("supports draw split claims and zeroes pot after both claims", async function () {
    const { contract, backendSigner, creator, opponent } = await deployFixture();
    const bet = ethers.parseEther("0.01");

    await contract.connect(creator).createMatch("ROOM_DRAW", bet, { value: bet });
    await contract.connect(opponent).joinMatch("ROOM_DRAW", { value: bet });
    await contract.connect(backendSigner).submitResult("ROOM_DRAW", ethers.ZeroAddress);

    await expect(contract.connect(creator).claimReward("ROOM_DRAW")).to.changeEtherBalance(creator, bet);
    await expect(contract.connect(opponent).claimReward("ROOM_DRAW")).to.changeEtherBalance(opponent, bet);

    const matchAfter = await contract.matchesByRoom("ROOM_DRAW");
    expect(matchAfter.totalPot).to.equal(0n);
  });
});
