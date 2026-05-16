export type MatchOutcome = "X" | "O" | "DRAW";

type EloResult = {
  xElo: number;
  oElo: number;
};

const K_FACTOR = 32;

function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + 10 ** ((rb - ra) / 400));
}

export function calculateElo(xElo: number, oElo: number, outcome: MatchOutcome): EloResult {
  const xExpected = expectedScore(xElo, oElo);
  const oExpected = expectedScore(oElo, xElo);

  const xScore = outcome === "X" ? 1 : outcome === "O" ? 0 : 0.5;
  const oScore = outcome === "O" ? 1 : outcome === "X" ? 0 : 0.5;

  return {
    xElo: Math.max(100, Math.round(xElo + K_FACTOR * (xScore - xExpected))),
    oElo: Math.max(100, Math.round(oElo + K_FACTOR * (oScore - oExpected))),
  };
}
