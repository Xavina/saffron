import App, { type AppProps, type AppContext } from "next/app";
import Layout from "../components/Layout";
import Head from "next/head";
import "../styles/globals.css";
import ThemeProvider from "@/components/ThemeProvider";

type MyAppProps = AppProps & { configuredTheme?: string; enableAssistant?: boolean };

export default function MyApp({ Component, pageProps, configuredTheme, enableAssistant }: MyAppProps) {
    return (
        <ThemeProvider configuredTheme={configuredTheme}>
            <Layout enableAssistant={enableAssistant}>
                <Head>Saffron | The UI for SpiceDB</Head>
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
        enableAssistant: process.env.ENABLE_ASSISTANT === 'true' || process.env.ENABLE_ASSISTANT === '1',
    };
};
