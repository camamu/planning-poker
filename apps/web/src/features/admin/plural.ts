export function plural(count: number, one: string, many: string): string {
  return `${count.toString()} ${count === 1 ? one : many}`;
}
