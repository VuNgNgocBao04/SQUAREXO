import { describe, expect, it } from "vitest";
import { ErrorCode } from "../../src/contracts/errors";
import { joinRoomSchema, makeMoveSchema } from "../../src/contracts/schemas";
import { parsePayload } from "../../src/utils/validation";

describe("validation", () => {
  it("accepts valid join payload", () => {
    const payload = parsePayload(joinRoomSchema, {
      roomId: "demo_room",
      rows: 3,
      cols: 3,
    });

    expect(payload.roomId).toBe("demo_room");
  });

  it("rejects invalid roomId", () => {
    expect(() => {
      parsePayload(joinRoomSchema, { roomId: "***", rows: 3, cols: 3 });
    }).toThrowError(/Invalid payload/);
  });

  it("rejects malformed move payload", () => {
    try {
      parsePayload(makeMoveSchema, {
        roomId: "room_1",
        actionId: "a1",
        edge: { from: { row: 0 }, to: { row: 0, col: 1 } },
      });
      throw new Error("should_not_reach");
    } catch (error: unknown) {
      expect((error as { code: ErrorCode }).code).toBe(ErrorCode.VALIDATION_ERROR);
    }
  });
});
