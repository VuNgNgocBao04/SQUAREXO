# Ý tưởng chi tiết: Chế độ chơi với AI + Milestone + NFT sưu tầm (phi tài chính)

## 1) Mục tiêu
- Tạo thêm động lực chơi dài hạn thông qua chế độ AI có độ khó tăng dần.
- Dùng milestone để ghi nhận kỹ năng và sự kiên trì của người chơi.
- Thưởng NFT như vật phẩm sưu tầm (tranh, khung avatar, badge) mang tính danh dự, không phải tài sản đầu cơ.

## 2) Nguyên tắc thiết kế bắt buộc
- Không thưởng ETH, token, coin, hoặc bất kỳ đơn vị có thể quy đổi trực tiếp thành tiền.
- Không có cơ chế đặt cược, xổ số, quay thưởng mất phí, hoặc "pay-to-win".
- NFT chỉ là phần thưởng thành tích và thẩm mỹ (cosmetic/collectible).
- Ưu tiên NFT không chuyển nhượng (soulbound) hoặc chuyển nhượng bị giới hạn để tránh đầu cơ.
- Minh bạch điều kiện nhận thưởng, tránh cảm giác "cờ bạc may rủi".

## 3) Đề xuất các chế độ AI

### 3.1. Training AI (Luyện tập)
- Dành cho người mới.
- AI đánh theo mẫu cơ bản, có gợi ý nước đi.
- Không tính xếp hạng.
- Thưởng milestone nhập môn (onboarding).

### 3.2. Challenge Ladder AI (Leo thang độ khó)
- Gồm nhiều bậc: Bronze, Silver, Gold, Platinum, Master.
- Mỗi bậc có bộ luật chiến thắng cụ thể (ví dụ: thắng 3/5 trận, không dùng hint, hoặc giới hạn thời gian).
- Vượt bậc mở khóa NFT theo chủ đề.

### 3.3. Daily/Weekly AI Trials (Thử thách định kỳ)
- Mỗi ngày/tuần có bài toán chiến thuật riêng.
- Hoàn thành đủ chuỗi ngày để mở NFT đặc biệt theo mùa.
- Chỉ thưởng theo thành tích, không có vé mua tham gia.

### 3.4. Boss AI Event
- AI "Boss" có chiến thuật riêng, độ khó cao.
- Event theo mùa (ví dụ mỗi tháng 1 boss).
- Hoàn thành các điều kiện phụ (ít lỗi, thắng trong số lượt giới hạn) để nhận NFT hiếm theo sự kiện.

## 4) Hệ thống milestone đề xuất

## 4.1. Milestone tiến trình
- Chơi 10/50/100 trận AI.
- Thắng 5/20/50 trận AI.
- Đăng nhập liên tục 7/30 ngày.

## 4.2. Milestone kỹ năng
- Thắng AI mà không dùng hint 10 trận.
- Thắng trong giới hạn thời gian (ví dụ < 60 giây/trận) 20 lần.
- Đạt chuỗi thắng 3/5/10.

## 4.3. Milestone mastery theo chế độ
- Vượt đủ 5 bậc Challenge Ladder.
- Hoàn tất 4 Weekly Trials liên tiếp.
- Hạ Boss AI 3 mùa khác nhau.

## 4.4. Milestone cộng đồng (không tài chính)
- Tạo/hoàn thành nhiệm vụ học chiến thuật cùng bạn bè.
- Tham gia event cộng đồng theo chủ đề (không phí, không cược).

## 5) Thiết kế NFT phần thưởng (phi đầu cơ)

### 5.1. Loại NFT
- NFT Art Card: tranh minh họa theo season/chủ đề.
- NFT Achievement Badge: huy hiệu cho thành tích rõ ràng.
- NFT Profile Frame: khung avatar hiển thị trong hồ sơ/trận đấu.
- NFT Story Chapter: mảnh cốt truyện mở khóa khi đạt milestone lớn.

### 5.2. Độ hiếm gắn với độ khó thành tích
- Common: milestone cơ bản (ví dụ hoàn thành tutorial).
- Rare: milestone trung cấp (chuỗi thắng, bậc Gold).
- Epic: milestone khó (bậc Master, weekly streak dài).
- Legendary: event Boss theo mùa với điều kiện phụ.

### 5.3. Thuộc tính metadata gợi ý
- `name`, `description`, `season`, `milestoneId`, `rarity`, `earnedAt`.
- `artworkCID` (IPFS hoặc lưu trữ phi tập trung tương đương).
- `isSoulbound` (true/false).
- `gameVersion` để truy xuất theo phiên bản gameplay.

## 6) Cơ chế chống cờ bạc và đầu cơ
- Không có marketplace tích hợp trong game ở giai đoạn đầu.
- Mặc định soulbound cho phần lớn NFT thành tích.
- Nếu cho chuyển nhượng, chỉ cho phép với nhóm "cosmetic mở rộng" và giới hạn mạnh:
	- Không niêm yết nội bộ.
	- Có thời gian khóa (cooldown) dài.
	- Không có cơ chế thưởng theo giá trị giao dịch.
- Không hiển thị quy đổi giá tiền trong UI.
- Không dùng ngôn ngữ "đầu tư", "lợi nhuận", "farm".

## 7) Trải nghiệm người dùng đề xuất
- Tab `AI Mode`: chọn chế độ + độ khó.
- Tab `Milestones`: tiến độ từng mốc, điều kiện rõ ràng, phần thưởng tương ứng.
- Tab `Collection`: bộ sưu tập NFT đã nhận, câu chuyện từng vật phẩm.
- Màn hình cuối trận hiển thị:
	- Tiến độ mốc tăng bao nhiêu phần trăm.
	- Mốc nào sắp mở khóa.
	- Nếu đủ điều kiện thì mint NFT ngay (hoặc claim trong inbox).

