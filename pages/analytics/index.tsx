import NewFollowersCard from "@/common/components/Analytics/NewFollowersCard";
import ReactionsCard from "@/common/components/Analytics/ReactionsCard";
import CastReactionsTable from "@/common/components/Analytics/CastReactionsTable";
import { createClient } from "@/common/helpers/supabase/component";
import { AnalyticsData } from "@/common/types/types";
import { useAccountStore } from "@/stores/useAccountStore";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import get from "lodash.get";
import { Loading } from "@/common/components/Loading";
import { ProfileSearchDropdown } from "@/common/components/ProfileSearchDropdown";
import { getUserDataForFidOrUsername } from "@/common/helpers/neynar";
import { User } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { useAuth } from "@/common/context/AuthContext";
import { Button } from "@/components/ui/button";
import { ChartBarIcon } from "@heroicons/react/20/solid";
import Link from "next/link";
import ClickToCopyText from "@/common/components/ClickToCopyText";

type FidToAnalyticsData = Record<string, AnalyticsData>;

export default function AnalyticsPage() {
    const { user } = useAuth();

    const router = useRouter();
    const { query } = router;
    const supabaseClient = createClient();
    const [isLoading, setIsLoading] = useState(false);
    const [fidToAnalytics, setAnalyticsData] = useState<FidToAnalyticsData>({});
    const selectedAccount = useAccountStore((state) => state.accounts[state.selectedAccountIdx]);
    const { accounts } = useAccountStore();

    const defaultProfiles = useMemo(() => {
        return accounts.filter((account) => account.status === "active").map((a) => a.user) as User[];
    }, [accounts]);

    const [selectedProfile, setSelectedProfile] = useState<User>();
    const fid = get(selectedProfile, "fid")?.toString();

    useEffect(() => {
        if (selectedAccount && selectedAccount?.user) {
            setSelectedProfile(selectedAccount.user);
        }
    }, [selectedAccount]);

    useEffect(() => {
        if (!fid) return;

        const fetchAnalytics = async (fid: string) => {
            const { data: analyticsRow, error } = await supabaseClient
                .from("analytics")
                .select("*")
                .eq("fid", fid)
                .maybeSingle();
            if (error) {
                console.error("Error fetching analytics:", error);
                return false;
            }
            return analyticsRow;
        };
        const refreshForNewFid = async (fid: string) => {
            if (!fid) return;

            let analyticsRow = await fetchAnalytics(fid);
            if (!analyticsRow && user) {
                console.error("No analytics found for fid:", fid);
                const { data, error } = await supabaseClient.functions.invoke("create-analytics-data", {
                    body: JSON.stringify({ fid }),
                });
                if (error) {
                    console.error("Error invoking create-analytics-data:", error);
                } else {
                    console.log("create-analytics-data response:", data);
                    analyticsRow = await fetchAnalytics(fid);
                }
            }
            if (analyticsRow) {
                const { fid, updated_at: updatedAt, status, data } = analyticsRow;
                const analyticsData = {
                    fid,
                    updatedAt,
                    status,
                    ...(data as object),
                } as unknown as AnalyticsData;
                setAnalyticsData((prev) => ({ ...prev, [fid]: analyticsData }));
            }
        };

        try {
            setIsLoading(true);
            refreshForNewFid(fid);
        } catch (error) {
            console.error("Error fetching analytics:", error);
        } finally {
            setIsLoading(false);
        }
    }, [fid, user]);

    useEffect(() => {
        const fidFromQuery = query.fid as string;
        const usernameFromQuery = query.username as string;
        if (fidFromQuery || usernameFromQuery) {
            getUserDataForFidOrUsername({
                username: usernameFromQuery,
                fid: fidFromQuery,
                viewerFid: process.env.NEXT_PUBLIC_APP_FID!,
            }).then((users) => {
                if (users.length) {
                    setSelectedProfile(users[0]);
                }
                setIsLoading(false);
            });
        }
    }, [query]);

    const analyticsData = fid ? get(fidToAnalytics, fid) : undefined;

    const renderHeader = () => (
        <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
                <ProfileSearchDropdown
                    disabled={isLoading || !user}
                    defaultProfiles={defaultProfiles}
                    selectedProfile={selectedProfile}
                    setSelectedProfile={setSelectedProfile}
                />
                {!isLoading && !user && (
                    <Link href="/login">
                        <Button variant="default" size="sm">
                            Login to see more insights <ChartBarIcon className="h-4 w-4 ml-2" />
                        </Button>
                    </Link>
                )}
            </div>
            <div className="flex items-center space-x-2">
                {analyticsData?.updatedAt && (
                    <div className="text-sm text-foreground/70">
                        Last updated: {new Date(analyticsData.updatedAt).toLocaleString()}
                    </div>
                )}
                <ClickToCopyText
                    disabled={!analyticsData}
                    buttonText="Share"
                    size="sm"
                    text={`https://app.herocast.xyz/analytics?fid=${fid}`}
                />
            </div>
        </div>
    );

    const renderContent = () => {
        if (isLoading) {
            return <Loading className="ml-8" loadingMessage={"Loading analytics"} />;
        }
        if (!analyticsData) {
            return <Loading className="ml-8" loadingMessage={"Loading analytics"} />;
        }
        if (analyticsData.status === "pending") {
            return (
                <Loading
                    className="ml-8"
                    loadingMessage={"Analytics are being calculated. Please check back in a few minutes."}
                />
            );
        }
        return (
            <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analyticsData?.follows && <NewFollowersCard data={analyticsData.follows} isLoading={isLoading} />}
                    {analyticsData?.reactions && <ReactionsCard data={analyticsData.reactions} isLoading={isLoading} />}
                </div>
                <div>
                    <h2 className="text-2xl font-bold">Top casts</h2>
                </div>
                {analyticsData.casts && <CastReactionsTable rawCasts={analyticsData.casts} />}
            </>
        );
    };

    return (
        <div className="w-full m-8 space-y-8">
            {renderHeader()}
            {renderContent()}
        </div>
    );
}
