/**
 * Resolve hook that lets Node's type-stripping loader follow the app's
 * extensionless TypeScript imports (e.g. `./crypto` from `tools.ts`).
 * Used only by the local guard tests.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (
      specifier.startsWith(".") ||
      specifier.startsWith("/") ||
      specifier.startsWith("file:")
    ) {
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        try {
          return await nextResolve(specifier + ext, context);
        } catch {
          /* try the next extension */
        }
      }
    }
    throw err;
  }
}
