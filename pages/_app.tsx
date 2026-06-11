import App, { type AppProps, type AppContext } from "next/app";
import Layout from "../components/Layout";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import "../styles/globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import { isAssistantEnabled } from "@/lib/assistantFeature";

type MyAppProps = AppProps & { configuredTheme?: string; enableAssistant?: boolean };

let cachedAssistantEnabled: boolean | null = null;

const PAGE_TITLE_BY_ROUTE: Record<string, string> = {
    "/": "Dashboard",
    "/dashboard": "Dashboard",
    "/schema": "Schema",
    "/relationships": "Relationships",
    "/check": "Check",
    "/terminal": "Terminal",
    "/assistant": "Assistant",
};

const toTitleCase = (value: string): string =>
    value
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

const resolveAssistantEnabled = async (isServer: boolean) => {
    if (isServer) {
        const enabled = isAssistantEnabled();
        cachedAssistantEnabled = enabled;
        return enabled;
    }

    if (cachedAssistantEnabled !== null) {
        return cachedAssistantEnabled;
    }

    const envEnabled = isAssistantEnabled();
    if (envEnabled) {
        cachedAssistantEnabled = true;
        return true;
    }

    try {
        const response = await fetch("/api/spicedb/assistant-status", { method: "GET" });
        const enabled = response.status !== 404;
        cachedAssistantEnabled = enabled;
        return enabled;
    } catch {
        cachedAssistantEnabled = false;
        return false;
    }
};

export default function MyApp({ Component, pageProps, configuredTheme, enableAssistant }: MyAppProps) {
    const router = useRouter();
    const [isRouteLoading, setIsRouteLoading] = useState(false);
    const fallbackName = toTitleCase(router.pathname.replace(/^\//, "")) || "Dashboard";
    const pageName = PAGE_TITLE_BY_ROUTE[router.pathname] ?? fallbackName;
    const pageTitle = `Saffron: ${pageName}`;

    useEffect(() => {
        const start = (url: string) => {
            if (url === router.asPath) {
                return;
            }

            setIsRouteLoading(true);
            document.body.classList.add("saffron-route-loading");
        };

        const done = () => {
            setIsRouteLoading(false);
            document.body.classList.remove("saffron-route-loading");
        };

        router.events.on("routeChangeStart", start);
        router.events.on("routeChangeComplete", done);
        router.events.on("routeChangeError", done);

        return () => {
            router.events.off("routeChangeStart", start);
            router.events.off("routeChangeComplete", done);
            router.events.off("routeChangeError", done);
            document.body.classList.remove("saffron-route-loading");
        };
    }, [router.asPath, router.events]);

    return (
        <ThemeProvider configuredTheme={configuredTheme}>
            <Layout enableAssistant={enableAssistant}>
                <Head>
                    <title>{pageTitle}</title>
                </Head>
                {isRouteLoading && (
                    <div className="saffron-route-loading-indicator" role="status" aria-live="polite" aria-label="Switching section">
                        <div className="saffron-route-loading-bar" />
                        <div className="saffron-route-loading-pill">
                            <span className="saffron-route-loading-spinner" aria-hidden="true" />
                            Switching section...
                        </div>
                    </div>
                )}
                <Component {...pageProps} />
            </Layout>
        </ThemeProvider>
    );
}

MyApp.getInitialProps = async (appContext: AppContext) => {
    const appProps = await App.getInitialProps(appContext);
    return {
        ...appProps,
        configuredTheme: process.env.ACTIVE_THEME,
        enableAssistant: await resolveAssistantEnabled(Boolean(appContext.ctx.req)),
    };
};
