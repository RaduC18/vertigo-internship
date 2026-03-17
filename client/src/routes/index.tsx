import { useEffect, useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { api, Market } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MarketCard } from "@/components/market-card";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

function DashboardPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"active" | "resolved">("active");
  const [sortBy, setSortBy] = useState("date");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const loadMarkets = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.listMarkets(status, sortBy, page);
      console.log("API response:", data);
      setMarkets(data.markets ?? []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load markets");
    } finally {
      setIsLoading(false);
    }
  }, [status, sortBy, page]);

  useEffect(() => {
    loadMarkets();
  }, [loadMarkets]);

  // Real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      loadMarkets();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadMarkets]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 text-gray-900">Prediction Markets</h1>
          <p className="text-gray-600 mb-8 text-lg">Create and participate in prediction markets</p>
          <div className="space-x-4">
            <Button onClick={() => navigate({ to: "/auth/login" })}>Login</Button>
            <Button variant="outline" onClick={() => navigate({ to: "/auth/register" })}>
              Sign Up
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Markets</h1>
            <p className="text-gray-600 mt-2">Welcome back, {user?.username}!</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-lg px-4 py-2 border">
              <span className="text-sm text-gray-500">Balance</span>
              <p className="font-bold text-green-600">${user?.balance ?? 1000}</p>
            </div>
            <Button variant="outline" onClick={() => navigate({ to: "/leaderboard" })}>
              Leaderboard
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/profile" })}>
              Profile
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/auth/logout" })}>
              Logout
            </Button>
            <Button onClick={() => navigate({ to: "/markets/new" })}>Create Market</Button>
          </div>
        </div>

        {/* Filters si Sortare */}
        <div className="mb-6 flex flex-wrap gap-3">
          <div className="flex gap-2">
            <Button
              variant={status === "active" ? "default" : "outline"}
              onClick={() => { setStatus("active"); setPage(1); }}
            >
              Active
            </Button>
            <Button
              variant={status === "resolved" ? "default" : "outline"}
              onClick={() => { setStatus("resolved"); setPage(1); }}
            >
              Resolved
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant={sortBy === "date" ? "default" : "outline"}
              onClick={() => { setSortBy("date"); setPage(1); }}
            >
              Sort: Date
            </Button>
            <Button
              variant={sortBy === "total" ? "default" : "outline"}
              onClick={() => { setSortBy("total"); setPage(1); }}
            >
              Sort: Total Bets
            </Button>
            <Button
              variant={sortBy === "participants" ? "default" : "outline"}
              onClick={() => { setSortBy("participants"); setPage(1); }}
            >
              Sort: Participants
            </Button>
          </div>

          <Button variant="outline" onClick={loadMarkets} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {/* Total */}
        <p className="text-sm text-gray-500 mb-4">{total} markets found</p>

        {/* Error */}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive mb-6">
            {error}
          </div>
        )}

        {/* Markets Grid */}
        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Loading markets...</p>
            </CardContent>
          </Card>
        ) : markets.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground text-lg">
                No {status} markets found. {status === "active" && "Create one to get started!"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {markets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        )}

        {/* Paginare */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <Button
              variant="outline"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  component: DashboardPage,
});