## 8) Luồng kỹ thuật gợi ý
1. Backend xác thực kết quả trận AI và điều kiện milestone.
2. Khi đạt mốc, backend ghi `reward_eligible` vào DB.
3. Dịch vụ blockchain mint NFT bằng metadata đã chuẩn hóa.
4. Trạng thái mint được đồng bộ ngược lại hồ sơ người chơi.
5. Frontend cập nhật Collection và badge hiển thị theo thời gian thực hoặc polling ngắn.

## 9) Lộ trình triển khai gọn

### Phase 1: Gameplay + Milestones (không blockchain)
- Hoàn chỉnh 2-3 chế độ AI cơ bản.
- Bật hệ thống milestone + UI tiến độ.
- Dùng phần thưởng giả lập (off-chain badge) để test retention.

### Phase 2: NFT sưu tầm mùa 1
- Mint NFT cho milestone quan trọng.
- Bật Collection UI + hồ sơ thành tích.
- Áp dụng soulbound mặc định.

### Phase 3: Event Boss + narrative NFT
- Event theo mùa với bộ art riêng.
- Story Chapter NFT cho người chơi hoàn thành chuỗi khó.
- Tối ưu anti-abuse và hệ thống xác minh kết quả.

## 10) KPI theo dõi hiệu quả
- Tỷ lệ hoàn thành milestone theo từng tầng độ khó.
- Tỷ lệ quay lại ngày 1/7/30 của người chơi AI mode.
- Tỷ lệ người chơi claim NFT sau khi đủ điều kiện.
- Mức độ tham gia event Boss theo mùa.
- Phản hồi người dùng về "động lực chơi" thay vì "động lực kiếm tiền".

## 11) Kết luận
Hoàn toàn có thể triển khai hướng này nếu giữ trọng tâm là "thành tích + sưu tầm + thẩm mỹ" thay vì "tài chính + đầu cơ". Thiết kế đúng sẽ giúp tăng gắn kết người chơi, tạo bản sắc cho game, và vẫn an toàn về mặt định hướng sản phẩm không cờ bạc.

## 12) Nên phát NFT từ PvP hay PvBot?

### 12.1. Khuyến nghị thực tế: Hybrid (PvBot làm nền, PvP làm đỉnh)
- PvBot là nguồn NFT chính để đảm bảo công bằng, dễ cân bằng độ khó, giảm gian lận.
- PvP là nguồn NFT danh giá để tạo uy tín xã hội cho người chơi giỏi.
- Tỷ trọng đề xuất giai đoạn đầu:
	- 70-80% NFT từ milestone PvBot.
	- 20-30% NFT từ thành tích PvP/event PvP.

### 12.2. Vì sao không chỉ PvP?
- PvP tạo giá trị cạnh tranh cao nhưng dễ phát sinh boost, dàn xếp trận, smurf.
- Nếu dùng PvP làm nguồn thưởng duy nhất, người mới khó tiếp cận và dễ nản.

### 12.3. Vì sao không chỉ PvBot?
- PvBot ổn định nhưng thiếu yếu tố uy tín xã hội giữa người chơi.
- NFT chỉ từ PvBot có thể bị xem như checklist thuần cày, giảm tính danh giá.

### 12.4. Nguyên tắc vận hành đề xuất
- PvBot: milestone rõ ràng, thưởng đều, giúp onboarding và giữ chân dài hạn.
- PvP: thưởng hiếm theo mùa, có anti-abuse mạnh và điều kiện xác minh rõ.
- Không áp dụng cơ chế random mất phí hoặc vé tham gia trả tiền.

## 13) Điều gì khiến NFT "thực sự hoạt động" trong game

### 13.1. Có ý nghĩa xã hội rõ ràng
- NFT phải trả lời được câu hỏi: "Người chơi đã đạt thành tích gì?"
- Ví dụ: Boss Slayer, No-Hint Master, Top X% mùa.

### 13.2. Gắn với hành trình, không gắn với giá
- Giá trị chính đến từ câu chuyện mở khóa và nỗ lực đạt mốc.
- UI tập trung hiển thị điều kiện đạt, thời điểm đạt, season đạt.

### 13.3. Khó kiếm nhưng công bằng
- Điều kiện mở khóa minh bạch, kiểm chứng được, không phụ thuộc may rủi.
- Độ hiếm phản ánh độ khó thực sự của thành tích.

### 13.4. Có utility nhẹ, không pay-to-win
- Utility nên là cosmetic/profile identity: khung avatar, hiệu ứng intro, gallery.
- Không cộng chỉ số sức mạnh hay lợi thế gameplay.

### 13.5. Chống đầu cơ ngay từ thiết kế
- Mặc định soulbound với NFT thành tích.
- Nếu cho chuyển nhượng, chỉ áp dụng cho nhóm cosmetic mở rộng và giới hạn chặt.
- Không hiển thị quy đổi tiền tệ trong trải nghiệm chính của game.

### 13.6. Chống gian lận để bảo toàn giá trị thành tích
- Xác minh điều kiện nhận NFT ở backend, không tin client.
- Có rule phát hiện bất thường (win-rate bất thường, trùng thiết bị/IP, chuỗi đối thủ lặp).
- Có cơ chế thu hồi/đóng băng NFT nếu phát hiện gian lận nghiêm trọng.