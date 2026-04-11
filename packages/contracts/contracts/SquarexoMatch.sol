// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SquarexoMatch is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant BACKEND_SIGNER_ROLE = keccak256("BACKEND_SIGNER_ROLE");

    uint256 public immutable joinTimeoutSeconds;
    uint256 public immutable resultTimeoutSeconds;

    enum MatchStatus {
        None,
        WaitingForOpponent,
        Active,
        Resolved,
        Cancelled
    }

    struct Match {
        address creator;
        address opponent;
        uint256 betAmount;
        uint256 totalPot;
        uint64 createdAt;
        uint64 joinedAt;
        uint64 resolvedAt;
        uint64 joinDeadline;
        uint64 resultDeadline;
        address winner;
        MatchStatus status;
    }

    mapping(string => Match) public matchesByRoom;
    mapping(string => mapping(address => bool)) public rewardClaimed;

    event MatchCreated(string indexed roomId, address indexed creator, uint256 betAmount, uint256 joinDeadline);
    event MatchJoined(string indexed roomId, address indexed opponent, uint256 totalPot, uint256 resultDeadline);
    event ResultSubmitted(string indexed roomId, address indexed winner, uint256 totalPot);
    event RewardClaimed(string indexed roomId, address indexed claimer, uint256 amount);
    event MatchCancelled(string indexed roomId, address indexed creator, string reason);
    event DrawForcedByTimeout(string indexed roomId, uint256 timestamp);

    error InvalidMatchState();
    error InvalidBetAmount();
    error InvalidRoomId();
    error InvalidAddress();
    error Unauthorized();
    error TransferFailed();

    constructor(address admin, address backendSigner, uint256 joinTimeout, uint256 resultTimeout) {
        if (admin == address(0) || backendSigner == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(BACKEND_SIGNER_ROLE, backendSigner);
        joinTimeoutSeconds = joinTimeout;
        resultTimeoutSeconds = resultTimeout;
    }

    function createMatch(string calldata roomId, uint256 betAmount) external payable whenNotPaused {
        _validateRoomId(roomId);
        Match storage m = matchesByRoom[roomId];
        if (m.status != MatchStatus.None) revert InvalidMatchState();
        if (betAmount == 0 || msg.value != betAmount) revert InvalidBetAmount();

        uint64 nowTs = uint64(block.timestamp);

        m.creator = msg.sender;
        m.betAmount = betAmount;
        m.totalPot = msg.value;
        m.createdAt = nowTs;
        m.joinDeadline = uint64(block.timestamp + joinTimeoutSeconds);
        m.status = MatchStatus.WaitingForOpponent;

        emit MatchCreated(roomId, msg.sender, betAmount, m.joinDeadline);
    }

    function joinMatch(string calldata roomId) external payable whenNotPaused {
        _validateRoomId(roomId);
        Match storage m = matchesByRoom[roomId];
        if (m.status != MatchStatus.WaitingForOpponent) revert InvalidMatchState();
        if (m.creator == msg.sender) revert Unauthorized();
        if (block.timestamp > m.joinDeadline) revert InvalidMatchState();
        if (msg.value != m.betAmount) revert InvalidBetAmount();

        m.opponent = msg.sender;
        m.joinedAt = uint64(block.timestamp);
        m.resultDeadline = uint64(block.timestamp + resultTimeoutSeconds);
        m.totalPot += msg.value;
        m.status = MatchStatus.Active;

        emit MatchJoined(roomId, msg.sender, m.totalPot, m.resultDeadline);
    }

    function submitResult(string calldata roomId, address winner) external whenNotPaused onlyRole(BACKEND_SIGNER_ROLE) {
        _validateRoomId(roomId);
        Match storage m = matchesByRoom[roomId];
        if (m.status != MatchStatus.Active) revert InvalidMatchState();

        bool isDraw = winner == address(0);
        bool isValidWinner = winner == m.creator || winner == m.opponent;
        if (!isDraw && !isValidWinner) revert Unauthorized();

        m.winner = winner;
        m.resolvedAt = uint64(block.timestamp);
        m.status = MatchStatus.Resolved;

        emit ResultSubmitted(roomId, winner, m.totalPot);
    }

    function claimReward(string calldata roomId) external nonReentrant {
        _validateRoomId(roomId);
        Match storage m = matchesByRoom[roomId];
        if (m.status != MatchStatus.Resolved) revert InvalidMatchState();

        uint256 amount;
        if (m.winner == address(0)) {
            if (msg.sender != m.creator && msg.sender != m.opponent) revert Unauthorized();
            if (rewardClaimed[roomId][msg.sender]) revert InvalidMatchState();
            rewardClaimed[roomId][msg.sender] = true;
            amount = m.betAmount;
            m.totalPot -= amount;
        } else {
            if (msg.sender != m.winner) revert Unauthorized();
            if (rewardClaimed[roomId][m.winner]) revert InvalidMatchState();
            rewardClaimed[roomId][m.winner] = true;
            amount = m.totalPot;
            m.totalPot = 0;
        }

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit RewardClaimed(roomId, msg.sender, amount);
    }

    function cancelUnjoinedMatch(string calldata roomId) external nonReentrant {
        _validateRoomId(roomId);
        Match storage m = matchesByRoom[roomId];
        if (m.status != MatchStatus.WaitingForOpponent) revert InvalidMatchState();
        if (msg.sender != m.creator) revert Unauthorized();
        if (block.timestamp <= m.joinDeadline) revert InvalidMatchState();

        m.status = MatchStatus.Cancelled;
        uint256 refund = m.totalPot;
        m.totalPot = 0;

        (bool ok, ) = payable(m.creator).call{value: refund}("");
        if (!ok) revert TransferFailed();

        emit MatchCancelled(roomId, m.creator, "JOIN_TIMEOUT");
    }

    function forceDrawOnTimeout(string calldata roomId) external {
        _validateRoomId(roomId);
        Match storage m = matchesByRoom[roomId];
        if (m.status != MatchStatus.Active) revert InvalidMatchState();
        if (msg.sender != m.creator && msg.sender != m.opponent) revert Unauthorized();
        if (block.timestamp <= m.resultDeadline) revert InvalidMatchState();

        m.winner = address(0);
        m.resolvedAt = uint64(block.timestamp);
        m.status = MatchStatus.Resolved;

        emit DrawForcedByTimeout(roomId, block.timestamp);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _validateRoomId(string calldata roomId) private pure {
        uint256 len = bytes(roomId).length;
        if (len == 0 || len > 64) revert InvalidRoomId();
    }
}
