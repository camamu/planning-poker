export interface TokenHasher {
  hash(secret: string): string;
}
