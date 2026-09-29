export class ComparisonRequestGate {
  private token = 0;

  begin() {
    this.token += 1;
    return this.token;
  }

  invalidate() {
    this.token += 1;
  }

  isCurrent(token: number) {
    return token === this.token;
  }
}

export async function runLatestComparisonRequest<T>({
  gate,
  request,
  onResult,
  onError,
  onSettled,
}: {
  gate: ComparisonRequestGate;
  request: () => Promise<T>;
  onResult: (value: T) => void;
  onError: (error: unknown) => void;
  onSettled: () => void;
}) {
  const token = gate.begin();
  try {
    const value = await request();
    if (gate.isCurrent(token)) onResult(value);
    return value;
  } catch (error: unknown) {
    if (gate.isCurrent(token)) onError(error);
    return null;
  } finally {
    if (gate.isCurrent(token)) onSettled();
  }
}
