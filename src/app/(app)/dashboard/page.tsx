"use client";

import { useEffect, useState } from "react";
import { Topbar } from "@/components/shell/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  listDecks,
  getDueCount,
  getCardsStudiedToday,
  getCurrentStreak,
  getTotalReviews,
} from "@/store/decks";
import {
  useReviewsByDay,
  useHeatmapData,
  useCardStateBreakdown,
  useCardDistribution,
} from "@/lib/stats";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export default function DashboardPage() {
  const [deckCount, setDeckCount] = useState(0);
  const [cardCount, setCardCount] = useState(0);
  const [dueCount, setDueCount] = useState(0);
  const [studiedToday, setStudiedToday] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);

  // Live queries for charts
  const reviewsByDay = useReviewsByDay(30);
  const heatmapData = useHeatmapData(90);
  const cardBreakdown = useCardStateBreakdown();
  const cardDistribution = useCardDistribution();

  useEffect(() => {
    async function loadStats() {
      try {
        const decks = await listDecks();

        // Calculate total due count: sum of all decks
        // Note: parent_deck_id column doesn't exist yet, so no filtering needed
        let totalDue = 0;
        for (const deck of decks) {
          totalDue += await getDueCount(deck.id);
        }

        const [studied, currentStreak, total] = await Promise.all([
          getCardsStudiedToday(),
          getCurrentStreak(),
          getTotalReviews(),
        ]);

        setDeckCount(decks.length);
        // Card count will be set from cardDistribution hook
        setDueCount(totalDue);
        setStudiedToday(studied);
        setStreak(currentStreak);
        setTotalReviews(total);
      } catch (error) {
        console.error("Error loading stats:", error);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  // Update due count and card count when card distribution changes
  useEffect(() => {
    if (cardBreakdown) {
      setDueCount(
        cardBreakdown.new + cardBreakdown.learning + cardBreakdown.review
      );
    }
  }, [cardBreakdown]);

  // Update total card count from card distribution
  useEffect(() => {
    if (cardDistribution) {
      setCardCount(
        cardDistribution.new + cardDistribution.learning + cardDistribution.learned
      );
    }
  }, [cardDistribution]);

  // Format date for chart
  const formatChartDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", { month: "short", day: "numeric" });
  };

  // Prepare pie chart data based on card distribution (reps + state)
  const pieData = cardDistribution
    ? [
        { name: "Nouvelles", value: cardDistribution.new, color: "#3b82f6" },
        {
          name: "En apprentissage",
          value: cardDistribution.learning,
          color: "#f97316",
        },
        { name: "Apprises", value: cardDistribution.learned, color: "#22c55e" },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <>
      <Topbar title="Dashboard" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Top KPI row */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  À réviser aujourd&apos;hui
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-2xl font-bold">...</p>
                ) : (
                  <p className="text-2xl font-bold">{dueCount}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Étudiées aujourd&apos;hui
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-2xl font-bold">...</p>
                ) : (
                  <p className="text-2xl font-bold">{studiedToday}</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Série actuelle
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-2xl font-bold">...</p>
                ) : (
                  <p className="text-2xl font-bold">
                    {streak} jour{streak !== 1 ? "s" : ""}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main charts: two columns */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Heatmap */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activité (90 derniers jours)</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center py-4">
                {heatmapData !== undefined ? (
                  <ActivityHeatmap data={heatmapData} days={90} />
                ) : (
                  <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                    Chargement...
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Line chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Révisions par jour (30 derniers jours)</CardTitle>
              </CardHeader>
              <CardContent>
                {reviewsByDay !== undefined ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={reviewsByDay}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatChartDate}
                        className="text-xs"
                        stroke="currentColor"
                      />
                      <YAxis className="text-xs" stroke="currentColor" />
                      <RechartsTooltip
                        labelFormatter={(label) => formatChartDate(label)}
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "0.5rem",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                    Chargement...
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bottom: Breakdown + Total reviews */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Card breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Répartition des cartes</CardTitle>
              </CardHeader>
              <CardContent className="px-2 py-4">
                {cardDistribution !== undefined ? (
                  pieData.length > 0 ? (
                    <div className="w-full h-[280px] flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="45%"
                            labelLine={false}
                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                              const RADIAN = Math.PI / 180;
                              const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                              const x = cx + radius * Math.cos(-midAngle * RADIAN);
                              const y = cy + radius * Math.sin(-midAngle * RADIAN);
                              return (
                                <text
                                  x={x}
                                  y={y}
                                  fill="white"
                                  textAnchor="middle"
                                  dominantBaseline="central"
                                  className="text-xs font-semibold"
                                >
                                  {`${(percent * 100).toFixed(0)}%`}
                                </text>
                              );
                            }}
                            outerRadius={70}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            wrapperStyle={{
                              paddingTop: "10px"
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                      Aucune carte
                    </div>
                  )
                ) : (
                  <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">
                    Chargement...
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Secondary KPIs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Statistiques</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Decks</p>
                  <p className="text-xl font-semibold">{deckCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cartes totales</p>
                  <p className="text-xl font-semibold">{cardCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Révisions totales</p>
                  <p className="text-xl font-semibold">{totalReviews}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
