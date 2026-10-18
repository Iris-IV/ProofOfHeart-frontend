const isMockMode = process.env.NEXT_PUBLIC_USE_MOCKS === "true";
const skipCheck = process.env.SKIP_MOCK_CHECK === "true";

if (isMockMode && !skipCheck) {
  console.error(
    "Production build blocked: NEXT_PUBLIC_USE_MOCKS=true. Set NEXT_PUBLIC_USE_MOCKS=false before building, or set SKIP_MOCK_CHECK=true if this is for testing.",
  );
  process.exit(1);
}
