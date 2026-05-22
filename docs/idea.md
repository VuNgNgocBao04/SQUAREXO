# Detailed Idea: AI Mode + Milestones + Collectible NFTs (Non-Financial)

## 1) Goals
- Create long-term engagement through an AI mode with increasing difficulty.
- Use milestones to recognize player skill and consistency.
- Reward NFTs as collectible honors such as art, avatar frames, or badges, not as speculative assets.

## 2) Required Design Principles
- Do not reward ETH, tokens, coins, or anything directly convertible to money.
- No staking, lotteries, paid spins, or pay-to-win mechanics.
- NFTs are only achievement and cosmetic rewards.
- Prefer non-transferable or restricted-transfer NFTs to avoid speculation.
- Make reward conditions transparent to avoid a gambling feel.

## 3) Proposed AI Modes

### 3.1 Training AI
- For new players.
- Basic pattern-based AI with move hints.
- No ranking impact.
- Rewards onboarding milestones.

### 3.2 Challenge Ladder AI
- Multiple tiers: Bronze, Silver, Gold, Platinum, Master.
- Each tier has explicit win conditions, such as winning 3/5 matches, no hints, or time limits.
- Advancing unlocks themed NFTs.

### 3.3 Daily/Weekly AI Trials
- A new tactical puzzle every day or week.
- Finish a streak to unlock seasonal special NFTs.
- Rewards are strictly achievement-based, with no paid entry.

### 3.4 Boss AI Event
- A high-difficulty boss with its own strategy.
- Seasonal events, for example one boss per month.
- Additional requirements such as low error counts or winning within limited turns unlock rare event NFTs.

## 4) Suggested Milestone System

### 4.1 Progress Milestones
- Play 10/50/100 AI matches.
- Win 5/20/50 AI matches.
- Log in 7/30 days in a row.

### 4.2 Skill Milestones
- Beat AI without hints 10 times.
- Win within a time limit, such as under 60 seconds per match, 20 times.
- Reach a 3/5/10 win streak.

### 4.3 Mode Mastery Milestones
- Clear all 5 Challenge Ladder tiers.
- Finish 4 Weekly Trials in a row.
- Beat Boss AI across 3 different seasons.

### 4.4 Community Milestones (Non-Financial)
- Create or complete strategy-learning tasks with friends.
- Join themed community events with no fees and no betting.

## 5) Reward NFT Design (Non-Speculative)

### 5.1 NFT Types
- NFT Art Card: season or theme-based artwork.
- NFT Achievement Badge: a badge for a clear accomplishment.
- NFT Profile Frame: an avatar frame shown in profiles and matches.
- NFT Story Chapter: a story fragment unlocked through major milestones.

### 5.2 Rarity Based on Achievement Difficulty
- Common: basic milestones such as finishing the tutorial.
- Rare: intermediate milestones such as win streaks or Gold tier.
- Epic: hard milestones such as Master tier or long weekly streaks.
- Legendary: seasonal boss events with additional conditions.

### 5.3 Suggested Metadata Fields
- `name`, `description`, `season`, `milestoneId`, `rarity`, `earnedAt`.
- `artworkCID` (IPFS or equivalent decentralized storage).
- `isSoulbound` (true/false).
- `gameVersion` for querying by gameplay version.

## 6) Anti-Gambling and Anti-Speculation Mechanisms
- Do not include an in-game marketplace in the initial phase.
- Make most achievement NFTs soulbound by default.
- If transferability is allowed, restrict it to a small set of expanded cosmetic items with strong limits:
	- no internal listing,
	- long cooldown periods,
	- no rewards tied to trade value.
- Do not show fiat conversions in the UI.
- Avoid language such as investment, profit, or farming.

