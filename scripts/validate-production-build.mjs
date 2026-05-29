const isMockMode = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

if (isMockMode) {
  console.error(
    "Production build blocked: NEXT_PUBLIC_USE_MOCKS=true. Set NEXT_PUBLIC_USE_MOCKS=false before building.",
  );
  process.exit(1);
}
