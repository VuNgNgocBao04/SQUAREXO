import { Router, type Response } from "express";
import { z } from "zod";
import type { UserService } from "../services/userService";
import type { MatchService } from "../services/matchService";
import type { AuthenticatedRequest } from "../middleware/auth";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export function createUsersRouter(userService: UserService, matchService: MatchService) {
  const router = Router();

  router.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
    const userId = String(req.params.id);
    const profile = await userService.getProfile(userId);
    if (!profile) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    return res.status(200).json(profile);
  });

  router.get("/:id/matches", async (req: AuthenticatedRequest, res: Response) => {
    const userId = String(req.params.id);
    const parsed = paginationSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation error",
        code: "VALIDATION_ERROR",
        details: parsed.error.issues,
      });
    }

    const result = await matchService.getUserMatches(userId, parsed.data.page, parsed.data.limit);
    return res.status(200).json(result);
  });

  return router;
}
