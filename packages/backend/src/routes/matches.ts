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

    const requesterId = req.user?.userId;
    const requesterRole = req.user?.role;
    const isOwner = requesterId && (match.playerXId === requesterId || match.playerOId === requesterId);
    const isAdmin = requesterRole === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: "Forbidden",
        code: "FORBIDDEN",
      });
    }

    return res.status(200).json(match);
  });

  return router;
}
