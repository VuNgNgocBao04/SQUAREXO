// Script to create all AI Mode + Milestone + NFT issues for SQUAREXO
// Run by the create-ai-issues workflow via actions/github-script

module.exports = async ({ github, context }) => {
  const owner = context.repo.owner;
  const repo = context.repo.repo;

  const issues = [
    {
      title: '[Epic] AI Mode + Milestone + NFT Sưu tầm (Phi Tài Chính)',
      labels: ['epic'],
      body: `## 🎯 Tổng quan

Triển khai hệ thống AI Mode kết hợp Milestone và NFT sưu tầm phi tài chính cho SQUAREXO.

**Mục tiêu:**
- Tạo động lực chơi dài hạn qua AI có độ khó tăng dần.
- Ghi nhận kỹ năng và sự kiên trì qua hệ thống milestone.
- Thưởng NFT thẩm mỹ (tranh, khung avatar, badge) – không có giá trị tài chính hoặc đầu cơ.

## 📌 Nguyên tắc bắt buộc
- ❌ Không thưởng ETH, token, coin hoặc bất kỳ đơn vị quy đổi tiền.
- ❌ Không có cơ chế cược, xổ số, quay thưởng mất phí, pay-to-win.
- ✅ NFT chỉ là phần thưởng thành tích + thẩm mỹ (cosmetic/collectible).
- ✅ Ưu tiên NFT soulbound hoặc chuyển nhượng bị giới hạn.
- ✅ Minh bạch điều kiện nhận thưởng.

## 📦 Các issue con

### Phase 1 – Gameplay + Milestones (không blockchain)
- [ ] [Feature] Training AI Mode
- [ ] [Feature] Challenge Ladder AI
- [ ] [Feature] Daily/Weekly AI Trials
- [ ] [Feature] Milestone System
- [ ] [Feature] Backend – AI Result Validation & Milestone Tracking
- [ ] [Feature] Frontend – AI Mode & Milestone UI

### Phase 2 – NFT Sưu tầm Season 1
- [ ] [Feature] NFT Reward System
- [ ] [Feature] Anti-Gambling & Anti-Speculation Mechanisms
- [ ] [Feature] Frontend – Collection UI & Profile Achievement

### Phase 3 – Boss Events + Narrative NFTs
- [ ] [Feature] Boss AI Events
- [ ] [Feature] Anti-Abuse & Result Verification System

## 📊 KPI theo dõi
- Tỷ lệ hoàn thành milestone theo từng tầng độ khó.
- Tỷ lệ quay lại ngày 1/7/30 của người chơi AI mode.
- Tỷ lệ người chơi claim NFT sau khi đủ điều kiện.
- Mức độ tham gia event Boss theo mùa.
- Phản hồi người dùng về "động lực chơi" thay vì "động lực kiếm tiền".

## 🗺️ Lộ trình
| Phase | Nội dung | Ưu tiên |
|-------|----------|---------|
| 1 | AI gameplay + Milestone UI (off-chain badge) | Cao |
| 2 | NFT Season 1 + Collection UI | Trung bình |
| 3 | Boss Events + Narrative NFTs + Anti-abuse | Sau |
`,
    },
    {
      title: '[Feature] Training AI Mode (Chế độ AI Luyện tập)',
      labels: ['feature'],
      body: `## 🎯 Mục tiêu
Xây dựng chế độ AI cơ bản dành cho người mới, giúp họ học cách chơi SQUAREXO với sự hỗ trợ của gợi ý nước đi và đối thủ AI cơ bản. Không tính xếp hạng. Thưởng milestone onboarding.

---

## ✅ Checklist quy trình (5 Pha)

### Pha 1: Phân tích (Analysis)
- [ ] Xác định các mẫu nước đi cơ bản AI cần thực hiện (ưu tiên ăn ô, tránh tạo ô cho đối thủ).
- [ ] Phân tích cách tích hợp hệ thống gợi ý (hint) không ảnh hưởng đến luồng game.
- [ ] Xác định milestone onboarding: hoàn thành tutorial, thắng 1 trận AI Training.

### Pha 2: Thiết kế (Design)
- [ ] Thiết kế thuật toán AI Training: random + greedy cơ bản (độ khó thấp).
- [ ] Thiết kế UI chọn chế độ: thêm option "Training AI" vào màn hình tạo phòng.
- [ ] Thiết kế hệ thống hint: highlight các cạnh có thể mang lại điểm ngay.
- [ ] Thiết kế milestone onboarding NFT reward.

### Pha 3: Hiện thực hóa (Coding)
- [ ] Implement TrainingAI trong \`packages/game-core/src/ai/training.ts\`:
  - Nếu có cạnh tạo ô ngay: ưu tiên đánh. Ngược lại: random.
  - Delay nhỏ (500-800ms) để giả lập "suy nghĩ".
- [ ] Implement HintSystem trong \`packages/game-core/src/ai/hint.ts\`:
  - Phân tích trạng thái bàn cờ, trả về danh sách cạnh gợi ý theo ưu tiên.
- [ ] Thêm socket event \`ai:getHint\` vào backend.
- [ ] Tích hợp UI hint vào frontend: nút "Gợi ý" highlight cạnh trên canvas.
- [ ] Không tính xếp hạng cho chế độ Training.
- [ ] Trigger milestone onboarding khi người chơi hoàn thành lần đầu.

### Pha 4: Kiểm thử (Testing)
- [ ] Test AI không đánh cạnh đã có, không đánh cạnh ngoài bảng.
- [ ] Test hint hiển thị đúng cạnh ưu tiên trên các bàn cờ kích thước khác nhau.
- [ ] Test milestone trigger đúng sau trận thắng đầu tiên.
- [ ] Test delay AI không gây block UI.

### Pha 5: Triển khai (Deployment)
- [ ] Tạo Pull Request từ nhánh \`feat/ai-training-mode\` vào \`develop\`.

---

**Thư mục liên quan:**
- \`packages/game-core/src/ai/training.ts\` ← Tạo mới
- \`packages/game-core/src/ai/hint.ts\` ← Tạo mới
- \`packages/backend/src/socket/handler.ts\` ← Thêm ai:getHint event
- \`packages/frontend/src/components/\` ← Thêm HintButton, AI mode selector
`,
    },
    {
      title: '[Feature] Challenge Ladder AI (Leo thang độ khó – Bronze → Master)',
      labels: ['feature'],
      body: `## 🎯 Mục tiêu
Xây dựng hệ thống thang độ khó AI gồm 5 bậc (Bronze, Silver, Gold, Platinum, Master) với điều kiện chiến thắng riêng và NFT mở khóa theo bậc.

---

## 🏆 Thiết kế 5 bậc

| Bậc | Điều kiện thắng | NFT phần thưởng |
|-----|----------------|-----------------|
| Bronze | Thắng 2/3 trận AI cơ bản | NFT Badge: Bronze Challenger |
| Silver | Thắng 3/5 trận, không dùng hint | NFT Badge: Silver Tactician |
| Gold | Thắng 3/5, không hint, < 90s/trận | NFT Art Card: Gold Strategy |
| Platinum | Thắng 4/5, không hint, < 60s/trận | NFT Frame: Platinum Commander |
| Master | Thắng 5/5 liên tiếp, không hint, < 45s/trận | NFT Legendary: Master of Squares |

---

## ✅ Checklist quy trình (5 Pha)

### Pha 1: Phân tích (Analysis)
- [ ] Xác định thuật toán AI cho từng bậc (greedy → minimax → alpha-beta pruning).
- [ ] Phân tích điều kiện win/loss cho từng bậc (hint usage, thời gian, tỷ lệ thắng).
- [ ] Xác định cơ chế lưu tiến độ bậc của người chơi (DB hoặc off-chain).

### Pha 2: Thiết kế (Design)
- [ ] Thiết kế ChallengeAI interface với các level: BRONZE, SILVER, GOLD, PLATINUM, MASTER.
- [ ] Thiết kế schema DB: \`LadderProgress { userId, tier, wins, losses, hintUsed, bestTime }\`.
- [ ] Thiết kế UI Ladder: thanh tiến độ 5 bậc, điều kiện rõ ràng, phần thưởng tương ứng.
- [ ] Thiết kế màn hình kết quả sau trận: tiến độ bậc, mốc sắp đạt.

### Pha 3: Hiện thực hóa (Coding)
- [ ] Implement các AI class:
  - BronzeAI: greedy (ăn ô ngay nếu có, ngẫu nhiên nếu không).
  - SilverAI: greedy + tránh tạo ô cho đối thủ.
  - GoldAI: minimax depth-2.
  - PlatinumAI: minimax depth-4 + alpha-beta.
  - MasterAI: minimax depth-6 + alpha-beta + opening book.
- [ ] Implement LadderService trong backend: theo dõi điều kiện win, hint usage, thời gian.
- [ ] Implement API GET /ladder/:userId và POST /ladder/result.
- [ ] Tích hợp hint tracking: mỗi lần dùng hint trong trận ghi lại.
- [ ] Tích hợp bộ đếm thời gian trận trên frontend.
- [ ] Trigger NFT reward khi đủ điều kiện vượt bậc.

### Pha 4: Kiểm thử (Testing)
- [ ] Test từng AI level không phạm luật.
- [ ] Test điều kiện bậc: dùng hint bị đánh dấu, thời gian tính chính xác.
- [ ] Test unlock NFT chỉ xảy ra 1 lần mỗi bậc (không duplicate).
- [ ] Test UI tiến độ cập nhật sau mỗi trận.

### Pha 5: Triển khai (Deployment)
- [ ] Tạo PR từ nhánh \`feat/challenge-ladder\` vào \`develop\`.
`,
    },
    {
      title: '[Feature] Daily/Weekly AI Trials (Thử thách AI định kỳ)',
      labels: ['feature'],
      body: `## 🎯 Mục tiêu
Xây dựng hệ thống thử thách AI hàng ngày/hàng tuần với bài toán chiến thuật riêng, thưởng NFT theo chuỗi hoàn thành (streak). Không có vé mua tham gia.

---

## 📅 Thiết kế

### Daily Trial
- Mỗi ngày 1 bài toán chiến thuật (bàn cờ có sẵn, người chơi phải tìm nước đi tối ưu).
- Hoàn thành trong ngày tính streak +1.
- Streak 7 ngày → NFT Common "Weekly Devotee".
- Streak 30 ngày → NFT Rare "Monthly Champion".

### Weekly Trial
- Mỗi tuần 1 thử thách đặc biệt (AI tăng cường, điều kiện phụ).
- Hoàn thành 4 tuần liên tiếp → NFT Epic "Season Consistent".

---

## ✅ Checklist quy trình (5 Pha)

### Pha 1: Phân tích (Analysis)
- [ ] Xác định format bài toán chiến thuật (puzzle): bàn cờ ban đầu + số lượt tối đa.
- [ ] Phân tích cách tạo puzzle tự động hoặc thủ công từ admin.
- [ ] Xác định cách lưu streak người chơi (reset lúc 00:00 UTC+7).

### Pha 2: Thiết kế (Design)
- [ ] Thiết kế schema DB:
  - \`DailyPuzzle { id, date, boardState, maxMoves, solution }\`
  - \`PlayerStreak { userId, dailyStreak, weeklyStreak, lastCompletedDate }\`
- [ ] Thiết kế UI: tab "Daily/Weekly" với puzzle board + bộ đếm thời gian + tiến độ streak.
- [ ] Thiết kế flow: giải puzzle → backend verify → cập nhật streak → kiểm tra NFT reward.

### Pha 3: Hiện thực hóa (Coding)
- [ ] Tạo \`packages/backend/src/services/puzzleService.ts\`: lấy puzzle hôm nay, verify kết quả.
- [ ] Tạo \`packages/backend/src/services/streakService.ts\`: cập nhật streak, kiểm tra reset.
- [ ] Tạo API endpoints:
  - GET /puzzles/daily – Lấy puzzle hôm nay.
  - GET /puzzles/weekly – Lấy thử thách tuần.
  - POST /puzzles/daily/submit – Nộp kết quả daily.
  - POST /puzzles/weekly/submit – Nộp kết quả weekly.
  - GET /streak/:userId – Lấy thông tin streak.
- [ ] Implement puzzle verification: so sánh chuỗi nước đi với điều kiện thắng.
- [ ] Tạo admin tool để seed puzzle mới mỗi ngày/tuần.
- [ ] Implement streak reset job: chạy mỗi ngày lúc 00:00 UTC+7.
- [ ] Trigger NFT reward sau khi đạt streak milestone.

### Pha 4: Kiểm thử (Testing)
- [ ] Test puzzle verification chính xác.
- [ ] Test streak tăng đúng, reset khi bỏ ngày.
- [ ] Test NFT trigger chỉ xảy ra 1 lần.
- [ ] Test puzzle không trùng lặp trong tuần.

### Pha 5: Triển khai (Deployment)
- [ ] Setup cron job hoặc scheduled task seed puzzle.
- [ ] Tạo PR từ nhánh \`feat/daily-weekly-trials\` vào \`develop\`.
`,
    },
    {
      title: '[Feature] Boss AI Events (Sự kiện Boss AI theo mùa)',
      labels: ['feature'],
      body: `## 🎯 Mục tiêu
Xây dựng sự kiện Boss AI theo mùa (mỗi tháng 1 boss) với chiến thuật riêng, độ khó cao, điều kiện phụ để nhận NFT hiếm theo sự kiện.

---

## 🐉 Thiết kế Boss AI

Mỗi Boss có:
- **Chiến thuật riêng biệt** (Boss tháng 1 ưu tiên kiểm soát góc, Boss tháng 2 tấn công trung tâm...).
- **Điều kiện thắng cơ bản**: đánh bại Boss.
- **Điều kiện phụ** (để nhận NFT Legendary): ít lỗi, thắng trong số lượt giới hạn, không dùng hint.
- **Bộ art riêng theo mùa**: mỗi Boss có NFT art card độc quyền.

### Ví dụ Boss Season 1
| Điều kiện | Phần thưởng |
|-----------|-------------|
| Thắng Boss | NFT Badge: Boss Slayer S1 |
| Thắng + không dùng hint | NFT Art Card: Flawless Victor S1 |
| Thắng + < 50 lượt | NFT Legendary: Speed Conqueror S1 |

---

## ✅ Checklist quy trình (5 Pha)

### Pha 1: Phân tích (Analysis)
- [ ] Xác định cấu trúc Boss AI: mỗi boss là 1 config (tên, mô tả, chiến thuật, điều kiện).
- [ ] Phân tích cách lưu lịch sử người chơi đã hạ boss nào.
- [ ] Xác định chu kỳ event (bắt đầu/kết thúc, thời gian có thể tham gia).

### Pha 2: Thiết kế (Design)
- [ ] Thiết kế BossAI abstract class với hook selectMove(state) override cho từng boss.
- [ ] Thiết kế schema DB:
  - \`BossEvent { id, season, name, startDate, endDate, artworkCID }\`
  - \`BossAttempt { userId, bossEventId, won, hintsUsed, movesCount, completedAt }\`
- [ ] Thiết kế UI event page: countdown, mô tả boss, điều kiện phụ, rewards.
- [ ] Thiết kế NFT metadata cho boss event (season, bossId, rarity, conditions met).

### Pha 3: Hiện thực hóa (Coding)
- [ ] Implement BossAI base class và các boss cụ thể:
  - CornerBoss (S1): tối ưu chiếm góc.
  - CenterBoss (S2): kiểm soát trung tâm.
- [ ] Implement BossEventService: lifecycle, điều kiện phụ, reward trigger.
- [ ] Implement API:
  - GET /boss-events/current – Boss event đang diễn ra.
  - POST /boss-events/:id/result – Submit kết quả trận Boss.
  - GET /boss-events/history/:userId – Lịch sử boss đã hạ.
- [ ] Tạo admin script seed boss event mới theo mùa.
- [ ] Tích hợp UI: màn hình event, boss intro, kết quả sau trận.

### Pha 4: Kiểm thử (Testing)
- [ ] Test boss AI không phạm luật, chiến thuật đặc trưng đúng.
- [ ] Test điều kiện phụ được kiểm tra chính xác.
- [ ] Test NFT chỉ mint 1 lần mỗi điều kiện mỗi người.
- [ ] Test event hết hạn không cho tham gia.

### Pha 5: Triển khai (Deployment)
- [ ] Chuẩn bị artwork cho Boss Season 1.
- [ ] Tạo PR từ nhánh \`feat/boss-ai-events\` vào \`develop\`.
`,
    },
    {
      title: '[Feature] Milestone System (Hệ thống Milestone – Tiến trình & Kỹ năng)',
      labels: ['feature'],
      body: `## 🎯 Mục tiêu
Xây dựng hệ thống milestone theo dõi và ghi nhận tiến trình, kỹ năng, và mastery của người chơi – nền tảng để trigger NFT phần thưởng.

---

## 📊 Danh sách Milestone

### Milestone tiến trình
| Milestone | Mô tả | Rarity |
|-----------|-------|--------|
| First Match | Chơi trận đầu tiên với AI | Common |
| Veteran 10/50/100 | Chơi 10/50/100 trận AI | Common/Rare/Epic |
| First Win | Thắng trận AI đầu tiên | Common |
| Winner 5/20/50 | Thắng 5/20/50 trận AI | Common/Rare/Epic |
| Login Streak 7/30 | Đăng nhập liên tục 7/30 ngày | Common/Rare |

### Milestone kỹ năng
| Milestone | Mô tả | Rarity |
|-----------|-------|--------|
| No-Hint Master 10 | Thắng AI không dùng hint 10 trận | Rare |
| Speed Runner 20 | Thắng trong < 60s/trận 20 lần | Rare |
| Win Streak 3/5/10 | Chuỗi thắng liên tiếp | Common/Rare/Epic |

### Milestone mastery
| Milestone | Mô tả | Rarity |
|-----------|-------|--------|
| Ladder Complete | Vượt đủ 5 bậc Challenge Ladder | Epic |
| Weekly Champion | Hoàn tất 4 Weekly Trials liên tiếp | Epic |
| Boss Slayer x3 | Hạ Boss AI 3 mùa khác nhau | Legendary |

---

## ✅ Checklist quy trình (5 Pha)

### Pha 1: Phân tích (Analysis)
- [ ] Thiết lập danh sách milestone đầy đủ (ID, tên, điều kiện, phần thưởng).
- [ ] Phân tích event-driven architecture: milestone được trigger bởi game events.
- [ ] Xác định cách lưu tiến độ từng milestone (counter, flag) cho từng user.

### Pha 2: Thiết kế (Design)
- [ ] Thiết kế schema DB:
  - \`Milestone { id, name, description, condition, rewardType, rewardId, rarity }\`
  - \`PlayerMilestone { userId, milestoneId, progress, completed, completedAt }\`
- [ ] Thiết kế MilestoneEngine: nhận events, cập nhật counter, kiểm tra điều kiện.
- [ ] Thiết kế UI Milestones tab: danh sách milestone, thanh tiến độ, phần thưởng.

### Pha 3: Hiện thực hóa (Coding)
- [ ] Seed tất cả milestone vào DB (migration).
- [ ] Implement \`packages/backend/src/services/milestoneService.ts\`:
  - onMatchEnd(userId, result): cập nhật các milestone liên quan trận đấu.
  - onLogin(userId): cập nhật streak milestones.
  - onLadderProgress(userId, tier): cập nhật ladder milestones.
  - checkAndReward(userId, milestoneId): trigger reward nếu đủ điều kiện.
- [ ] Implement API:
  - GET /milestones – Danh sách tất cả milestone.
  - GET /milestones/:userId – Tiến độ milestone của người chơi.
- [ ] Tích hợp MilestoneService vào socket handler sau khi game kết thúc.
- [ ] Implement notification khi milestone mới hoàn thành (in-game toast + inbox).

### Pha 4: Kiểm thử (Testing)
- [ ] Test từng milestone condition trigger đúng.
- [ ] Test không duplicate reward cho cùng 1 milestone.
- [ ] Test tiến độ milestone hiển thị đúng trên UI.
- [ ] Test edge cases: hint usage tracking, time tracking chính xác.

### Pha 5: Triển khai (Deployment)
- [ ] Tạo PR từ nhánh \`feat/milestone-system\` vào \`develop\`.
`,
    },
    {
      title: '[Feature] NFT Reward System (Hệ thống phần thưởng NFT sưu tầm)',
      labels: ['feature'],
      body: `## 🎯 Mục tiêu
Xây dựng hệ thống mint và quản lý NFT phần thưởng phi tài chính – chỉ mang tính sưu tầm và thẩm mỹ.

---

## 🎨 Các loại NFT

| Loại | Mô tả | Soulbound |
|------|-------|-----------|
| Achievement Badge | Huy hiệu thành tích rõ ràng | ✅ Có |
| Profile Frame | Khung avatar hiển thị trong hồ sơ/trận đấu | ✅ Có |
| Art Card | Tranh minh họa theo season/chủ đề | Phần lớn ✅ |
| Story Chapter | Mảnh cốt truyện mở khóa khi đạt milestone lớn | ✅ Có |

## 💎 Độ hiếm theo độ khó

| Rarity | Nguồn gốc |
|--------|-----------|
| Common | Milestone cơ bản (tutorial, thắng trận đầu) |
| Rare | Milestone trung cấp (streak, bậc Gold) |
| Epic | Milestone khó (bậc Master, weekly streak dài) |
| Legendary | Event Boss theo mùa với điều kiện phụ |

## 📋 Metadata chuẩn

\`\`\`json
{
  "name": "Boss Slayer Season 1",
  "description": "Awarded to players who defeated the Season 1 Boss.",
  "season": "S1",
  "milestoneId": "boss_slayer_s1",
  "rarity": "legendary",
  "earnedAt": "2026-04-12T00:00:00Z",
  "artworkCID": "ipfs://Qm...",
  "isSoulbound": true,
  "gameVersion": "1.0.0"
}
\`\`\`

---

## ✅ Checklist quy trình (5 Pha)

### Pha 1: Phân tích (Analysis)
- [ ] Xác định blockchain target: Oasis Sapphire (đã có trong dự án).
- [ ] Xác định chuẩn NFT: ERC-721 (soulbound qua override transfer) hoặc ERC-5192.
- [ ] Phân tích luồng mint: backend xác thực → gọi mint function → cập nhật DB.

### Pha 2: Thiết kế (Design)
- [ ] Thiết kế Smart Contract SquarexoNFT.sol:
  - ERC-721 base.
  - Mapping milestoneId → tokenId để tránh duplicate.
  - isSoulbound per token (override transferFrom nếu soulbound).
  - Role MINTER_ROLE cho backend signer.
  - mint(address to, string milestoneId, string metadataCID).
- [ ] Thiết kế NFTService trong backend: mint, query, sync status.
- [ ] Thiết kế schema DB: \`NFTReward { id, userId, milestoneId, tokenId, txHash, mintedAt, isSoulbound }\`.
- [ ] Thiết kế IPFS upload pipeline cho artwork metadata.

### Pha 3: Hiện thực hóa (Coding)
- [ ] Viết \`packages/contracts/SquarexoNFT.sol\` và deploy lên Oasis Testnet.
- [ ] Implement \`packages/backend/src/services/nftService.ts\`:
  - mintNFT(userId, milestoneId): check duplicate → mint → lưu DB.
  - getNFTs(userId): lấy danh sách NFT của user.
- [ ] Tích hợp nftService.mintNFT vào milestoneService.checkAndReward.
- [ ] Upload artwork lên IPFS và lưu CID vào milestone config.
- [ ] Implement API:
  - GET /nfts/:userId – Danh sách NFT của người chơi.
  - GET /nfts/:userId/:tokenId – Chi tiết 1 NFT.
- [ ] Frontend: hiển thị NFT trong Collection tab với metadata đầy đủ.

### Pha 4: Kiểm thử (Testing)
- [ ] Test mint trên testnet: kiểm tra tokenId, metadata, soulbound behavior.
- [ ] Test duplicate prevention: cùng milestoneId không mint 2 lần cho cùng user.
- [ ] Test soulbound: transfer thất bại cho soulbound NFT.
- [ ] Test Collection UI hiển thị đúng NFT.

### Pha 5: Triển khai (Deployment)
- [ ] Deploy SquarexoNFT lên mainnet.
- [ ] Cập nhật .env.example với NFT_CONTRACT_ADDRESS.
- [ ] Tạo PR từ nhánh \`feat/nft-reward-system\` vào \`develop\`.
`,
    },
    {
      title: '[Feature] Anti-Gambling & Anti-Speculation Mechanisms (Chống cờ bạc & đầu cơ)',
      labels: ['feature'],
      body: `## 🎯 Mục tiêu
Thiết kế và triển khai các cơ chế bảo vệ để đảm bảo NFT và hệ thống milestone không trở thành công cụ cờ bạc hay đầu cơ.

---

## 🛡️ Các cơ chế bảo vệ

### Thiết kế NFT an toàn
- Mặc định soulbound cho NFT thành tích.
- Nếu cho chuyển nhượng: chỉ nhóm cosmetic mở rộng, cooldown dài, không niêm yết nội bộ.
- Không có cơ chế thưởng theo giá trị giao dịch.

### UI/UX an toàn
- Không hiển thị quy đổi giá tiền trong UI.
- Không dùng ngôn ngữ "đầu tư", "lợi nhuận", "farm".
- Không có marketplace tích hợp trong giai đoạn đầu.

### Xác minh kết quả backend
- Tất cả điều kiện milestone verified ở server, không tin client.
- Phát hiện bất thường: win-rate bất thường, IP/device trùng, chuỗi đối thủ lặp.
- Cơ chế thu hồi/đóng băng NFT nếu phát hiện gian lận.

---

## ✅ Checklist quy trình (5 Pha)

### Pha 1: Phân tích (Analysis)
- [ ] Liệt kê tất cả vector gian lận tiềm năng (bot farming, smurf, IP rotation, dàn xếp).
- [ ] Phân tích ngưỡng bất thường cho từng loại milestone.
- [ ] Tham khảo best practices chống abuse trong blockchain gaming.

### Pha 2: Thiết kế (Design)
- [ ] Thiết kế AbuseDetectionService: rule-based + anomaly flagging.
- [ ] Thiết kế schema DB:
  - \`AbuseFlag { userId, type, detectedAt, severity, resolved }\`
  - \`NFTFreeze { nftId, reason, frozenAt, resolvedAt }\`
- [ ] Thiết kế admin dashboard: xem flags, review, resolve.
- [ ] Thiết kế smart contract freeze function: freezeToken(tokenId) chỉ dành cho ADMIN_ROLE.

### Pha 3: Hiện thực hóa (Coding)
- [ ] Implement AbuseDetectionService:
  - Rule: win-rate > 95% trong 50 trận → flag.
  - Rule: nhiều account trùng device/IP → flag.
  - Rule: thời gian trận bất thường (< 5 giây) → flag.
  - Rule: chuỗi đối thủ lặp lại trong PvP → flag.
- [ ] Implement middleware kiểm tra abuse flag trước khi mint NFT.
- [ ] Implement API admin:
  - GET /admin/flags – Xem danh sách flags.
  - POST /admin/flags/:id/resolve – Giải quyết flag.
  - POST /admin/nfts/:tokenId/freeze – Đóng băng NFT.
- [ ] Thêm freeze function vào smart contract SquarexoNFT.sol.
- [ ] UI: không hiển thị bất kỳ quy đổi giá tiền; audit tất cả text labels.
- [ ] Thêm rate limiting cho API kết quả trận (chống spam submit).

### Pha 4: Kiểm thử (Testing)
- [ ] Test abuse detection trigger đúng với mock data bất thường.
- [ ] Test NFT không mint khi user bị flag pending review.
- [ ] Test freeze function hoạt động trên contract.
- [ ] Test UI không có bất kỳ mention giá tiền hoặc ngôn ngữ gambling.

### Pha 5: Triển khai (Deployment)
- [ ] Viết tài liệu chính sách anti-abuse cho người chơi.
- [ ] Setup alert system cho admin khi có flag mới.
- [ ] Tạo PR từ nhánh \`feat/anti-gambling\` vào \`develop\`.
`,
    },
    {
      title: '[Feature] Backend – AI Result Validation & Milestone Tracking Service',
      labels: ['feature'],
      body: `## 🎯 Mục tiêu
Xây dựng tầng backend xác thực kết quả trận AI và theo dõi milestone, đảm bảo toàn bộ logic thưởng được xử lý server-side (không tin client).

---

## 🔧 Kiến trúc đề xuất

\`\`\`
Socket: game_over event
  → AIGameResultValidator (validate moves, winner)
  → MilestoneService.onMatchEnd() (cập nhật counters)
  → MilestoneService.checkAndReward() (kiểm tra điều kiện)
  → NFTService.mintNFT() hoặc BadgeService.grantBadge()
  → Cập nhật PlayerProfile
  → Emit: milestone:progress, reward:granted
\`\`\`

---

## ✅ Checklist quy trình (5 Pha)

### Pha 1: Phân tích (Analysis)
- [ ] Xác định data cần capture sau mỗi trận AI: winner, moves_count, hint_used, duration_ms, ai_level.
- [ ] Xác định cách validate kết quả: replay moves từ initial state với game-core.
- [ ] Phân tích điều kiện race condition.

### Pha 2: Thiết kế (Design)
- [ ] Thiết kế AIMatchResult type: \`{ userId, aiLevel, winner, moves, hintCount, durationMs, boardSize }\`.
- [ ] Thiết kế validation pipeline:
  1. Replay all moves với game-core applyMove.
  2. Verify final state khớp với reported winner.
  3. Cross-check hint count với server-side hint log.
- [ ] Thiết kế DB schema: \`AIMatch { id, userId, aiLevel, winner, movesCount, hintCount, durationMs, boardSize, createdAt }\`.
- [ ] Thiết kế locking mechanism tránh duplicate milestone reward.

### Pha 3: Hiện thực hóa (Coding)
- [ ] Implement \`packages/backend/src/services/aiMatchService.ts\`:
  - recordAndValidate(result): validate + lưu DB.
  - getStats(userId): thống kê trận AI.
- [ ] Implement MilestoneService (xem issue Milestone System).
- [ ] Tích hợp vào socket handler: bắt event game:over → aiMatchService.recordAndValidate.
- [ ] Emit milestone:progress và milestone:completed về client.
- [ ] Implement distributed lock tránh race condition khi reward.
- [ ] Implement server-side hint log: mỗi lần client request hint → ghi DB.
- [ ] Implement API:
  - GET /ai-matches/:userId – Lịch sử trận AI.
  - GET /ai-matches/:userId/stats – Thống kê.

### Pha 4: Kiểm thử (Testing)
- [ ] Test validation phát hiện kết quả giả (moves không hợp lệ).
- [ ] Test race condition: 2 game_over events cùng lúc không duplicate reward.
- [ ] Test hint log tracking chính xác.
- [ ] Test milestone trigger sau nhiều trận liên tiếp.

### Pha 5: Triển khai (Deployment)
- [ ] Setup Redis (nếu dùng cho locking) trong docker-compose.
- [ ] Tạo PR từ nhánh \`feat/backend-ai-validation\` vào \`develop\`.
`,
    },
    {
      title: '[Feature] Frontend – AI Mode, Milestone Progress & Collection UI',
      labels: ['feature'],
      body: `## 🎯 Mục tiêu
Xây dựng giao diện người dùng cho toàn bộ hệ thống AI Mode, Milestone Progress, và NFT Collection.

---

## 🖥️ Các màn hình cần xây dựng

### Tab AI Mode
- Chọn chế độ: Training / Challenge Ladder / Daily Trial / Boss Event.
- Chọn độ khó (cho Challenge Ladder).
- Hiển thị điều kiện thắng của chế độ đang chọn.

### Màn hình chơi AI
- Panel bên cạnh: thông tin AI level, bộ đếm thời gian, số hint còn lại.
- Nút "Gợi ý" – bị vô hiệu hóa nếu chế độ không cho phép.
- Progress bar: tiến độ milestone đang theo dõi.

### Màn hình kết thúc trận (Game Over)
- Kết quả (thắng/thua).
- Tiến độ milestone tăng bao nhiêu % (animated).
- Milestone nào sắp mở khóa tiếp theo.
- Nếu đủ điều kiện: nút "Claim NFT" hoặc thông báo "Đang mint NFT...".

### Tab Milestones
- Danh sách milestone theo nhóm (Tiến trình / Kỹ năng / Mastery).
- Thanh tiến độ từng milestone với điều kiện rõ ràng.
- Trạng thái: Chưa bắt đầu / Đang tiến hành / Hoàn thành / Đã nhận thưởng.

### Tab Collection (NFT Gallery)
- Grid view các NFT đã nhận.
- Chi tiết NFT: tên, mô tả, season, điều kiện đạt được, ngày nhận.
- Hiển thị rarity với màu sắc phân biệt.
- Badge soulbound indicator.
- **Không có nút buy/sell/trade.**

---

## ✅ Checklist quy trình (5 Pha)

### Pha 1: Phân tích (Analysis)
- [ ] Review cấu trúc component hiện tại trong \`packages/frontend/src/\`.
- [ ] Xác định state management cần thiết.
- [ ] Xác định API calls cần thiết cho từng màn hình.

### Pha 2: Thiết kế (Design)
- [ ] Wireframe các màn hình mới.
- [ ] Xác định component structure: AIModeSelector, HintButton, MilestoneCard, NFTCard, GameResultModal.
- [ ] Thiết kế design system: màu sắc rarity (Common=xám, Rare=xanh, Epic=tím, Legendary=vàng).

### Pha 3: Hiện thực hóa (Coding)
- [ ] Tạo \`packages/frontend/src/components/ai/\`:
  - AIModeSelector.tsx, HintButton.tsx, AIPanel.tsx
- [ ] Tạo \`packages/frontend/src/components/milestone/\`:
  - MilestoneCard.tsx, MilestoneList.tsx, MilestoneProgress.tsx
- [ ] Tạo \`packages/frontend/src/components/collection/\`:
  - NFTCard.tsx, NFTGallery.tsx, NFTDetail.tsx
- [ ] Tạo pages: AIModePage.tsx, MilestonesPage.tsx, CollectionPage.tsx.
- [ ] Tạo GameResultModal.tsx: kết quả + milestone progress + claim NFT.
- [ ] Tích hợp Socket.IO events: milestone:progress, milestone:completed, reward:granted.
- [ ] Thêm routing cho các page mới.

### Pha 4: Kiểm thử (Testing)
- [ ] Test UI responsive trên mobile và desktop.
- [ ] Test milestone progress animated đúng sau trận.
- [ ] Test NFT Gallery hiển thị đúng metadata.
- [ ] Test hint button disabled đúng theo chế độ.
- [ ] Test không có bất kỳ text đề cập giá tiền.

### Pha 5: Triển khai (Deployment)
- [ ] Tạo PR từ nhánh \`feat/frontend-ai-milestone-ui\` vào \`develop\`.
`,
    },
    {
      title: '[Roadmap] Phase 1 – AI Gameplay + Milestone System (Off-chain)',
      labels: ['roadmap'],
      body: `## 🎯 Mục tiêu Phase 1
Hoàn chỉnh 2-3 chế độ AI cơ bản, bật hệ thống milestone + UI tiến độ, dùng phần thưởng giả lập (off-chain badge) để test retention.

---

## ✅ Checklist Phase 1

### Gameplay AI
- [ ] Training AI Mode (Luyện tập với gợi ý hint)
- [ ] Challenge Ladder AI – Bronze & Silver (2 bậc đầu)
- [ ] Daily AI Trial cơ bản

### Milestone System
- [ ] Milestone tiến trình: 10/50/100 trận, thắng 5/20/50 trận
- [ ] Milestone kỹ năng: no-hint streak, speed wins
- [ ] Milestone login streak: 7 ngày

### Backend
- [ ] AIMatchService (validate + record kết quả)
- [ ] MilestoneService (tracking + trigger reward)
- [ ] Hint log server-side
- [ ] API: /ai-matches, /milestones, /streak

### Frontend
- [ ] AI Mode selector UI
- [ ] In-game AI panel + hint button + timer
- [ ] Game Over modal với milestone progress
- [ ] Milestones tab với progress bars
- [ ] Off-chain badge hiển thị (không cần blockchain)

### Testing
- [ ] Integration test AI + milestone trigger
- [ ] UI test milestone progress
- [ ] Load test với concurrent AI games

---

**Definition of Done**: Người chơi có thể chơi Training AI và Challenge Ladder Bronze/Silver, thấy milestone tiến độ sau mỗi trận, và nhận off-chain badge khi hoàn thành milestone.
`,
    },
    {
      title: '[Roadmap] Phase 2 – NFT Season 1 + Collection UI',
      labels: ['roadmap'],
      body: `## 🎯 Mục tiêu Phase 2
Mint NFT thật cho các milestone quan trọng, bật Collection UI + hồ sơ thành tích, áp dụng soulbound mặc định.

---

## ✅ Checklist Phase 2

### Smart Contract
- [ ] SquarexoNFT.sol (ERC-721 + soulbound + MINTER_ROLE)
- [ ] Deploy lên Oasis Sapphire Testnet
- [ ] Test contract: mint, freeze, soulbound transfer restriction
- [ ] Deploy lên Mainnet sau khi test xong

### Backend NFT Integration
- [ ] NFTService.mintNFT()
- [ ] Tích hợp với MilestoneService.checkAndReward()
- [ ] Duplicate prevention (1 NFT per milestone per user)
- [ ] API: /nfts/:userId

### Anti-Speculation (Phase 2 cơ bản)
- [ ] AbuseDetectionService – rules cơ bản
- [ ] Rate limiting trên API kết quả trận
- [ ] UI audit: không có giá tiền, không có gambling language

### Frontend Collection
- [ ] NFT Gallery (grid view)
- [ ] NFT Detail modal
- [ ] Soulbound badge indicator
- [ ] Claim NFT flow từ Game Over modal

### Art Assets Season 1
- [ ] Thiết kế 5-10 NFT art cards cho Season 1 milestones
- [ ] Upload lên IPFS, lưu CID trong milestone config

---

**Definition of Done**: Người chơi đạt milestone có thể claim NFT thật trên blockchain, xem trong Collection tab, không thể transfer nếu soulbound.
`,
    },
    {
      title: '[Roadmap] Phase 3 – Boss AI Events + Narrative NFTs + Anti-Abuse',
      labels: ['roadmap'],
      body: `## 🎯 Mục tiêu Phase 3
Triển khai event Boss AI theo mùa, Story Chapter NFT cho người chơi hoàn thành chuỗi khó, tối ưu anti-abuse và hệ thống xác minh kết quả.

---

## ✅ Checklist Phase 3

### Boss AI Events
- [ ] BossAI abstract class + Season 1 boss implementation
- [ ] BossEventService (lifecycle, điều kiện phụ, reward trigger)
- [ ] Admin seed tool cho boss event mới theo mùa
- [ ] Frontend: event page, boss intro, results

### Narrative Story Chapter NFTs
- [ ] StoryChapter NFT type (metadata: chapter, lore, artwork)
- [ ] Milestone mastery trigger: Ladder Complete, Boss Slayer x3
- [ ] Story progression UI trong Collection tab

### Challenge Ladder – Bậc cao
- [ ] Gold AI (minimax depth-2)
- [ ] Platinum AI (alpha-beta depth-4)
- [ ] Master AI (depth-6 + opening book)
- [ ] Điều kiện bậc Gold/Platinum/Master + NFT unlock

### Anti-Abuse nâng cao
- [ ] Anomaly detection rules đầy đủ (win-rate, IP, timing)
- [ ] Admin dashboard review flags
- [ ] NFT freeze/unfreeze workflow
- [ ] Báo cáo abuse định kỳ

### KPI Monitoring
- [ ] Dashboard theo dõi milestone completion rate
- [ ] Player retention metrics (Day 1/7/30)
- [ ] NFT claim rate tracking
- [ ] Boss event participation metrics

---

**Definition of Done**: Có ít nhất 1 Boss AI event Season 1 hoạt động, người chơi hoàn thành điều kiện nhận được NFT Legendary, hệ thống anti-abuse phát hiện và xử lý gian lận.
`,
    },
  ];

  let created = 0;
  let skipped = 0;

  // Get all existing issues (open + closed)
  const existingIssues = [];
  let page = 1;
  while (true) {
    const resp = await github.rest.issues.listForRepo({
      owner, repo, state: 'all', per_page: 100, page
    });
    existingIssues.push(...resp.data);
    if (resp.data.length < 100) break;
    page++;
  }

  const existingTitles = existingIssues.map(i => i.title);

  for (const issue of issues) {
    if (existingTitles.some(t => t === issue.title)) {
      console.log(`SKIP (exists): ${issue.title}`);
      skipped++;
      continue;
    }
    try {
      const result = await github.rest.issues.create({
        owner, repo,
        title: issue.title,
        body: issue.body,
        labels: issue.labels,
      });
      console.log(`CREATED #${result.data.number}: ${issue.title}`);
      created++;
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`FAILED: ${issue.title} - ${err.message}`);
    }
  }

  console.log(`\nDone! Created: ${created}, Skipped: ${skipped}`);
};
