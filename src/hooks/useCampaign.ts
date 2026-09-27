"use client";

import { useState, useEffect, useReducer, useCallback } from "react";
import { Campaign } from "../types";
import { getCampaign } from "../lib/contractClient";

interface CampaignState {
  campaign: Campaign | null;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
}

type CampaignAction =
  | { type: "fetch_start" }
  | { type: "fetch_success"; campaign: Campaign }
  | { type: "fetch_not_found" }
  | { type: "fetch_error"; error: string };

function campaignReducer(state: CampaignState, action: CampaignAction): CampaignState {
  switch (action.type) {
    case "fetch_start":
      return { campaign: null, isLoading: true, error: null, notFound: false };
    case "fetch_success":
      return {
        campaign: action.campaign,
        isLoading: false,
        error: null,
        notFound: false,
      };
    case "fetch_not_found":
      return { campaign: null, isLoading: false, error: null, notFound: true };
    case "fetch_error":
      return {
        campaign: null,
        isLoading: false,
        error: action.error,
        notFound: false,
      };
  }
}

export interface UseCampaignResult {
  campaign: Campaign | null;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
  refetch: () => void;
}

export function useCampaign(id: number): UseCampaignResult {
  const [state, dispatch] = useReducer(campaignReducer, {
    campaign: null,
    isLoading: true,
    error: null,
    notFound: false,
  });
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    dispatch({ type: "fetch_start" });

    getCampaign(id)
      .then((data) => {
        if (!cancelled) {
          if (data === null) {
            dispatch({ type: "fetch_not_found" });
          } else {
            dispatch({ type: "fetch_success", campaign: data });
          }
        }
      })
      .catch((err) => {
        if (!cancelled)
          dispatch({
            type: "fetch_error",
            error: err instanceof Error ? err.message : "Failed to load campaign.",
          });
      });

    return () => {
      cancelled = true;
    };
  }, [id, tick]);

  return { ...state, refetch };
}
