import HomeDashboardClient from "./HomeDashboardClient";

export const dynamic = "force-dynamic";

export default function HomeDashboardPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        padding: "2rem 1.5rem 3rem",
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: "1200px" }}>
        <HomeDashboardClient />
      </div>
    </main>
  );
}




