import { Router, type Response } from "express";
import type { MatchService } from "../services/matchService";
import type { AuthenticatedRequest } from "../middleware/auth";

export function createMatchesRouter(matchService: MatchService) {
  const router = Router();

  router.get("/:matchId", async (req: AuthenticatedRequest, res: Response) => {
    const match = await matchService.getMatchById(String(req.params.matchId));
    if (!match) {
      return res.status(404).json({
        error: "Match not found",
        code: "MATCH_NOT_FOUND",
      });
    }

    return res.status(200).json(match);
  });

  return router;
}