## 7) Suggested User Experience
- `AI Mode` tab: select mode and difficulty.
- `Milestones` tab: show clear progress, conditions, and rewards.
- `Collection` tab: show earned NFTs and the story behind each item.
- Post-match screen should show:
	- how much milestone progress increased,
	- which milestone is close to unlocking,
	- mint the NFT immediately if eligible, or let the user claim it later.

## 8) Suggested Technical Flow
1. The backend validates the AI match result and milestone conditions.
2. When a milestone is reached, the backend writes `reward_eligible` to the DB.
3. A blockchain service mints the NFT using normalized metadata.
4. Mint status is synchronized back to the player profile.
5. The frontend updates the Collection and badge display in real time or through short polling.

## 9) Lean Implementation Roadmap

### Phase 1: Gameplay and Milestones, no blockchain
- Finish 2-3 core AI modes.
- Enable milestone tracking and progress UI.
- Use simulated off-chain badges to test retention.

### Phase 2: Season 1 Collectible NFTs
- Mint NFTs for important milestones.
- Enable the Collection UI and achievement profile.
- Apply soulbound by default.

### Phase 3: Boss Events and Narrative NFTs
- Seasonal events with unique art.
- Story Chapter NFTs for players who complete difficult streaks.
- Improve anti-abuse and result verification.

## 10) Success Metrics
- Milestone completion rate by difficulty tier.
- Day 1/7/30 return rate for AI mode players.
- NFT claim rate after eligibility.
- Participation rate in seasonal Boss events.
- User feedback about gameplay motivation instead of earning motivation.

## 11) Conclusion
This direction can work if the focus stays on achievement, collecting, and aesthetics instead of finance and speculation. Done correctly, it can increase engagement, strengthen the game identity, and stay clear of gambling-oriented product framing.

## 12) Should NFTs Come From PvP or PvBot?

### 12.1 Recommended Approach: Hybrid (PvBot as the base, PvP as the peak)
- PvBot should be the main NFT source to keep things fair, easier to balance, and harder to abuse.
- PvP should supply prestige NFTs that create social status for strong players.
- Suggested initial split:
	- 70-80% of NFTs from PvBot milestones.
	- 20-30% from PvP or PvP event achievements.

### 12.2 Why not PvP only?
- PvP creates stronger competition, but it also increases boosting, match fixing, and smurfing.
- If PvP is the only reward source, new players will struggle to participate and may quit early.

### 12.3 Why not PvBot only?
- PvBot is stable, but it lacks social prestige between players.
- NFT rewards from PvBot only can feel like a pure grind checklist and lose prestige.

### 12.4 Suggested Operating Rules
- PvBot: clear milestones, consistent rewards, and better onboarding/retention.
- PvP: rare seasonal rewards with strong anti-abuse and verifiable conditions.
- Do not use paid random mechanics or entry tickets.

## 13) What Makes an NFT Actually Work in the Game

### 13.1 It has clear social meaning
- The NFT must answer: what did the player achieve?
- Examples: Boss Slayer, No-Hint Master, Seasonal Top X%.

### 13.2 It is tied to the journey, not the price
- Value should come from the unlock story and the effort required to earn it.
- The UI should focus on conditions, achievement time, and the season earned.

### 13.3 It is hard to earn but fair
- Unlock conditions must be transparent and verifiable, not random.
- Rarity should reflect true achievement difficulty.

### 13.4 It has light utility, not pay-to-win
- Utility should be cosmetic or identity-based: avatar frame, intro effect, gallery.
- Do not add power stats or gameplay advantages.

### 13.5 Anti-speculation by design
- Make achievement NFTs soulbound by default.
- If transfer is allowed, restrict it to a narrow cosmetic category with strict limits.
- Do not show fiat conversion in the main game experience.

### 13.6 Anti-cheat preserves achievement value
- Verify NFT conditions on the backend, not on the client.
- Add anomaly detection rules such as unusual win rates, repeated devices/IPs, or repeating opponent patterns.
- Include revocation or freeze mechanisms if serious fraud is detected.