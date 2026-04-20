export type Player = "X" | "O";

export interface Point {
    row: number;
    col: number;
}

export interface Edge {
    from: Point;
    to: Point;
    takenBy?: Player;
}

export interface BoxClaim {
    row: number;
    col: number;
    owner: Player;
}

export interface GameState {
    rows: number;
    cols: number;
    edges: Edge[];
    boxes: BoxClaim[];
    currentPlayer: Player;
    score: Record<Player, number>;
}