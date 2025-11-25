export type HomePeriodPreset = "today" | "yesterday" | "last_7" | "last_30";

export interface HomePeriodRange {
  preset: HomePeriodPreset;
  from: string;
  to: string;
}

export interface HomeKpis {
  revenue_net: number;
  meta_spend: number;
  mer: number;
  roas: number;
  aov: number;
  as_of: string | null;
}

export interface HomeTimeseriesPoint {
  date: string;
  revenue_net: number;
  meta_spend: number;
  mer: number;
}

export interface HomeDashboardResponse {
  period: HomePeriodRange;
  kpis: HomeKpis;
  timeseries: HomeTimeseriesPoint[];
  currency: string;
  meta: {
    hasData: boolean;
  };
}




