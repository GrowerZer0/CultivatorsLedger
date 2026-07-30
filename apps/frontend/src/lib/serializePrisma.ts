export function serializePrisma<T>(data: T): any {
  return JSON.parse(
    JSON.stringify(data, (_, value) => {
      if (value && typeof value === "object") {
        if ("toNumber" in value && typeof value.toNumber === "function") {
          return value.toNumber();
        }

        if (value instanceof Date) {
          return value.toISOString();
        }
      }

      return value;
    })
  );
}