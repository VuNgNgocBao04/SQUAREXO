import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type { MatchService } from "../services/matchService";

const evmAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM wallet address");

const historyQuerySchema = z.object({
  wallet: evmAddressSchema,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const historySyncSchema = z.object({
  wallet: evmAddressSchema,
  items: z
    .array(
      z.object({
        roomId: z.string().trim().min(1).max(128),
        playerX: z.string().trim().min(1).max(128).optional(),
        playerO: z.string().trim().min(1).max(128).optional(),
        winnerPlayer: z.enum(["X", "O", "draw"]),
        scoreX: z.number().int().min(0).max(10_000),
        scoreO: z.number().int().min(0).max(10_000),
        totalMoves: z.number().int().min(0).max(10_000),
        gridSize: z.number().int().min(2).max(12),
        gameMode: z.enum(["pvp", "ai"]),
        stakeRose: z.number().min(0).max(1_000_000),
        txHash: z.string().trim().min(6).max(256).optional(),
        startedAt: z.string().datetime().optional(),
        endedAt: z.string().datetime(),
      }),
    )
    .max(100),
});

export function createHistoryRouter(matchService: MatchService, syncApiKey?: string) {
  const router = Router();

  const assertSyncApiKey = (req: Request, res: Response): boolean => {
    if (!syncApiKey) {
      return true;
    }

    const provided = req.header("x-history-sync-key");
    if (provided !== syncApiKey) {
      res.status(401).json({
        error: "Unauthorized sync key",
        code: "INVALID_SYNC_KEY",
      });
      return false;
    }

    return true;
  };

  router.get("/", async (req: Request, res: Response) => {
    const parsed = historyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation error",
        code: "VALIDATION_ERROR",
        details: parsed.error.issues,
      });
    }

    const result = await matchService.getWalletHistory(parsed.data.wallet, parsed.data.page, parsed.data.limit);
    return res.status(200).json(result.items);
  });

  router.post("/sync", async (req: Request, res: Response) => {
    if (!assertSyncApiKey(req, res)) {
      return;
    }

    const parsed = historySyncSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation error",
        code: "VALIDATION_ERROR",
        details: parsed.error.issues,
      });
    }

    const result = await matchService.syncWalletHistory(parsed.data.wallet, parsed.data.items);
    return res.status(200).json(result);
  });

  return router;
}
