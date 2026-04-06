export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin';
  walletAddress?: string; // For blockchain integration
  createdAt: Date;
  updatedAt: Date;
}

export interface JwtPayload {
  userId: string;
  username: string;
  email: string;
  role: string;
  walletAddress?: string;
  tokenType: 'access';
  jti?: string;
  iss?: string;
  aud?: string | string[];
}

export interface RefreshTokenPayload {
  userId: string;
  tokenType: 'refresh';
  jti?: string;
  iss?: string;
  aud?: string | string[];
}

export interface AuthResponse {
  accessToken: string;
  user: Omit<User, 'passwordHash'>;
}
